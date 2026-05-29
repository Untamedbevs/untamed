import { S3Client } from '@aws-sdk/client-s3'

let cached: S3Client | null = null

export function getS3Client(): S3Client {
  if (!cached) {
    cached = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }
  return cached
}

export function s3PublicUrl(s3Key: string): string {
  const cdnBase = process.env.MEDIA_CDN_URL
  const bucket = process.env.AWS_S3_BUCKET!
  const region = process.env.AWS_REGION || 'us-east-1'
  if (cdnBase) {
    return `${cdnBase.replace(/\/$/, '')}/${s3Key}`
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`
}

export function buildUserUploadKey(
  authUserId: string,
  folder: string,
  filename: string
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 10)
  const safe = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()
    .slice(0, 100)
  const cleanFolder = folder.replace(/^\/|\/$/g, '')
  return `user-uploads/${authUserId}/${cleanFolder}/${timestamp}-${random}-${safe}`
}
