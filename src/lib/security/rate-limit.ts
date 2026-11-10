import { createHash, createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Database-backed rate limits (rate_limit_take, migration 00042). Vercel runs many
 * function instances that share no memory, so the count has to live in the database.
 *
 * Keys are hashed (keyed with IP_HASH_SECRET or CRON_SECRET when set) so the table never
 * holds a raw IP address or email.
 *
 * Fails open: if the database call errors, the request is allowed and the error logged,
 * so a database hiccup never blocks a real customer.
 */

export interface RateLimit {
  /** Name of what is being limited, e.g. 'lead:ip'. */
  bucket: string
  /** Most requests allowed per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

function hashKey(value: string): string {
  const secret = process.env.IP_HASH_SECRET || process.env.CRON_SECRET
  const normalized = value.trim().toLowerCase()
  return secret
    ? createHmac('sha256', secret).update(normalized).digest('hex').slice(0, 32)
    : createHash('sha256').update(normalized).digest('hex').slice(0, 32)
}

/** The visitor's IP address as Vercel reports it, or null when unknown. */
export function clientIp(headers: Headers): string | null {
  const ip = headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]
  const trimmed = ip?.trim()
  return trimmed ? trimmed.slice(0, 64) : null
}

/**
 * Records one request against `rule` for `value` (an IP, email or id). Returns false when
 * the limit is already used up for the current window. A missing value is never limited.
 */
export async function takeRateLimit(rule: RateLimit, value: string | null | undefined): Promise<boolean> {
  if (!value) return true
  try {
    const { data, error } = await createAdminClient().rpc('rate_limit_take', {
      p_bucket: rule.bucket,
      p_key: hashKey(value),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })
    if (error) {
      console.error(`[rate-limit] ${rule.bucket} check failed; allowing:`, error.message)
      return true
    }
    return data !== false
  } catch (err) {
    console.error(`[rate-limit] ${rule.bucket} check failed; allowing:`, err)
    return true
  }
}

/** Takes every rule in order and stops at the first one that is used up. */
export async function takeRateLimits(checks: Array<[RateLimit, string | null | undefined]>): Promise<boolean> {
  for (const [rule, value] of checks) {
    if (!(await takeRateLimit(rule, value))) return false
  }
  return true
}

const HOUR = 60 * 60
const DAY = 24 * HOUR

/** Limits used across the site, in one place so they are easy to adjust. */
export const RATE_LIMITS = {
  /** Retail lead form: per visitor IP, and per submitted email. */
  leadPerIp: { bucket: 'lead:ip', limit: 10, windowSeconds: HOUR },
  leadPerEmail: { bucket: 'lead:email', limit: 3, windowSeconds: HOUR },
  /** Creator application form. */
  influencerPerIp: { bucket: 'influencer:ip', limit: 5, windowSeconds: HOUR },
  influencerPerEmail: { bucket: 'influencer:email', limit: 3, windowSeconds: DAY },
  /**
   * Sign-in emails sent from one visitor IP, across all addresses. Each address also has its
   * own 5-an-hour cap (send-portal-magic-link.ts). 20 an hour leaves room for a shared office
   * or event Wi-Fi network.
   */
  signInPerIp: { bucket: 'signin:ip', limit: 20, windowSeconds: HOUR },
  /** Large (multipart) uploads started by one member. */
  largeUploadPerMember: { bucket: 'upload:multipart', limit: 30, windowSeconds: HOUR },
} satisfies Record<string, RateLimit>
