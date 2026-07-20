import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getS3Client } from '@/lib/storage/s3'
import { resolveStaff } from '@/lib/auth/resolve-staff'

export const dynamic = 'force-dynamic'

/**
 * Resolve an S3 object key from a CDN or S3 public URL.
 * Returns null if the URL doesn't point at our bucket/CDN.
 */
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
 * GET /api/admin/ugc/download?url=<asset_url>&filename=<name>
 *
 * Redirects to a presigned S3 URL with Content-Disposition: attachment so the
 * browser downloads the file instead of navigating to it. Needed because the
 * assets live on the CDN/S3 (cross-origin), where <a download> is ignored.
 */
export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  const key = s3KeyFromUrl(url)
  if (!key || key.includes('..')) {
    return NextResponse.json({ error: 'URL is not a recognized media asset' }, { status: 400 })
  }

  const fallbackName = key.split('/').pop() || 'download'
  const filename = (request.nextUrl.searchParams.get('filename') || fallbackName)
    // strip characters that break the Content-Disposition header
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .slice(0, 150)

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  })

  const signedUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: 300,
  })

  return NextResponse.redirect(signedUrl)
}
