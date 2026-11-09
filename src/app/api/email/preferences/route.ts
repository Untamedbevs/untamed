/**
 * Preference center changes (/email/preferences).
 *
 * Form POSTs carry the signed manage token (`t`) and an `action`:
 *   topics           turn lists on (opt_in, with the preference-page wording
 *                    and, for 21+ lists, the 21+ attestation) and off (opt_out)
 *   pause / resume   pause all marketing for 30 or 90 days, or end a pause
 *   birthday         save or clear the month and day
 *   unsubscribe_all  stop all marketing (suppression)
 * and redirect back to the page with a status.
 *
 * A JSON POST with action 'send_link' emails a manage link. It answers the
 * same way whether or not the address is known, sends only to existing,
 * mailable contacts, at most 3 links an hour per address, after the response.
 *
 * GET never changes anything; it forwards to the page.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyConsent, requestEvidence } from '@/lib/messaging/consent'
import { addSuppression } from '@/lib/messaging/suppressions'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { renderEmailLayout } from '@/lib/messaging/marketing-email'
import {
  buildPreferencesUrl,
  buildUnsubscribeUrl,
  verifyManageToken,
} from '@/lib/messaging/unsubscribe'
import { renderBlocks } from '@/lib/email/blocks'
import { getSiteOrigin } from '@/lib/email/config'
import { verifyTurnstile } from '@/lib/email/turnstile'
import {
  getSuppressionReason,
  isBlockingSuppression,
  normalizeEmail,
  readBirthday,
  type Evidence,
} from '@/lib/email/signup'
import {
  PREFERENCES_CONSENT_TEXT,
  PREFERENCES_LINK_EMAIL,
  SIGNUP_AGE_TEXT,
  SIGNUP_COPY_VERSION,
} from '@/lib/email/signup-copy'
import { isReceiving, loadPreferenceState } from '@/app/email/preferences/state'

const SOURCE_DETAIL = '/email/preferences'
const LINK_TEMPLATE = 'preferences-link'
const MAX_LINKS_PER_HOUR = 3
const DAY_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const type = request.headers.get('content-type') || ''
  if (type.includes('application/json')) return sendLink(request)
  return updatePreferences(request)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')
  return NextResponse.redirect(
    `${getSiteOrigin()}/email/preferences${token ? `?t=${encodeURIComponent(token)}` : ''}`,
    { status: 303 }
  )
}

// ---------------------------------------------------------------------------
// Changes from the page
// ---------------------------------------------------------------------------

function emailFromManageToken(token: string): string | null {
  try {
    return normalizeEmail(verifyManageToken(token)?.e)
  } catch {
    return null
  }
}

async function updatePreferences(request: NextRequest) {
  const origin = getSiteOrigin()
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.redirect(`${origin}/email/preferences?status=invalid`, { status: 303 })
  }

  const token = String(form.get('t') || '')
  const email = emailFromManageToken(token)
  if (!email) {
    return NextResponse.redirect(`${origin}/email/preferences?status=invalid`, { status: 303 })
  }

  const back = (status: string) =>
    NextResponse.redirect(
      `${origin}/email/preferences?t=${encodeURIComponent(token)}&status=${status}`,
      { status: 303 }
    )
  const evidence = requestEvidence(request.headers)
  const action = String(form.get('action') || '')

  try {
    switch (action) {
      case 'topics':
        return back(await saveTopics(email, form, evidence))
      case 'pause':
        return back(await setPause(email, Number(form.get('days'))))
      case 'resume':
        return back(await setPause(email, 0))
      case 'birthday':
        return back(await saveBirthday(email, form.get('month'), form.get('day')))
      case 'unsubscribe_all':
        return back(await unsubscribeAll(email, evidence))
      default:
        return back('failed')
    }
  } catch (err) {
    console.error(`[email/preferences] ${action} failed:`, err instanceof Error ? err.message : err)
    return back('failed')
  }
}

async function saveTopics(email: string, form: FormData, evidence: Evidence): Promise<string> {
  const state = await loadPreferenceState(email)
  if (state.blocked) return 'blocked'

  const wanted = new Set(form.getAll('list').map(String))
  const ageTicked = form.get('age') === 'yes'
  const newAge = ageTicked && !state.ageVerified

  const optOut = state.lists.filter((l) => l.subscribed && !wanted.has(l.slug))
  // Turned on now, or (with a first 21+ attestation) 21+ topics they kept on.
  const optIn = state.lists.filter(
    (l) =>
      wanted.has(l.slug) && (!isReceiving(state, l) || (newAge && l.requires_age_verification))
  )
  const optInNeedsAge = optIn.some((l) => l.requires_age_verification)
  if (optInNeedsAge && !state.ageVerified && !ageTicked) return 'age_required'

  if (optOut.length > 0) {
    await applyConsent({
      email,
      action: 'opt_out',
      source: 'preference_page',
      lists: optOut.map((l) => l.slug),
      sourceDetail: SOURCE_DETAIL,
      ...evidence,
    })
  }
  if (optIn.length > 0) {
    const ageAttested = newAge && optInNeedsAge
    await applyConsent({
      email,
      action: 'opt_in',
      source: 'preference_page',
      lists: optIn.map((l) => l.slug),
      sourceDetail: SOURCE_DETAIL,
      consentText: PREFERENCES_CONSENT_TEXT,
      consentTextVersion: SIGNUP_COPY_VERSION,
      ageAttested,
      ageText: ageAttested ? SIGNUP_AGE_TEXT : null,
      ...evidence,
    })
  }
  return 'saved'
}

async function contactIdFor(email: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_contacts')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error(`Contact lookup failed: ${error.message}`)
  return (data?.id as string | undefined) || null
}

/** days = 0 ends a pause. */
async function setPause(email: string, days: number): Promise<string> {
  if (days !== 0 && days !== 30 && days !== 90) return 'failed'
  const contactId = await contactIdFor(email)
  if (!contactId) return 'no_contact'
  const admin = createAdminClient()
  const { error } = await admin
    .from('email_contacts')
    .update({
      marketing_paused_until: days ? new Date(Date.now() + days * DAY_MS).toISOString() : null,
    })
    .eq('id', contactId)
  if (error) throw new Error(`Saving pause failed: ${error.message}`)
  return days ? 'paused' : 'resumed'
}

async function saveBirthday(email: string, month: unknown, day: unknown): Promise<string> {
  const birthday = readBirthday(month, day)
  if (birthday === 'invalid') return 'birthday_invalid'
  const contactId = await contactIdFor(email)
  if (!contactId) return 'no_contact'
  const admin = createAdminClient()
  const { error } = await admin
    .from('email_contacts')
    .update({ birthday_month: birthday?.month ?? null, birthday_day: birthday?.day ?? null })
    .eq('id', contactId)
  if (error) throw new Error(`Saving birthday failed: ${error.message}`)
  return 'birthday'
}

async function unsubscribeAll(email: string, evidence: Evidence): Promise<string> {
  try {
    await applyConsent({
      email,
      action: 'unsubscribe_all',
      source: 'preference_page',
      sourceDetail: SOURCE_DETAIL,
      ...evidence,
    })
  } catch (err) {
    // Never lose an unsubscribe: fall back to the bare suppression list.
    console.error('[email/preferences] unsubscribe consent failed, writing suppression only:', err)
    await addSuppression({
      email,
      reason: 'unsubscribe',
      notes: 'Unsubscribed on the preference page',
      throwOnError: true,
    })
  }
  return 'unsubscribed'
}

// ---------------------------------------------------------------------------
// "Email me a link"
// ---------------------------------------------------------------------------

async function sendLink(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || body.action !== 'send_link') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  // Bots get the normal answer so they learn nothing.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const { ipAddress } = requestEvidence(request.headers)
  if (!(await verifyTurnstile(body.turnstileToken, ipAddress))) {
    return NextResponse.json(
      { error: 'Please complete the verification check and try again.' },
      { status: 400 }
    )
  }

  after(() => sendPreferencesLink(email))
  return NextResponse.json({ ok: true })
}

/** Existing, mailable contacts only, rate-limited. Never throws. */
async function sendPreferencesLink(email: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: contact, error } = await admin
      .from('email_contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (error) throw new Error(`Contact lookup failed: ${error.message}`)
    if (!contact) return
    if (isBlockingSuppression(await getSuppressionReason(email))) return

    const { count, error: countError } = await admin
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_email', email)
      .eq('template_slug', LINK_TEMPLATE)
      .gte('sent_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    if (countError) throw new Error(`Rate-limit count failed: ${countError.message}`)
    if ((count || 0) >= MAX_LINKS_PER_HOUR) {
      console.warn('[email/preferences] link limit reached; not sent')
      return
    }

    const c = PREFERENCES_LINK_EMAIL
    const content = renderBlocks(
      [
        { type: 'heading', text: c.heading },
        { type: 'text', text: c.body },
      ],
      {}
    )
    const { html, text } = renderEmailLayout({
      contentHtml: content.html,
      contentText: content.text,
      recipientEmail: email,
      unsubscribeUrl: buildUnsubscribeUrl(email),
      reason: c.reason,
      cta: { label: c.ctaLabel, url: buildPreferencesUrl(email), noTrack: true },
      kind: 'transactional',
    })
    await sendAndLogEmail({
      to: email,
      subject: c.subject,
      html,
      text,
      stream: 'transactional',
      fromAlias: 'loyalty',
      templateSlug: LINK_TEMPLATE,
      contactId: contact.id as string,
    })
  } catch (err) {
    console.error('[email/preferences] link not sent:', err instanceof Error ? err.message : err)
  }
}
