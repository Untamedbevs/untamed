/**
 * Unsubscribe handler.
 *
 * POST does the unsubscribe, from either:
 *   - a mail client's one-click button (RFC 8058: List-Unsubscribe-Post with
 *     body `List-Unsubscribe=One-Click`), which gets a plain 200, or
 *   - the confirm button on /unsubscribe (form field `confirm`), which is
 *     redirected back to the page's success state.
 * GET never changes anything: it forwards to the /unsubscribe confirm page so
 * link scanners that pre-open URLs can't unsubscribe people.
 *
 * The token comes from `?t=` (header links) or the form field `t`.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/messaging/unsubscribe'
import { addSuppression } from '@/lib/messaging/suppressions'
import { applyConsent, requestEvidence } from '@/lib/messaging/consent'
import { getSiteOrigin } from '@/lib/email/config'

async function readForm(request: NextRequest): Promise<URLSearchParams> {
  const type = request.headers.get('content-type') || ''
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    try {
      const form = await request.formData()
      const params = new URLSearchParams()
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') params.set(key, value)
      }
      return params
    } catch {
      return new URLSearchParams()
    }
  }
  return new URLSearchParams()
}

export async function POST(request: NextRequest) {
  const form = await readForm(request)
  const token = form.get('t') || request.nextUrl.searchParams.get('t') || ''
  const fromConfirmPage = form.has('confirm')
  const payload = verifyUnsubscribeToken(token)
  const origin = getSiteOrigin()

  if (!payload) {
    if (fromConfirmPage) {
      return NextResponse.redirect(`${origin}/unsubscribe?status=error`, { status: 303 })
    }
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const evidence = requestEvidence(request.headers)
  const campaignId = payload.c || null

  try {
    await applyConsent({
      email: payload.e,
      action: 'unsubscribe_all',
      source: fromConfirmPage ? 'unsubscribe_link' : 'one_click',
      sourceDetail: campaignId ? `campaign ${campaignId}` : null,
      campaignId,
      ...evidence,
    })
  } catch (err) {
    // Never lose an unsubscribe: fall back to the bare suppression list.
    console.error('[unsubscribe] consent update failed, writing suppression only:', err)
    try {
      await addSuppression({
        email: payload.e,
        reason: 'unsubscribe',
        sourceMessageId: campaignId || undefined,
        notes: campaignId ? `Unsubscribed via campaign ${campaignId}` : 'Unsubscribed via link',
        throwOnError: true,
      })
    } catch (fallbackErr) {
      console.error('[unsubscribe] suppression fallback failed:', fallbackErr)
      if (fromConfirmPage) {
        return NextResponse.redirect(
          `${origin}/unsubscribe?status=error&t=${encodeURIComponent(token)}`,
          { status: 303 }
        )
      }
      return NextResponse.json({ error: 'Could not process unsubscribe' }, { status: 500 })
    }
  }

  if (fromConfirmPage) {
    return NextResponse.redirect(
      `${origin}/unsubscribe?status=ok&t=${encodeURIComponent(token)}`,
      { status: 303 }
    )
  }
  return NextResponse.json({ ok: true })
}

/** Opening the header link in a browser shows the confirm page; nothing changes. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') || ''
  const target = token
    ? `${getSiteOrigin()}/unsubscribe?t=${encodeURIComponent(token)}`
    : `${getSiteOrigin()}/unsubscribe`
  return NextResponse.redirect(target, { status: 303 })
}
