import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

/**
 * Deliberately light gate for the Referral HQ mock-up (demo data only).
 *
 * - Demo mode: any text signs you in. Used on local dev and Vercel preview
 *   deploys so staff can click around without an account.
 * - Credentials mode: when REFERRAL_HQ_USERNAME and REFERRAL_HQ_PASSWORD are
 *   set, only that one login works.
 * - The live production site stays locked (404) unless credentials are set.
 *
 * Real referrers should sign in through the existing Supabase portal auth.
 */

export const HQ_COOKIE = 'ut_hq_session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60
const DEMO_SECRET = 'referral-hq-demo'

type Gate = { mode: 'credentials'; username: string; password: string } | { mode: 'demo' }

function gate(): Gate | null {
  const username = process.env.REFERRAL_HQ_USERNAME
  const password = process.env.REFERRAL_HQ_PASSWORD
  if (username && password) return { mode: 'credentials', username, password }
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview') {
    return { mode: 'demo' }
  }
  return null
}

function secretFor(g: Gate) {
  return g.mode === 'credentials' ? g.password : DEMO_SECRET
}

export function hqEnabled() {
  return gate() !== null
}

export function isDemoLogin() {
  return gate()?.mode === 'demo'
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
  const g = gate()
  if (!g) return false
  if (g.mode === 'demo') return true
  // Evaluate both so a wrong username and a wrong password take the same path.
  const userOk = safeEqual(username.trim().toLowerCase(), g.username.toLowerCase())
  const passOk = safeEqual(password, g.password)
  return userOk && passOk
}

export async function startSession(username: string) {
  const g = gate()
  if (!g) return
  const name = username.trim().toLowerCase() || 'demo'
  const jar = await cookies()
  jar.set(HQ_COOKIE, `${name}.${sign(name, secretFor(g))}`, {
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
  const g = gate()
  if (!g) return null
  const raw = (await cookies()).get(HQ_COOKIE)?.value
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const username = raw.slice(0, dot)
  const signature = raw.slice(dot + 1)
  // A changed username invalidates old sessions even if the password stayed the same.
  if (g.mode === 'credentials' && !safeEqual(username, g.username.toLowerCase())) return null
  return safeEqual(signature, sign(username, secretFor(g))) ? username : null
}
