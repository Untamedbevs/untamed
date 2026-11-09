import { createHash, timingSafeEqual } from 'crypto'

/**
 * Checks `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends exactly
 * that), in constant time.
 *
 * While CRON_SECRET is unset the request is allowed and a warning is logged,
 * which is how these routes behaved before the security fixes. Setting
 * CRON_SECRET in Vercel turns the check on with no code change.
 */
export function isCronAuthorized(request: Request, label: string): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn(`[${label}] CRON_SECRET is not set; allowing the request. Set it in Vercel to require it.`)
    return true
  }
  // Hash both sides so the comparison is constant-time regardless of length.
  const given = createHash('sha256').update(request.headers.get('authorization') ?? '').digest()
  const expected = createHash('sha256').update(`Bearer ${cronSecret}`).digest()
  return timingSafeEqual(given, expected)
}
