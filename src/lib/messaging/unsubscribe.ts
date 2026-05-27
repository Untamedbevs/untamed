/**
 * Unsubscribe token signing + URL building.
 *
 * Tokens are HMAC-SHA256 signed with `CRON_SECRET` so they can't be guessed
 * or modified. Encoded as base64url for safe inclusion in URLs and headers.
 *
 * Payload: { e: email, c: campaignId|null, v: 1 }
 */

import { createHmac, timingSafeEqual } from 'crypto'

interface UnsubscribePayload {
  e: string
  c?: string | null
  v: 1
}

function getSecret(): string {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw new Error('CRON_SECRET env var is required for unsubscribe signing')
  }
  return secret
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function hmac(payload: string): string {
  return base64UrlEncode(createHmac('sha256', getSecret()).update(payload).digest())
}

/**
 * Create an unsubscribe token for the given email + optional campaign.
 * Tokens do not expire (recipients may unsubscribe months later).
 */
export function signUnsubscribeToken(email: string, campaignId?: string | null): string {
  const payload: UnsubscribePayload = {
    e: email.toLowerCase().trim(),
    c: campaignId || null,
    v: 1,
  }
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const sig = hmac(body)
  return `${body}.${sig}`
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [body, sig] = parts
  const expected = hmac(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body).toString('utf-8'))
    if (!parsed || typeof parsed !== 'object' || typeof parsed.e !== 'string') return null
    return parsed as UnsubscribePayload
  } catch {
    return null
  }
}

/**
 * Build the public unsubscribe URL for a recipient.
 * Site origin is resolved from `NEXT_PUBLIC_SITE_URL` (set in env for prod).
 */
export function buildUnsubscribeUrl(
  email: string,
  campaignId?: string | null,
  siteOrigin?: string
): string {
  const origin =
    siteOrigin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://untamedbeverages.com'
  const token = signUnsubscribeToken(email, campaignId)
  return `${origin.replace(/\/$/, '')}/unsubscribe?t=${encodeURIComponent(token)}`
}

/**
 * Build the RFC 8058 / 2369 List-Unsubscribe headers for an email.
 *
 * Returns:
 * - `List-Unsubscribe`: `<https://...>, <mailto:unsubscribe@...>`
 * - `List-Unsubscribe-Post`: `List-Unsubscribe=One-Click` (for Gmail one-click)
 *
 * The mailto fallback goes to `unsubscribe@untamedbeverages.com`. That address
 * is monitored manually for now; AWS-SES doesn't auto-handle mailto unsubs.
 */
export function buildListUnsubscribeHeaders(
  email: string,
  campaignId?: string | null,
  siteOrigin?: string
): { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string } {
  const url = buildUnsubscribeUrl(email, campaignId, siteOrigin)
  const mailto = `unsubscribe@untamedbeverages.com?subject=${encodeURIComponent(
    `unsubscribe ${email}`
  )}`
  return {
    'List-Unsubscribe': `<${url}>, <mailto:${mailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
