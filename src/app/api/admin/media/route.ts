import { createAdminClient } from '@/lib/supabase/admin'
import { withResolvedPublicMediaUrl } from '@/lib/media-cdn-url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const file_type = searchParams.get('file_type')
  const folder = searchParams.get('folder')
  const folder_prefix = searchParams.get('folder_prefix')
  const search = searchParams.get('search')
  const list_folders = searchParams.get('list_folders')

  if (list_folders === 'true') {
    const { data, error } = await supabase
      .from('media')
      .select('folder')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const folderSet = new Set<string>()
    const currentFolder = folder || '/'
    const prefix = currentFolder === '/' ? '' : currentFolder.replace(/^\/|\/$/g, '')

    data?.forEach((row) => {
      const f = row.folder.replace(/^\/|\/$/g, '')
      if (!f) return

      if (prefix) {
        if (f.startsWith(prefix + '/')) {
          const remainder = f.slice(prefix.length + 1)
          const nextSegment = remainder.split('/')[0]
          if (nextSegment) folderSet.add(`${prefix}/${nextSegment}`)
        }
      } else {
        const topLevel = f.split('/')[0]
        if (topLevel) folderSet.add(topLevel)
      }
    })

    const folders = Array.from(folderSet).sort().map((f) => ({
      path: `/${f}`,
      name: f.split('/').pop() || f,
    }))

    return NextResponse.json({ folders })
  }

  let query = supabase
    .from('media')
    .select('*, uploaded_by_staff:staff!media_uploaded_by_fkey(full_name)')
    .order('created_at', { ascending: false })

  if (file_type) query = query.eq('file_type', file_type)
  if (folder) query = query.eq('folder', folder)
  if (folder_prefix) query = query.like('folder', `${folder_prefix}%`)
  if (search) query = query.or(`filename.ilike.%${search}%,alt_text.ilike.%${search}%`)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data || []).map((row) => withResolvedPublicMediaUrl(row))
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return registerMedia(supabase, request)
  }
  return uploadMedia(supabase, request)
}

async function registerMedia(supabase: ReturnType<typeof createAdminClient>, request: NextRequest) {
  const body = await request.json()
  const { filename, s3_key, url, file_type, mime_type, file_size, alt_text, folder, is_private } = body

  if (!filename || !s3_key || !file_type) {
    return NextResponse.json({ error: 'filename, s3_key, and file_type are required' }, { status: 400 })
  }

  if (!is_private && !url) {
    return NextResponse.json({ error: 'url is required for public files' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('media')
    .insert({
      filename,
      s3_key,
      url: is_private ? '' : url,
      file_type,
      mime_type: mime_type || null,
      file_size: file_size || null,
      alt_text: alt_text || null,
      folder: folder || '/',
      is_private: is_private || false,
    })
    .select()
    .single()

  if (error) {
    console.error('DB insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(withResolvedPublicMediaUrl(data), { status: 201 })
}

async function uploadMedia(supabase: ReturnType<typeof createAdminClient>, request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const folder = (formData.get('folder') as string) || '/'
  const alt_text = formData.get('alt_text') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const folderPath = folder === '/' ? '' : folder.replace(/^\/|\/$/g, '')
  const s3Key = folderPath
    ? `media/${folderPath}/${timestamp}-${safeName}`
    : `media/${timestamp}-${safeName}`
  const bucket = process.env.AWS_S3_BUCKET!

  const s3 = getS3Client()

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
  } catch (s3Error: unknown) {
    const message = s3Error instanceof Error ? s3Error.message : 'Unknown S3 error'
    console.error('S3 upload failed:', s3Error)
    return NextResponse.json({ error: `S3 upload failed: ${message}` }, { status: 500 })
  }

  const cdnBase = process.env.MEDIA_CDN_URL
  const url = cdnBase && cdnBase.length > 0
    ? `${cdnBase.replace(/\/$/, '')}/${s3Key}`
    : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`

  const fileType = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'document'

  const { data, error } = await supabase
    .from('media')
    .insert({
      filename: file.name,
      s3_key: s3Key,
      url,
      file_type: fileType,
      mime_type: file.type,
      file_size: file.size,
      alt_text: alt_text || null,
      folder,
    })
    .select()
    .single()

  if (error) {
    console.error('DB insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(withResolvedPublicMediaUrl(data), { status: 201 })
}
