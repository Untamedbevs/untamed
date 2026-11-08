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
