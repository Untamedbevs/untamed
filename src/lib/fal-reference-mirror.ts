import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { lookup as dnsLookup, type LookupAddress } from 'dns'
import { readFile } from 'fs/promises'
import http from 'http'
import https from 'https'
import { isIP, type LookupFunction } from 'net'
import { join } from 'path'
import type { Readable } from 'stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib'
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

// ---------------------------------------------------------------------------
// Outbound fetch of staff-supplied reference URLs.
//
// Only public http(s) destinations are allowed: every address the hostname
// resolves to (checked at connect time, so DNS rebinding cannot swap in a
// private address) must be outside loopback, private, link-local, CGNAT,
// unique-local, multicast, documentation and unspecified ranges, IPv4 and
// IPv6 (including IPv4-mapped, NAT64 and 6to4 forms). Redirects are followed
// by hand (max 3 hops), each hop re-validated. Total time and size are capped.
// Callers only ever see a generic error; details go to the server log.
// ---------------------------------------------------------------------------

const REFERENCE_FETCH_TIMEOUT_MS = 20_000
const REFERENCE_MAX_BYTES = 25 * 1024 * 1024
const REFERENCE_MAX_REDIRECTS = 3
const REFERENCE_FETCH_FAILED =
  'Could not download the reference image. Use a public http(s) image URL or pick an image from the media library.'

class BlockedDestinationError extends Error {
  code = 'EBLOCKEDDESTINATION'
}

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    out.push(n)
  }
  return out
}

function isBlockedIPv4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // 0.0.0.0/8 "this network" / unspecified
    a === 10 || // 10/8 private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
    (a === 169 && b === 254) || // link-local (incl. cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
    (a === 192 && b === 168) || // 192.168/16 private
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF assignments, TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast, reserved, broadcast
  )
}

/** Expand an IPv6 address into eight 16-bit groups, or null if malformed. */
function expandIPv6(input: string): number[] | null {
  let ip = input.split('%')[0].toLowerCase()
  // Trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) -> two hex groups.
  const lastColon = ip.lastIndexOf(':')
  const tail = ip.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail)
    if (!v4) return null
    const hi = ((v4[0] << 8) | v4[1]).toString(16)
    const lo = ((v4[2] << 8) | v4[3]).toString(16)
    ip = `${ip.slice(0, lastColon + 1)}${hi}:${lo}`
  }
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const parse = (part: string) => (part === '' ? [] : part.split(':'))
  const head = parse(halves[0])
  const rest = halves.length === 2 ? parse(halves[1]) : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const fill: string[] = halves.length === 2 ? Array(missing).fill('0') : []
  const out: number[] = []
  for (const g of [...head, ...fill, ...rest]) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out.length === 8 ? out : null
}

function embeddedIPv4(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]
}

function isBlockedIPv6(h: number[]): boolean {
  const firstFiveZero = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0
  if (firstFiveZero && h[5] === 0) return true // ::, ::1 and deprecated IPv4-compatible ::/96
  if (firstFiveZero && h[5] === 0xffff) return isBlockedIPv4(embeddedIPv4(h[6], h[7])) // IPv4-mapped
  if (h[0] === 0x64 && h[1] === 0xff9b) {
    if (h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
      return isBlockedIPv4(embeddedIPv4(h[6], h[7])) // NAT64 64:ff9b::/96
    }
    return true // 64:ff9b:1::/48 local-use NAT64
  }
  if (h[0] === 0x2002) return isBlockedIPv4(embeddedIPv4(h[1], h[2])) // 6to4
  if (h[0] === 0x2001 && h[1] === 0) return true // Teredo
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true // documentation
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true // discard 100::/64
  if ((h[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((h[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true // fec0::/10 site-local (deprecated)
  if ((h[0] & 0xff00) === 0xff00) return true // multicast
  return false
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    const v4 = parseIPv4(address)
    return !v4 || isBlockedIPv4(v4)
  }
  if (version === 6) {
    const v6 = expandIPv6(address)
    return !v6 || isBlockedIPv6(v6)
  }
  return true
}

/**
 * DNS lookup used for the actual connection: resolves all addresses and
 * refuses the connection if any of them is non-public.
 */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses: LookupAddress[]) => {
    if (err) {
      callback(err, '')
      return
    }
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      callback(new BlockedDestinationError(`non-public address for ${hostname}`), '')
      return
    }
    const wanted = options.family === 4 || options.family === 6 ? options.family : 0
    const usable = wanted ? addresses.filter((a) => a.family === wanted) : addresses
    if (usable.length === 0) {
      const e: NodeJS.ErrnoException = new Error(`no usable address for ${hostname}`)
      e.code = 'ENOTFOUND'
      callback(e, '')
      return
    }
    if (options.all) callback(null, usable)
    else callback(null, usable[0].address, usable[0].family)
  })
}

/** Parse and pre-check one hop's URL. Throws BlockedDestinationError. */
function assertFetchableUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new BlockedDestinationError('invalid URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BlockedDestinationError(`scheme ${u.protocol} not allowed`)
  }
  if (u.username || u.password) {
    throw new BlockedDestinationError('credentials in URL not allowed')
  }
  // Literal IPs skip DNS (and therefore the connect-time lookup check).
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && isBlockedAddress(host)) {
    throw new BlockedDestinationError('non-public IP literal')
  }
  return u
}

type HopResult =
  | { kind: 'redirect'; location: string }
  | { kind: 'body'; buffer: Buffer; contentType: string | null }

function requestOnce(u: URL, deadline: number): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      reject(new Error('timeout'))
      return
    }
    // Hard deadline for the whole hop, including a slow trickling body.
    const timer = setTimeout(() => req.destroy(new Error('timeout')), remaining)
    const fail = (e: unknown) => {
      clearTimeout(timer)
      reject(e)
    }
    const succeed = (r: HopResult) => {
      clearTimeout(timer)
      resolve(r)
    }

    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request(
      u,
      {
        method: 'GET',
        agent: false, // fresh connection per hop, always through publicOnlyLookup
        lookup: publicOnlyLookup,
        headers: {
          'User-Agent': 'UntamedReferenceMirror/1.0',
          Accept: 'image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume()
          const location = res.headers.location
          if (!location) {
            fail(new Error(`redirect ${status} without location`))
            return
          }
          let next: string
          try {
            next = new URL(location, u).toString()
          } catch {
            fail(new Error('invalid redirect location'))
            return
          }
          succeed({ kind: 'redirect', location: next })
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          fail(new Error(`upstream status ${status}`))
          return
        }
        const declared = Number(res.headers['content-length'])
        if (Number.isFinite(declared) && declared > REFERENCE_MAX_BYTES) {
          res.destroy()
          fail(new Error('response too large'))
          return
        }

        const encoding = String(res.headers['content-encoding'] || '').toLowerCase().trim()
        let stream: Readable = res
        if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(createGunzip())
        else if (encoding === 'deflate') stream = res.pipe(createInflate())
        else if (encoding === 'br') stream = res.pipe(createBrotliDecompress())

        const chunks: Buffer[] = []
        let total = 0
        let tooLarge = false
        stream.on('data', (chunk: Buffer) => {
          if (tooLarge) return
          total += chunk.length
          if (total > REFERENCE_MAX_BYTES) {
            tooLarge = true
            res.destroy()
            stream.destroy()
            fail(new Error('response too large'))
            return
          }
          chunks.push(chunk)
        })
        stream.on('end', () => {
          if (tooLarge) return
          const ct = res.headers['content-type']
          succeed({ kind: 'body', buffer: Buffer.concat(chunks), contentType: ct ?? null })
        })
        stream.on('error', fail)
        res.on('error', fail)
      }
    )
    req.on('error', fail)
    req.end()
  })
}

async function downloadReferenceViaHttp(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const deadline = Date.now() + REFERENCE_FETCH_TIMEOUT_MS
  let current = url.trim()
  try {
    for (let hop = 0; hop <= REFERENCE_MAX_REDIRECTS; hop++) {
      const u = assertFetchableUrl(current)
      const result = await requestOnce(u, deadline)
      if (result.kind === 'redirect') {
        current = result.location
        continue
      }
      const contentType =
        result.contentType?.split(';')[0]?.trim() || guessContentTypeFromPath(u.pathname)
      return { buffer: result.buffer, contentType }
    }
    throw new Error('too many redirects')
  } catch (e) {
    // Log the detail server-side only; never hand status codes, connection
    // errors or the URL back to the caller.
    console.warn('[fal-reference-mirror] reference download failed', {
      url: url.slice(0, 200),
      lastHop: current.slice(0, 200),
      error: errorChain(e),
    })
    throw new Error(REFERENCE_FETCH_FAILED)
  }
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
          } catch {
            // downloadReferenceViaHttp already logged the URL failure.
            throw new Error(
              `Reference image: S3 "${explicitKey}" failed (${errorChain(s3Err)}); ${REFERENCE_FETCH_FAILED}`
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
