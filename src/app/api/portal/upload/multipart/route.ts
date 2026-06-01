import { NextRequest, NextResponse } from 'next/server'
import {
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { resolveMember } from '@/lib/auth/resolve-member'
import { buildUserUploadKey, getS3Client, s3PublicUrl } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'

const ALLOWED_FOLDERS = new Set([
  'ugc/uploads',
  'ugc/recordings',
  'receipts/uploads',
])

interface CompletedPart {
  PartNumber: number
  ETag: string
}

export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action as string

    if (action === 'init') {
      const { filename, contentType, folder } = body
      const targetFolder = folder || 'ugc/uploads'
      if (!ALLOWED_FOLDERS.has(targetFolder)) {
        return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
      }

      const s3Key = buildUserUploadKey(member.authUserId, targetFolder, filename)

      const cmd = new CreateMultipartUploadCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })

      const result = await getS3Client().send(cmd)

      return NextResponse.json({
        uploadId: result.UploadId,
        s3Key,
        publicUrl: s3PublicUrl(s3Key),
      })
    }

    if (action === 'part-url') {
      const { uploadId, s3Key, partNumber } = body
      if (!uploadId || !s3Key || !partNumber) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      }
      if (!s3Key.startsWith(`user-uploads/${member.authUserId}/`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const cmd = new UploadPartCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
        UploadId: uploadId,
        PartNumber: partNumber,
      })

      const presignedUrl = await getSignedUrl(getS3Client(), cmd, {
        expiresIn: 3600,
      })

      return NextResponse.json({ presignedUrl })
    }

    if (action === 'complete') {
      const { uploadId, s3Key, parts } = body as {
        uploadId: string
        s3Key: string
        parts: CompletedPart[]
      }
      if (!uploadId || !s3Key || !parts || !Array.isArray(parts)) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      }
      if (!s3Key.startsWith(`user-uploads/${member.authUserId}/`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const cmd = new CompleteMultipartUploadCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.PartNumber - b.PartNumber)
            .map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })),
        },
      })

      await getS3Client().send(cmd)

      return NextResponse.json({
        s3Key,
        url: s3PublicUrl(s3Key),
      })
    }

    if (action === 'abort') {
      const { uploadId, s3Key } = body
      if (!uploadId || !s3Key) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      }
      if (!s3Key.startsWith(`user-uploads/${member.authUserId}/`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      await getS3Client().send(
        new AbortMultipartUploadCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: s3Key,
          UploadId: uploadId,
        })
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[portal/upload/multipart] Failed:', error)
    return NextResponse.json({ error: 'Multipart upload failed' }, { status: 500 })
  }
}
