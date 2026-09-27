import { NextRequest, NextResponse } from 'next/server'
import {
  MagicLinkError,
  sendPortalMagicLink,
} from '@/lib/auth/send-portal-magic-link'

export const dynamic = 'force-dynamic'

const META_KEYS = ['first_name', 'favorite_drink_slug', 'visitor_id'] as const

function readMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const src = value as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of META_KEYS) {
    const raw = src[key]
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim().slice(0, 120)
    if (trimmed) out[key] = trimmed
  }
  return out
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : ''
  const returnTo = typeof body?.returnTo === 'string' ? body.returnTo : undefined

  try {
    await sendPortalMagicLink({
      email,
      origin: request.nextUrl.origin,
      returnTo,
      metadata: readMetadata(body?.metadata),
    })
  } catch (err) {
    if (err instanceof MagicLinkError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[magic-link] unexpected', err)
    return NextResponse.json(
      { error: 'Could not send the sign-in email. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
