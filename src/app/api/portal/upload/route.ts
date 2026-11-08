import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { resolveMember } from '@/lib/auth/resolve-member'
import { buildUserUploadKey, getS3Client, s3PublicUrl } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_API_ROUTE_SIZE = 1 * 1024 * 1024 // 1MB safety cap (Vercel limits FormData)

const ALLOWED_FOLDERS = new Set([
  'ugc/uploads',
  'ugc/recordings',
  'receipts/uploads',
])

// ---------------------------------------------------------------------------
// Upload type allowlist (same rules in all three /api/portal/upload routes).
// Raster images and video only. SVG, HTML and any other type a browser could
// run as active content are refused, so nothing scriptable is published on
// the public media CDN. The filename extension must match the type family.
// ---------------------------------------------------------------------------
const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
  'image/avif', 'image/bmp', 'image/x-ms-bmp', 'image/tiff',
])
const VIDEO_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp',
  'video/3gpp2', 'video/x-matroska', 'video/x-msvideo', 'video/avi',
  'video/mpeg', 'video/ogg', 'video/x-ms-wmv',
])
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'jpe', 'jfif', 'png', 'webp', 'gif', 'heic', 'heif', 'hif',
  'avif', 'bmp', 'tif', 'tiff',
])
const VIDEO_EXTENSIONS = new Set([
  'mp4', 'm4v', 'mov', 'qt', 'webm', '3gp', '3g2', 'mkv', 'avi', 'mpg', 'mpeg',
  'ogv', 'ogg', 'wmv',
])
const OCTET_STREAM = 'application/octet-stream'

/**
 * Check the caller's filename and content type. Returns the content type to
 * store (exactly as sent, so a signed browser PUT still matches) and a
 * filename whose extension survives buildUserUploadKey's 100-character cut,
 * or null when the upload is not allowed.
 */
function checkUploadType(
  filename: unknown,
  contentType: unknown
): { contentType: string; filename: string } | null {
  if (typeof filename !== 'string' || typeof contentType !== 'string') return null
  const type = contentType.trim()
  if (type.length > 200 || !/^[\x20-\x7e]*$/.test(type)) return null
  const baseType = type.split(';')[0].trim().toLowerCase()

  const name = filename.trim()
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  const stem = dot >= 0 ? name.slice(0, dot) : name

  if (IMAGE_TYPES.has(baseType)) {
    if (dot >= 0 && !IMAGE_EXTENSIONS.has(ext)) return null
  } else if (VIDEO_TYPES.has(baseType)) {
    if (dot >= 0 && !VIDEO_EXTENSIONS.has(ext)) return null
  } else if (baseType === '' || baseType === OCTET_STREAM) {
    // Some browsers report no type for some media files (the portal clients
    // then send application/octet-stream). Browsers download rather than
    // render octet-stream, so allow it, but only with a media extension.
    if (!IMAGE_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext)) return null
  } else {
    return null
  }

  const safeName = name.length > 100 && dot >= 0 ? `${stem.slice(0, 90)}.${ext}` : name
  return { contentType: type || OCTET_STREAM, filename: safeName || 'upload' }
}

export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder = (form.get('folder') as string) || 'ugc/uploads'

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
    }
    if (file.size > MAX_API_ROUTE_SIZE) {
      return NextResponse.json(
        { error: 'File too large for direct upload; use presigned route' },
        { status: 413 }
      )
    }

    // file.type is the multipart part's declared type; '' when the browser
    // could not tell (stored as application/octet-stream, as before).
    const checked = checkUploadType(file.name, file.type || '')
    if (!checked) {
      return NextResponse.json(
        { error: 'Only photo and video files can be uploaded.' },
        { status: 400 }
      )
    }

    const s3Key = buildUserUploadKey(member.authUserId, folder, checked.filename)
    const buffer = Buffer.from(await file.arrayBuffer())

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
        Body: buffer,
        ContentType: checked.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )

    return NextResponse.json({
      s3Key,
      url: s3PublicUrl(s3Key),
    })
  } catch (error) {
    console.error('[portal/upload] Failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
