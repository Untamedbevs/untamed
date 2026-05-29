import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { resolveMember } from '@/lib/auth/resolve-member'
import { buildUserUploadKey, getS3Client, s3PublicUrl } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'

const ALLOWED_FOLDERS = new Set(['ugc/uploads', 'ugc/recordings'])

export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filename, contentType, folder } = await request.json()

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'filename and contentType are required' },
        { status: 400 }
      )
    }

    const targetFolder: string = folder || 'ugc/uploads'
    if (!ALLOWED_FOLDERS.has(targetFolder)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
    }

    const s3Key = buildUserUploadKey(member.authUserId, targetFolder, filename)

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })

    const presignedUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: 600,
    })

    return NextResponse.json({
      presignedUrl,
      s3Key,
      publicUrl: s3PublicUrl(s3Key),
    })
  } catch (error) {
    console.error('[portal/upload/presigned] Failed:', error)
    return NextResponse.json({ error: 'Failed to get upload URL' }, { status: 500 })
  }
}
