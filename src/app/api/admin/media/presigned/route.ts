import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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

export async function POST(request: NextRequest) {
  const { filename, contentType, folder = '/', isPrivate = false } = await request.json()

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: 'filename and contentType are required' },
      { status: 400 }
    )
  }

  const s3 = getS3Client()
  const bucket = process.env.AWS_S3_BUCKET!

  const timestamp = Date.now()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const folderSegment = folder === '/' ? '/' : `/${folder.replace(/^\/|\/$/g, '')}/`

  const prefix = isPrivate ? 'private' : 'media'
  const s3Key = `${prefix}${folderSegment}${timestamp}-${safeName}`

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: contentType,
    ...(!isPrivate && { CacheControl: 'public, max-age=31536000, immutable' }),
  })

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 })

  let publicUrl: string | null = null
  if (!isPrivate) {
    const cdnBase = process.env.MEDIA_CDN_URL
    publicUrl = cdnBase
      ? `${cdnBase.replace(/\/$/, '')}/${s3Key}`
      : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`
  }

  return NextResponse.json({
    presignedUrl,
    s3Key,
    publicUrl,
    isPrivate,
  })
}
