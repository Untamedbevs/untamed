import { createHash, timingSafeEqual } from 'crypto'

/**
 * True only when CRON_SECRET is set and the request carries it as
 * `Authorization: Bearer <secret>` (Vercel Cron sends exactly that). A missing
 * or empty CRON_SECRET refuses every request instead of skipping the check.
 */
export function isCronAuthorized(request: Request, label: string): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error(`[${label}] CRON_SECRET is not set; refusing request`)
    return false
  }
  // Hash both sides so the comparison is constant-time regardless of length.
  const given = createHash('sha256').update(request.headers.get('authorization') ?? '').digest()
  const expected = createHash('sha256').update(`Bearer ${cronSecret}`).digest()
  return timingSafeEqual(given, expected)
}
