/**
 * Signed email links: unsubscribe and permission-confirm tokens.
 *
 * Tokens are HMAC-SHA256 signed with `CRON_SECRET` so they can't be guessed
 * or modified. Encoded as base64url for safe inclusion in URLs and headers.
 *
 * Unsubscribe payload: { e: email, c: campaignId|null, v: 1 }  (never expires;
 *   recipients may unsubscribe months later, and links already sent must work)
 * Confirm payload:     { e, c, a: 'consumer'|'trade', x: expiresAtUnix, v: 1 }
 *
 * Confirm tokens are signed over a 'confirm:' prefix, so neither kind of token
 * can be replayed as the other.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { getSiteOrigin } from '@/lib/email/config'

interface UnsubscribePayload {
  e: string
  c?: string | null
  v: 1
}

export interface ConfirmPayload {
  e: string
  c: string | null
  a: 'consumer' | 'trade'
  x: number
  v: 1
}

/** Permission-request links stay valid for 90 days. */
const CONFIRM_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60

function getSecret(): string {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw new Error('CRON_SECRET env var is required for email link signing')
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

function sign(payload: object, prefix: string): string {
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  return `${body}.${hmac(prefix + body)}`
}

function verify(token: string, prefix: string): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [body, sig] = parts
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(hmac(prefix + body))
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body).toString('utf-8'))
    if (!parsed || typeof parsed !== 'object' || typeof parsed.e !== 'string') return null
    return parsed
  } catch {
    return null
  }
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
  return sign(payload, '')
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  return verify(token, '') as UnsubscribePayload | null
}

export function signConfirmToken(
  email: string,
  campaignId: string | null,
  audience: 'consumer' | 'trade'
): string {
  const payload: ConfirmPayload = {
    e: email.toLowerCase().trim(),
    c: campaignId,
    a: audience,
    x: Math.floor(Date.now() / 1000) + CONFIRM_TOKEN_TTL_SECONDS,
    v: 1,
  }
  return sign(payload, 'confirm:')
}

export type ConfirmTokenResult =
  | { ok: true; payload: ConfirmPayload }
  | { ok: false; reason: 'invalid' | 'expired' }

export function verifyConfirmToken(token: string): ConfirmTokenResult {
  const parsed = verify(token, 'confirm:')
  if (!parsed || (parsed.a !== 'consumer' && parsed.a !== 'trade') || typeof parsed.x !== 'number') {
    return { ok: false, reason: 'invalid' }
  }
  if (parsed.x < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' }
  return { ok: true, payload: parsed as unknown as ConfirmPayload }
}

/** "jane@example.com" -> "j***@example.com", for showing on public pages. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 1)}***@${domain}`
}

function resolveOrigin(siteOrigin?: string): string {
  return (siteOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbeverages.com').replace(
    /\/$/,
    ''
  )
}

/**
 * Public unsubscribe page URL for a recipient (the link in the email footer).
 * The page asks for a click to confirm, so mail scanners that open links
 * don't unsubscribe anyone.
 */
export function buildUnsubscribeUrl(
  email: string,
  campaignId?: string | null,
  siteOrigin?: string
): string {
  const token = signUnsubscribeToken(email, campaignId)
  return `${resolveOrigin(siteOrigin)}/unsubscribe?t=${encodeURIComponent(token)}`
}

export function buildConfirmUrl(
  email: string,
  campaignId: string | null,
  audience: 'consumer' | 'trade',
  siteOrigin?: string
): string {
  const origin = resolveOrigin(siteOrigin)
  const token = signConfirmToken(email, campaignId, audience)
  return `${origin}/email/confirm?t=${encodeURIComponent(token)}`
}

/**
 * Preference-center token: identifies the recipient on /email/preferences.
 * Signed over a 'manage:' prefix; like unsubscribe links, it doesn't expire.
 */
export function signManageToken(email: string): string {
  return sign({ e: email.toLowerCase().trim(), v: 1 }, 'manage:')
}

export function verifyManageToken(token: string): { e: string } | null {
  const parsed = verify(token, 'manage:')
  return parsed ? { e: String(parsed.e) } : null
}

export function buildPreferencesUrl(email: string, siteOrigin?: string): string {
  const origin = resolveOrigin(siteOrigin)
  return `${origin}/email/preferences?t=${encodeURIComponent(signManageToken(email))}`
}

/**
 * Build the RFC 8058 / 2369 List-Unsubscribe headers for an email.
 *
 * Returns:
 * - `List-Unsubscribe`: `<https://.../api/unsubscribe?t=...>, <mailto:unsubscribe@...>`
 * - `List-Unsubscribe-Post`: `List-Unsubscribe=One-Click` (Gmail/Yahoo one-click)
 *
 * The HTTPS target accepts the one-click POST directly. The mailto fallback
 * goes to `unsubscribe@untamedbeverages.com`, which the Gmail sync processes
 * automatically once configured (see docs/email/gmail-and-outreach.md).
 */
export function buildListUnsubscribeHeaders(
  email: string,
  campaignId?: string | null,
  siteOrigin?: string
): { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string } {
  const token = signUnsubscribeToken(email, campaignId)
  const url = `${resolveOrigin(siteOrigin)}/api/unsubscribe?t=${encodeURIComponent(token)}`
  const mailto = `unsubscribe@untamedbeverages.com?subject=${encodeURIComponent(
    `unsubscribe ${email}`
  )}`
  return {
    'List-Unsubscribe': `<${url}>, <mailto:${mailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
