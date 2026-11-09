/**
 * Records an opt-in from the one-time permission request.
 *
 * POST from the /email/confirm form: verifies the signed link, requires the
 * 21+ attestation for consumer lists, and records the exact wording shown,
 * its version, the time, IP, browser, and country as consent evidence.
 * GET never changes anything; it forwards to the confirm page.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyConfirmToken } from '@/lib/messaging/unsubscribe'
import { applyConsent, requestEvidence } from '@/lib/messaging/consent'
import { REPERMISSION_COPY, REPERMISSION_COPY_VERSION } from '@/lib/email/consent-copy'
import { getSiteOrigin } from '@/lib/email/config'

export async function POST(request: NextRequest) {
  const origin = getSiteOrigin()
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.redirect(`${origin}/email/confirm?status=error`, { status: 303 })
  }

  const token = String(form.get('t') || '')
  const back = (status: string) =>
    NextResponse.redirect(
      `${origin}/email/confirm?status=${status}${token ? `&t=${encodeURIComponent(token)}` : ''}`,
      { status: 303 }
    )

  const verified = verifyConfirmToken(token)
  if (!verified.ok) return back(verified.reason === 'expired' ? 'expired' : 'error')

  const { payload } = verified
  const copy = REPERMISSION_COPY[payload.a]
  const ageAttested = form.get('age') === 'yes'
  if (copy.ageText && !ageAttested) return back('age_required')

  try {
    await applyConsent({
      email: payload.e,
      action: 'opt_in',
      source: 'repermission_email',
      lists: copy.lists,
      sourceDetail: '/email/confirm',
      consentText: copy.consentText,
      consentTextVersion: REPERMISSION_COPY_VERSION,
      campaignId: payload.c,
      ageAttested: Boolean(copy.ageText && ageAttested),
      ageText: copy.ageText,
      ...requestEvidence(request.headers),
    })
  } catch (err) {
    console.error('[email/confirm] consent record failed:', err)
    return back('failed')
  }

  return NextResponse.redirect(`${origin}/email/confirm?status=ok&a=${payload.a}`, { status: 303 })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')
  return NextResponse.redirect(
    `${getSiteOrigin()}/email/confirm${token ? `?t=${encodeURIComponent(token)}` : ''}`,
    { status: 303 }
  )
}
