import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { filename, contentType, folder = '/' } = await request.json()

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: 'filename and contentType are required' },
      { status: 400 }
    )
  }

  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  const timestamp = Date.now()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const s3Key = `media${folder === '/' ? '/' : `/${folder.replace(/^\/|\/$/g, '')}/`}${timestamp}-${safeName}`

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  })

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 })

  const cdnBase = process.env.MEDIA_CDN_URL
  const bucket = process.env.AWS_S3_BUCKET!
  const publicUrl = cdnBase
    ? `${cdnBase.replace(/\/$/, '')}/${s3Key}`
    : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`

  return NextResponse.json({
    presignedUrl,
    s3Key,
    publicUrl,
  })
}
