import { fal } from '@fal-ai/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createAdminClient } from '@/lib/supabase/admin'

fal.config({
  credentials: process.env.FAL_KEY!,
})

export { fal }

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

export async function saveGeneratedMedia(
  sourceUrl: string,
  filename: string,
  fileType: 'image' | 'video',
  folder: string = '/studio/generated'
): Promise<{ id: string; url: string; filename: string; file_type: string }> {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Failed to download from ${sourceUrl}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || (fileType === 'video' ? 'video/mp4' : 'image/png')

  const timestamp = Date.now()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const folderPath = folder.replace(/^\/|\/$/g, '')
  const s3Key = folderPath
    ? `media/${folderPath}/${timestamp}-${safeName}`
    : `media/${timestamp}-${safeName}`
  const bucket = process.env.AWS_S3_BUCKET!

  const s3 = getS3Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  const cdnBase = process.env.MEDIA_CDN_URL
  const url = cdnBase && cdnBase.length > 0
    ? `${cdnBase.replace(/\/$/, '')}/${s3Key}`
    : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('media')
    .insert({
      filename: safeName,
      s3_key: s3Key,
      url,
      file_type: fileType,
      mime_type: contentType,
      file_size: buffer.length,
      folder,
    })
    .select()
    .single()

  if (error) throw new Error(`DB insert failed: ${error.message}`)

  return data
}
