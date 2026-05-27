/**
 * Unsubscribe handler.
 *
 * Accepts both GET (user clicks a link) and POST (Gmail one-click via
 * List-Unsubscribe-Post: List-Unsubscribe=One-Click). On either method we
 * mark the email as suppressed and return success.
 *
 * Token format produced by `signUnsubscribeToken()` (HMAC over `email + campaignId`).
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/messaging/unsubscribe'
import { addSuppression } from '@/lib/messaging/suppressions'

async function handle(request: NextRequest): Promise<{ ok: true; email: string } | { ok: false; error: string; status: number }> {
  const token = request.nextUrl.searchParams.get('t') || ''
  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return { ok: false, error: 'Invalid or expired link', status: 400 }
  }

  try {
    await addSuppression({
      email: payload.e,
      reason: 'unsubscribe',
      sourceMessageId: payload.c || undefined,
      notes: payload.c ? `Unsubscribed via campaign ${payload.c}` : 'Unsubscribed via link',
    })
  } catch (err) {
    console.error('[unsubscribe] addSuppression failed:', err)
    return { ok: false, error: 'Could not process unsubscribe', status: 500 }
  }

  return { ok: true, email: payload.e }
}

/** POST is what Gmail sends for one-click unsubscribe (RFC 8058). */
export async function POST(request: NextRequest) {
  const result = await handle(request)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, email: result.email })
}

/** GET is the fallback path when a user clicks the link in their email. */
export async function GET(request: NextRequest) {
  const result = await handle(request)

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbeverages.com'
  if (!result.ok) {
    return NextResponse.redirect(
      `${origin}/unsubscribe?status=error&msg=${encodeURIComponent(result.error)}`,
      { status: 303 }
    )
  }

  return NextResponse.redirect(
    `${origin}/unsubscribe?status=ok&email=${encodeURIComponent(result.email)}`,
    { status: 303 }
  )
}
