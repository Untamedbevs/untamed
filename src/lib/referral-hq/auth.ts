import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

/**
 * Deliberately simple username/password gate for the Referral HQ mock-up.
 * One shared login, checked against env vars, with an HMAC-signed cookie.
 * Real referrers should sign in through the existing Supabase portal auth.
 */

export const HQ_COOKIE = 'ut_hq_session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60

// Local-only fallback so the mock-up works without touching .env.local.
// Production never falls back: without both env vars the HQ stays locked.
const DEV_USERNAME = 'wildone'
const DEV_PASSWORD = 'untamed'

function credentials(): { username: string; password: string } | null {
  const username = process.env.REFERRAL_HQ_USERNAME
  const password = process.env.REFERRAL_HQ_PASSWORD
  if (username && password) return { username, password }
  if (process.env.NODE_ENV !== 'production') {
    return { username: DEV_USERNAME, password: DEV_PASSWORD }
  }
  return null
}

export function hqEnabled() {
  return credentials() !== null
}

function sign(username: string, secret: string) {
  return createHmac('sha256', secret).update(`referral-hq:${username}`).digest('hex')
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function checkCredentials(username: string, password: string) {
  const creds = credentials()
  if (!creds) return false
  // Evaluate both so a wrong username and a wrong password take the same path.
  const userOk = safeEqual(username.trim().toLowerCase(), creds.username.toLowerCase())
  const passOk = safeEqual(password, creds.password)
  return userOk && passOk
}

export async function startSession(username: string) {
  const creds = credentials()
  if (!creds) return
  const jar = await cookies()
  jar.set(HQ_COOKIE, `${username}.${sign(username, creds.password)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/referral-hq',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function endSession() {
  const jar = await cookies()
  jar.delete({ name: HQ_COOKIE, path: '/referral-hq' })
}

/** Returns the signed-in username, or null. */
export async function getSessionUser() {
  const creds = credentials()
  if (!creds) return null
  const raw = (await cookies()).get(HQ_COOKIE)?.value
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const username = raw.slice(0, dot)
  const signature = raw.slice(dot + 1)
  // A changed username invalidates old sessions even if the password stayed the same.
  if (!safeEqual(username, creds.username.toLowerCase())) return null
  return safeEqual(signature, sign(username, creds.password)) ? username : null
}
