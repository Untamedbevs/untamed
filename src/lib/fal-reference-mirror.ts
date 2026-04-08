import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { fal } from '@/lib/fal'

function getS3() {
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

/** Same default as scripts/sync-public-assets-to-s3.mjs */
function siteAssetsS3Prefix(): string {
  return (process.env.STATIC_ASSET_S3_PREFIX || 'site-assets').replace(/^\/+|\/+$/g, '')
}

function configuredCdnOrigins(): Set<string> {
  const out = new Set<string>()
  for (const raw of [process.env.MEDIA_CDN_URL, process.env.NEXT_PUBLIC_SITE_ASSET_BASE_URL]) {
    const t = raw?.trim()
    if (!t) continue
    try {
      out.add(new URL(t).origin)
    } catch {
      continue
    }
  }
  return out
}

/** Fal already hosts outputs here; pass through to the model as-is. */
export function isLikelyFalHostedImageUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase()
    return h === 'fal.media' || h.endsWith('.fal.media') || h.includes('falcdn')
  } catch {
    return false
  }
}

function shortUrl(url: string, max = 96): string {
  const t = url.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function guessContentTypeFromPath(path: string): string {
  const lower = path.split('?')[0].toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/png'
}

async function readBucketObject(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const bucket = process.env.AWS_S3_BUCKET
  if (!bucket) throw new Error('AWS_S3_BUCKET is not set')

  const out = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const body = out.Body
  if (!body) throw new Error(`S3 object is empty: ${key}`)

  const buffer = Buffer.from(await body.transformToByteArray())
  const contentType =
    out.ContentType?.split(';')[0]?.trim() || guessContentTypeFromPath(key)
  return { buffer, contentType }
}

function errorChain(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const parts = [e.message]
  let c: unknown = 'cause' in e ? (e as Error & { cause?: unknown }).cause : undefined
  let depth = 0
  while (c instanceof Error && depth < 4) {
    parts.push(c.message)
    c = 'cause' in c ? (c as Error & { cause?: unknown }).cause : undefined
    depth += 1
  }
  return parts.filter(Boolean).join(' | ')
}

/**
 * /images/foo.png -> public/images/foo.png (no network).
 * Fal docs: use fal.storage.upload then pass the returned URL as image_url.
 */
async function tryReadPublicRootRelative(urlStr: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const t = urlStr.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  const rel = decodeURIComponent(t.replace(/^\/+/, ''))
  if (!rel || rel.includes('..')) return null
  const abs = join(process.cwd(), 'public', rel)
  try {
    const buffer = await readFile(abs)
    return { buffer, contentType: guessContentTypeFromPath(rel) }
  } catch {
    return null
  }
}

/**
 * If this URL is our CDN and uses the site-assets prefix, return the path under public/ (e.g. images/foo.png).
 */
function siteAssetRelativePathUnderPublic(urlStr: string): string | null {
  let u: URL
  try {
    u = new URL(urlStr.trim())
  } catch {
    return null
  }
  if (!configuredCdnOrigins().has(u.origin)) return null

  const prefix = siteAssetsS3Prefix()
  const pathname = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
  if (!pathname.startsWith(prefix + '/')) return null

  const underPublic = pathname.slice(prefix.length + 1)
  if (!underPublic || underPublic.includes('..')) return null
  return underPublic
}

/**
 * https://cdn/.../site-assets/images/foo.png -> public/images/foo.png
 * Matches how sync-public-assets-to-s3 lays out keys (prefix + path under public/).
 */
async function readPublicSiteAssetOrThrow(urlStr: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const underPublic = siteAssetRelativePathUnderPublic(urlStr)
  if (!underPublic) return null

  const abs = join(process.cwd(), 'public', underPublic)
  try {
    const buffer = await readFile(abs)
    return { buffer, contentType: guessContentTypeFromPath(underPublic) }
  } catch {
    throw new Error(
      `Site asset URL points at ./public/${underPublic} but that file is not in the repo. Add it under public/ (same layout as sync:assets) or pick a library image. Fal needs bytes via fal.storage.upload, not a broken CDN URL.`
    )
  }
}

async function downloadReferenceViaHttp(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  let res: Response
  try {
    res = await fetch(url, { redirect: 'follow' })
  } catch (e) {
    throw new Error(`Could not fetch ${shortUrl(url)}: ${errorChain(e)}`)
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${shortUrl(url)}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType =
    res.headers.get('content-type')?.split(';')[0]?.trim() || guessContentTypeFromPath(url)
  return { buffer, contentType }
}

/**
 * Fal expects `image_url` (etc.) to be a URL their workers can fetch, or you upload first via
 * `fal.storage.upload` and pass the returned fal.media URL — see https://docs.fal.ai/reference/client-libraries/javascript/storage
 *
 * Resolution order (no CDN→S3 guessing):
 * 1. Already on Fal CDN → use as-is
 * 2. Path like /images/... → read from ./public
 * 3. Your MEDIA_CDN_URL origin + path site-assets/... → read from ./public (same layout as sync:assets)
 * 4. Explicit s3_key from media row → GetObject (uploaded library files not in git)
 * 5. HTTP fetch (external public URLs)
 * Then upload bytes to fal.storage and return that URL for the model.
 */
export async function mirrorReferenceImageForFal(
  publicUrl: string,
  options?: { s3Key?: string | null }
): Promise<string> {
  const url = publicUrl.trim()
  if (!url) throw new Error('Reference image URL is empty')
  if (isLikelyFalHostedImageUrl(url)) return url

  let buffer: Buffer
  let contentType: string

  const fromPublicPath = await tryReadPublicRootRelative(url)
  if (fromPublicPath) {
    buffer = fromPublicPath.buffer
    contentType = fromPublicPath.contentType
  } else {
    const fromCdnMapped = await readPublicSiteAssetOrThrow(url)
    if (fromCdnMapped) {
      buffer = fromCdnMapped.buffer
      contentType = fromCdnMapped.contentType
    } else {
      const explicitKey = options?.s3Key?.trim() || null
      if (explicitKey) {
        try {
          const got = await readBucketObject(explicitKey)
          buffer = got.buffer
          contentType = got.contentType
        } catch (s3Err) {
          try {
            const got = await downloadReferenceViaHttp(url)
            buffer = got.buffer
            contentType = got.contentType
          } catch (httpErr) {
            throw new Error(
              `Reference image: S3 "${explicitKey}" failed (${errorChain(s3Err)}); URL failed (${errorChain(httpErr)})`
            )
          }
        }
      } else {
        const got = await downloadReferenceViaHttp(url)
        buffer = got.buffer
        contentType = got.contentType
      }
    }
  }

  if (buffer.length === 0) throw new Error('Reference image is empty')

  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType })
    return await fal.storage.upload(blob, { lifecycle: { expiresIn: '1d' } })
  } catch (e) {
    throw new Error(`fal.storage.upload failed: ${errorChain(e)}`)
  }
}
