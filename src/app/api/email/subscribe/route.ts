/**
 * Public email signup (the newsletter form in the footer, homepage, shop, and
 * /subscribe).
 *
 * POST (JSON) starts a double opt-in: it never subscribes anyone directly,
 * and every accepted request gets the same "check your inbox" answer whether
 * or not the address is known or suppressed. The confirmation email is sent
 * after the response.
 *
 * GET returns the active consumer topics and the copy version for the form.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse, after } from 'next/server'
import { requestEvidence } from '@/lib/messaging/consent'
import { createSignupRequest, getPublicSignupLists } from '@/lib/email/signup'
import { SIGNUP_COPY_VERSION } from '@/lib/email/signup-copy'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const result = await createSignupRequest(
      {
        form: 'website',
        email: body.email,
        firstName: body.firstName,
        lists: body.lists,
        ageAttested: body.ageAttested,
        birthdayMonth: body.birthdayMonth,
        birthdayDay: body.birthdayDay,
        timezone: body.timezone,
        placement: body.placement,
        copyVersion: body.copyVersion,
        honeypot: body.website,
        turnstileToken: body.turnstileToken,
      },
      {
        evidence: requestEvidence(request.headers),
        botCheck: true,
        defer: (task) => after(task),
      }
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
  } catch (err) {
    console.error('[email/subscribe] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'We couldn’t sign you up just now. Please try again in a minute.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  try {
    const lists = await getPublicSignupLists()
    return NextResponse.json(
      { lists, copyVersion: SIGNUP_COPY_VERSION },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (err) {
    console.error('[email/subscribe] list lookup failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Signup topics are unavailable right now.' }, { status: 503 })
  }
}
