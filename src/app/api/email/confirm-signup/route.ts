/**
 * Confirms a website signup (double opt-in).
 *
 * POST from the /email/confirm-signup button records the opt-in with the
 * evidence captured at signup. GET never changes anything; it forwards to
 * the confirm page, so mail scanners that open links can't subscribe anyone.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requestEvidence } from '@/lib/messaging/consent'
import { confirmSignupRequest } from '@/lib/email/signup'
import { getSiteOrigin } from '@/lib/email/config'

export async function POST(request: NextRequest) {
  const origin = getSiteOrigin()
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.redirect(`${origin}/email/confirm-signup?status=invalid`, { status: 303 })
  }

  const token = String(form.get('t') || '')
  const result = await confirmSignupRequest(token, requestEvidence(request.headers))
  const status =
    result.status === 'confirmed' || result.status === 'already_confirmed' ? 'ok' : result.status

  return NextResponse.redirect(
    `${origin}/email/confirm-signup?status=${status}${token ? `&t=${encodeURIComponent(token)}` : ''}`,
    { status: 303 }
  )
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')
  return NextResponse.redirect(
    `${getSiteOrigin()}/email/confirm-signup${token ? `?t=${encodeURIComponent(token)}` : ''}`,
    { status: 303 }
  )
}
