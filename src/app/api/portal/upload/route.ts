import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { resolveMember } from '@/lib/auth/resolve-member'
import { buildUserUploadKey, getS3Client, s3PublicUrl } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_API_ROUTE_SIZE = 1 * 1024 * 1024 // 1MB safety cap (Vercel limits FormData)

const ALLOWED_FOLDERS = new Set(['ugc/uploads', 'ugc/recordings'])

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

    const s3Key = buildUserUploadKey(member.authUserId, folder, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
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
