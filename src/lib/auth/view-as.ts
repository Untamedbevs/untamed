import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { VIEW_AS_COOKIE } from './view-as-cookie'

/**
 * View As: an admin sees the member portal as a specific member, read-only.
 *
 * The session is a signed cookie naming the admin who started it, the member,
 * the portal version to show, and an expiry. resolveMember() honors it only
 * when the signed-in user is that admin and is still an active admin; the
 * middleware refuses every portal write while the cookie is present.
 */

export { VIEW_AS_COOKIE }
const SESSION_SECONDS = 2 * 60 * 60

/** 'current': the portal the member sees today. 'pack-rewards': the staff preview of Pack Rewards on their data. */
export type ViewAsMode = 'current' | 'pack-rewards'
export const VIEW_AS_MODES: ViewAsMode[] = ['current', 'pack-rewards']

export interface ViewAsSession {
  adminAuthUserId: string
  memberId: string
  mode: ViewAsMode
  expiresAt: number
}

function sign(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for View As')
  return createHmac('sha256', secret).update(`view-as:${payload}`).digest('base64url')
}

function encode(session: ViewAsSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function decode(value: string): ViewAsSession | null {
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ViewAsSession
    if (!VIEW_AS_MODES.includes(session.mode) || session.expiresAt < Date.now()) return null
    return session
  } catch {
    return null
  }
}

export async function startViewAs(adminAuthUserId: string, memberId: string, mode: ViewAsMode) {
  const jar = await cookies()
  jar.set(VIEW_AS_COOKIE, encode({ adminAuthUserId, memberId, mode, expiresAt: Date.now() + SESSION_SECONDS * 1000 }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
}

export async function endViewAs() {
  const jar = await cookies()
  jar.delete({ name: VIEW_AS_COOKIE, path: '/' })
}

/** The View As session for this signed-in user, if one is valid. Does not check admin status. */
export async function readViewAs(signedInUserId: string): Promise<ViewAsSession | null> {
  const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value
  if (!raw) return null
  const session = decode(raw)
  return session && session.adminAuthUserId === signedInUserId ? session : null
}
