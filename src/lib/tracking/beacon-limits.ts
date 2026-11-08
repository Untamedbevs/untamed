import { createHash, createHmac } from 'crypto'
// Size limits for the anonymous tracking beacons (/api/tracking/event,
// /pageview, /session). The real client sends crypto.randomUUID ids and short
// strings, so these limits never touch a legitimate beacon; they stop one
// anonymous request from persisting megabytes into the shared database.

/** Largest beacon body we will parse. Real beacons are a few hundred bytes. */
export const MAX_BEACON_BYTES = 16 * 1024

export const LIMITS = {
  id: 64, // visitor and session ids (the client uses 36-char UUIDs)
  url: 2048, // landing page, referrer, page url, page path
  title: 300,
  utm: 200,
  device: 64,
  userAgent: 512,
  eventData: 4096, // serialized JSON
} as const

/** Rejects bodies whose declared size is over the cap, before parsing. */
export function beaconTooLarge(contentLength: string | null): boolean {
  if (!contentLength) return false
  const n = Number(contentLength)
  return Number.isFinite(n) && n > MAX_BEACON_BYTES
}

/**
 * Reads and parses a beacon body, stopping at MAX_BEACON_BYTES even when the
 * request has no Content-Length (chunked), so an oversized body is never
 * buffered whole. Returns { tooLarge: true } past the cap and { body: null }
 * for invalid JSON.
 */
export async function readBeaconJson(
  request: Request
): Promise<{ tooLarge: true } | { tooLarge: false; body: unknown }> {
  if (beaconTooLarge(request.headers.get('content-length'))) return { tooLarge: true }
  if (!request.body) return { tooLarge: false, body: null }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BEACON_BYTES) {
      await reader.cancel().catch(() => undefined)
      return { tooLarge: true }
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.byteLength
  }
  try {
    return { tooLarge: false, body: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return { tooLarge: false, body: null }
  }
}

/**
 * Short, keyed hash of a client IP for analytics columns named ip_hash. A
 * plain SHA-256 of an IPv4 address can be reversed by trying every address,
 * so it is keyed with a server secret (IP_HASH_SECRET, else CRON_SECRET).
 */
export function hashIp(ip: string): string {
  const key = process.env.IP_HASH_SECRET || process.env.CRON_SECRET || ''
  return key
    ? createHmac('sha256', key).update(ip).digest('hex').slice(0, 16)
    : createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

/** A non-empty id within the length limit, or null. */
export function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v && v.length <= LIMITS.id ? v : null
}

/** A string cut to `max` characters, or null when not a non-empty string. */
export function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || !value) return null
  return value.slice(0, max)
}

/** The event data object, or an empty object when it is missing or too large. */
export function boundedEventData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  try {
    return JSON.stringify(value).length <= LIMITS.eventData ? (value as Record<string, unknown>) : { truncated: true }
  } catch {
    return {}
  }
}
