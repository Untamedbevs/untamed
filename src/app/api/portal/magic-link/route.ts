import { NextRequest, NextResponse, after } from 'next/server'
import {
  MagicLinkError,
  sendPortalMagicLink,
} from '@/lib/auth/send-portal-magic-link'
import { requestEmbeddedSignup } from '@/lib/email/signup'

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
  const metadata = readMetadata(body?.metadata)

  try {
    await sendPortalMagicLink({
      email,
      origin: request.nextUrl.origin,
      returnTo,
      metadata,
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

  // The join form's separate "email me news" box: starts a double opt-in.
  // Never fails the sign-in request.
  if (body?.emailSignup) {
    await requestEmbeddedSignup({
      form: 'join',
      email,
      firstName: metadata.first_name,
      optIn: body.emailSignup,
      headers: request.headers,
      defer: (task) => after(task),
    })
  }

  return NextResponse.json({ ok: true })
}
