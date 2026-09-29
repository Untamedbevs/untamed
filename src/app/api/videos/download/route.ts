import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getS3Client } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'

const ALLOWED_PREFIX = 'site-assets/videos/'

function s3KeyFromUrl(url: string): string | null {
  const bucket = process.env.AWS_S3_BUCKET!
  const cdnBase = process.env.MEDIA_CDN_URL?.replace(/\/$/, '')

  if (cdnBase && url.startsWith(`${cdnBase}/`)) {
    return decodeURIComponent(url.slice(cdnBase.length + 1).split('?')[0])
  }

  const s3Match = url.match(
    new RegExp(`^https://${bucket}\\.s3[.a-z0-9-]*\\.amazonaws\\.com/(.+)$`)
  )
  if (s3Match) {
    return decodeURIComponent(s3Match[1].split('?')[0])
  }

  return null
}

/**
 * GET /api/videos/download?url=<cdn url>&filename=<name>
 * Public downloads for files already published under site-assets/videos/.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  const key = s3KeyFromUrl(url)
  if (!key || key.includes('..') || !key.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ error: 'URL is not a published video' }, { status: 400 })
  }

  const fallbackName = key.split('/').pop() || 'video.mp4'
  const filename = (request.nextUrl.searchParams.get('filename') || fallbackName)
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .slice(0, 150)

  const signedUrl = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: 300 }
  )

  return NextResponse.redirect(signedUrl)
}
