/**
 * Website email signups with double opt-in.
 *
 * createSignupRequest() checks a signup (address, lists, 21+ attestation,
 * honeypot, Turnstile, rate limits), saves a pending request with the exact
 * wording shown, and emails a confirmation link. The link carries a random
 * token; only its SHA-256 is stored. Nothing is subscribed until the person
 * opens the link and presses confirm, which runs confirmSignupRequest(): the
 * opt-in goes through applyConsent() with the evidence captured at signup.
 *
 * Responses never say whether an address is known, subscribed, or
 * suppressed. Every accepted signup gets the same "check your inbox" answer,
 * and the per-address steps (rate limit, suppression check, saving, sending)
 * can run after the response so its timing doesn't tell either.
 *
 * Schema: email_signup_requests in supabase/migrations/00028_email_platform.sql.
 * Wording: src/lib/email/signup-copy.ts.
 */

import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyConsent, getEmailLists, requestEvidence, type EmailList } from '@/lib/messaging/consent'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { renderEmailLayout } from '@/lib/messaging/marketing-email'
import { buildUnsubscribeUrl } from '@/lib/messaging/unsubscribe'
import { renderBlocks } from '@/lib/email/blocks'
import { getSiteOrigin } from '@/lib/email/config'
import { verifyTurnstile } from '@/lib/email/turnstile'
import {
  SIGNUP_AGE_TEXT,
  SIGNUP_CONFIRM_EMAIL,
  SIGNUP_COPY_VERSION,
  SIGNUP_FORMS,
  type SignupForm,
} from '@/lib/email/signup-copy'

export const MAX_EMAIL_LENGTH = 320
// Same test as the database's email_normalize().
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const HOUR_MS = 60 * 60 * 1000
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 3
const MAX_REQUESTS_PER_IP_PER_HOUR = 20

/**
 * Suppressions a signup can't lift. A plain unsubscribe isn't one of them:
 * confirming a new signup is a fresh opt-in.
 */
export const BLOCKING_SUPPRESSION_REASONS = ['hard_bounce', 'complaint', 'manual', 'data_deletion']

export type Evidence = ReturnType<typeof requestEvidence>
/** Runs work after the response; routes pass next/server's after(). */
export type Defer = (task: () => Promise<void>) => void

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null
  return email
}

/** The address's suppression reason, or null. Throws if the lookup fails. */
export async function getSuppressionReason(email: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_suppressions')
    .select('reason')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error(`Suppression lookup failed: ${error.message}`)
  return (data?.reason as string | undefined) || null
}

export function isBlockingSuppression(reason: string | null): boolean {
  return reason !== null && BLOCKING_SUPPRESSION_REASONS.includes(reason)
}

/** Active consumer lists, for the public signup form's topic checkboxes. */
export async function getPublicSignupLists(): Promise<
  { slug: string; name: string; description: string | null }[]
> {
  const lists = await getEmailLists()
  return lists
    .filter((l) => l.audience === 'consumer')
    .map(({ slug, name, description }) => ({ slug, name, description }))
}

// ---------------------------------------------------------------------------
// Field cleanup
// ---------------------------------------------------------------------------

function cleanFirstName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return name || null
}

/** Where the form was shown, kept in the opt-in's source detail. */
function cleanPlacement(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const placement = value.replace(/[^\w\-/:. ]/g, '').trim().slice(0, 100)
  return placement || null
}

function cleanTimezone(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 64) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return null
  }
}

function cleanCountry(value: string | null): string | null {
  const code = (value || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

/** Days per month; February allows the 29th. */
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Optional birthday (month and day only). Both blank = none; returns
 * 'invalid' when only one is set or the date doesn't exist.
 */
export function readBirthday(
  month: unknown,
  day: unknown
): { month: number; day: number } | null | 'invalid' {
  const blank = (v: unknown) => v === undefined || v === null || v === ''
  if (blank(month) && blank(day)) return null
  const m = Number(month)
  const d = Number(day)
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12) return 'invalid'
  if (d < 1 || d > MONTH_DAYS[m - 1]) return 'invalid'
  return { month: m, day: d }
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function countRecentRequests(column: 'email' | 'ip_address', value: string): Promise<number> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from('email_signup_requests')
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', new Date(Date.now() - HOUR_MS).toISOString())
  if (error) {
    // The insert that follows fails too if the table is unreachable.
    console.error(`[signup] rate-limit count by ${column} failed:`, error.message)
    return 0
  }
  return count || 0
}

// ---------------------------------------------------------------------------
// Signup request
// ---------------------------------------------------------------------------

export interface SignupInput {
  form: SignupForm
  email: unknown
  firstName?: unknown
  /** List slugs the person picked. Omit for every active list of the form's audience. */
  lists?: unknown
  ageAttested?: unknown
  birthdayMonth?: unknown
  birthdayDay?: unknown
  /** Browser time zone (IANA name). */
  timezone?: unknown
  /** Where the form was shown, e.g. 'footer' or '/rewards'. */
  placement?: unknown
  /** SIGNUP_COPY_VERSION the form displayed. */
  copyVersion?: unknown
  /** Hidden field; any value means a bot filled it in. */
  honeypot?: unknown
  turnstileToken?: unknown
}

export interface SignupOptions {
  evidence: Evidence
  /** Honeypot and Turnstile. Off for opt-ins riding on another form, which has its own checks. */
  botCheck: boolean
  /** Runs the per-address work after the response. Default: inline. */
  defer?: Defer
}

export type SignupResult = { ok: true } | { ok: false; status: number; error: string }

interface PendingSignup {
  email: string
  lists: EmailList[]
  firstName: string | null
  sourceDetail: string
  consentText: string
  ageAttested: boolean
  birthday: { month: number; day: number } | null
  timezone: string | null
  evidence: Evidence
}

function fail(status: number, error: string): SignupResult {
  return { ok: false, status, error }
}

/**
 * Check a signup and, if it's acceptable, save it and email the confirmation
 * link. `{ ok: true }` means "tell them to check their inbox", whether or not
 * an email actually goes out (suppressed address, per-address limit).
 */
export async function createSignupRequest(
  input: SignupInput,
  options: SignupOptions
): Promise<SignupResult> {
  const copy = SIGNUP_FORMS[input.form]
  if (!copy) return fail(400, 'Unknown signup form.')
  const { evidence } = options

  // Bots get the normal answer so they learn nothing.
  if (options.botCheck && typeof input.honeypot === 'string' && input.honeypot.trim()) {
    return { ok: true }
  }

  // The recorded wording must be the wording the person saw.
  if (input.copyVersion !== SIGNUP_COPY_VERSION) {
    return fail(409, 'This form is out of date. Refresh the page and try again.')
  }

  const email = normalizeEmail(input.email)
  if (!email) return fail(400, 'Enter a valid email address.')

  const available = (await getEmailLists()).filter((l) => l.audience === copy.audience)
  if (available.length === 0) return fail(503, 'Email signups are closed right now.')

  let lists = available
  if (input.lists !== undefined && input.lists !== null) {
    if (
      !Array.isArray(input.lists) ||
      input.lists.length > 20 ||
      !input.lists.every((s) => typeof s === 'string')
    ) {
      return fail(400, 'Pick at least one topic.')
    }
    const wanted = new Set(input.lists as string[])
    lists = available.filter((l) => wanted.has(l.slug))
    if (lists.length !== wanted.size) {
      return fail(400, 'One of those topics is no longer available. Refresh the page and try again.')
    }
  }
  if (lists.length === 0) return fail(400, 'Pick at least one topic.')

  const ageAttested = input.ageAttested === true
  if (lists.some((l) => l.requires_age_verification) && !ageAttested) {
    return fail(400, 'Please confirm you’re 21 or older.')
  }

  const birthday = readBirthday(input.birthdayMonth, input.birthdayDay)
  if (birthday === 'invalid') return fail(400, 'Enter a valid birthday, or leave it blank.')

  if (options.botCheck && !(await verifyTurnstile(input.turnstileToken, evidence.ipAddress))) {
    return fail(400, 'Please complete the verification check and try again.')
  }

  if (
    evidence.ipAddress &&
    (await countRecentRequests('ip_address', evidence.ipAddress)) >= MAX_REQUESTS_PER_IP_PER_HOUR
  ) {
    return fail(429, 'Too many signups from your network. Please try again in an hour.')
  }

  const placement = cleanPlacement(input.placement)
  const pending: PendingSignup = {
    email,
    lists,
    firstName: cleanFirstName(input.firstName),
    sourceDetail: placement ? `${copy.sourceLabel} (${placement})` : copy.sourceLabel,
    consentText: copy.consentText,
    ageAttested,
    birthday,
    timezone: cleanTimezone(input.timezone),
    evidence,
  }

  const task = () => saveAndSend(pending)
  if (options.defer) options.defer(task)
  else await task()
  return { ok: true }
}

/** Per-address checks, save, and send. Never throws; failures are logged. */
async function saveAndSend(pending: PendingSignup): Promise<void> {
  try {
    if ((await countRecentRequests('email', pending.email)) >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
      console.warn('[signup] per-address hourly limit reached; confirmation not sent')
      return
    }
    if (isBlockingSuppression(await getSuppressionReason(pending.email))) return

    const token = randomBytes(32).toString('base64url')
    const { ipAddress, userAgent, countryCode } = pending.evidence
    const admin = createAdminClient()
    const { error } = await admin.from('email_signup_requests').insert({
      email: pending.email,
      lists: pending.lists.map((l) => l.slug),
      first_name: pending.firstName,
      source_detail: pending.sourceDetail,
      consent_text: pending.consentText,
      consent_text_version: SIGNUP_COPY_VERSION,
      age_attested: pending.ageAttested,
      age_text: pending.ageAttested ? SIGNUP_AGE_TEXT : null,
      birthday_month: pending.birthday?.month ?? null,
      birthday_day: pending.birthday?.day ?? null,
      timezone: pending.timezone,
      ip_address: ipAddress,
      user_agent: userAgent ? userAgent.slice(0, 1000) : null,
      country_code: cleanCountry(countryCode),
      token_hash: hashToken(token),
    })
    if (error) throw new Error(`Saving signup request failed: ${error.message}`)

    const confirmUrl = `${getSiteOrigin()}/email/confirm-signup?t=${encodeURIComponent(token)}`
    const { html, text } = renderConfirmEmail(pending, confirmUrl)
    await sendAndLogEmail({
      to: pending.email,
      subject: SIGNUP_CONFIRM_EMAIL.subject,
      html,
      text,
      stream: 'transactional',
      fromAlias: 'loyalty',
      templateSlug: 'signup-confirm',
    })
  } catch (err) {
    console.error('[signup] confirmation not sent:', err instanceof Error ? err.message : err)
  }
}

function renderConfirmEmail(pending: PendingSignup, confirmUrl: string): { html: string; text: string } {
  const c = SIGNUP_CONFIRM_EMAIL
  const content = renderBlocks(
    [
      { type: 'heading', text: c.heading },
      { type: 'text', text: c.body },
      { type: 'text', text: `${c.topicsPrefix}${joinNames(pending.lists.map((l) => l.name))}.` },
      { type: 'text', text: c.footnote },
    ],
    { first_name: pending.firstName }
  )
  return renderEmailLayout({
    contentHtml: content.html,
    contentText: content.text,
    recipientEmail: pending.email,
    unsubscribeUrl: buildUnsubscribeUrl(pending.email),
    reason: c.reason,
    preheader: c.preheader,
    cta: { label: c.ctaLabel, url: confirmUrl, noTrack: true },
    kind: 'transactional',
  })
}

/**
 * The opt-in checkbox on another form (loyalty join, wholesale inquiry).
 * `optIn` is the `emailSignup` object those forms send when the box is
 * ticked. Goes through the same double opt-in. Never throws: the opt-in must
 * not fail the form it rides on.
 */
export async function requestEmbeddedSignup(params: {
  form: Exclude<SignupForm, 'website'>
  email: string
  firstName?: string | null
  optIn: unknown
  headers: Headers
  defer?: Defer
}): Promise<void> {
  if (!params.optIn || typeof params.optIn !== 'object') return
  const optIn = params.optIn as Record<string, unknown>
  try {
    const result = await createSignupRequest(
      {
        form: params.form,
        email: params.email,
        firstName: params.firstName,
        ageAttested: optIn.ageAttested,
        timezone: optIn.timezone,
        placement: optIn.placement,
        copyVersion: optIn.copyVersion,
      },
      { evidence: requestEvidence(params.headers), botCheck: false, defer: params.defer }
    )
    if (!result.ok) console.warn(`[signup] ${params.form} opt-in not requested: ${result.error}`)
  } catch (err) {
    console.error(`[signup] ${params.form} opt-in failed:`, err instanceof Error ? err.message : err)
  }
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

interface SignupRequestRow {
  id: string
  email: string
  lists: string[]
  first_name: string | null
  source_detail: string | null
  consent_text: string
  consent_text_version: string
  age_attested: boolean
  age_text: string | null
  birthday_month: number | null
  birthday_day: number | null
  timezone: string | null
  ip_address: string | null
  user_agent: string | null
  country_code: string | null
  status: 'pending' | 'confirmed' | 'expired'
  created_at: string
  expires_at: string
}

const REQUEST_COLUMNS =
  'id, email, lists, first_name, source_detail, consent_text, consent_text_version, age_attested, age_text, birthday_month, birthday_day, timezone, ip_address, user_agent, country_code, status, created_at, expires_at'

async function findByToken(token: unknown): Promise<SignupRequestRow | null> {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_signup_requests')
    .select(REQUEST_COLUMNS)
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (error) throw new Error(`Signup request lookup failed: ${error.message}`)
  return (data as SignupRequestRow | null) || null
}

function isExpired(row: SignupRequestRow): boolean {
  return row.status === 'expired' || new Date(row.expires_at).getTime() < Date.now()
}

export type SignupRequestView =
  | { status: 'pending' | 'confirmed'; email: string; listNames: string[] }
  | { status: 'expired' }
  | { status: 'invalid' }

/** What the confirm page shows for a link. Read-only: opening the link changes nothing. */
export async function getSignupRequest(token: unknown): Promise<SignupRequestView> {
  const row = await findByToken(token)
  if (!row) return { status: 'invalid' }
  if (row.status !== 'confirmed' && isExpired(row)) return { status: 'expired' }
  const names = new Map((await getEmailLists(true)).map((l) => [l.slug, l.name]))
  return {
    status: row.status === 'confirmed' ? 'confirmed' : 'pending',
    email: row.email,
    listNames: row.lists.map((slug) => names.get(slug) || slug),
  }
}

export type ConfirmSignupResult =
  | { status: 'confirmed' | 'already_confirmed'; email: string; lists: string[] }
  | { status: 'expired' | 'invalid' | 'failed' }

/**
 * Record the opt-in for a confirmation link (POST from the confirm page).
 * The consent evidence is the original signup's (wording, version, IP,
 * browser, country, 21+); the confirming click is added as the evidence note.
 */
export async function confirmSignupRequest(
  token: unknown,
  evidence: Evidence
): Promise<ConfirmSignupResult> {
  const admin = createAdminClient()

  let row: SignupRequestRow | null
  try {
    row = await findByToken(token)
  } catch (err) {
    console.error('[signup] confirm lookup failed:', err instanceof Error ? err.message : err)
    return { status: 'failed' }
  }
  if (!row) return { status: 'invalid' }
  if (row.status === 'confirmed') {
    return { status: 'already_confirmed', email: row.email, lists: row.lists }
  }
  if (isExpired(row)) {
    if (row.status === 'pending') {
      await admin
        .from('email_signup_requests')
        .update({ status: 'expired' })
        .eq('id', row.id)
        .eq('status', 'pending')
    }
    return { status: 'expired' }
  }

  // Claim the request first so a double click records one opt-in.
  const confirmedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('email_signup_requests')
    .update({ status: 'confirmed', confirmed_at: confirmedAt })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
  if (claimError) {
    console.error('[signup] confirm claim failed:', claimError.message)
    return { status: 'failed' }
  }
  if (!claimed || claimed.length === 0) {
    return { status: 'already_confirmed', email: row.email, lists: row.lists }
  }

  const requestId = row.id
  const release = () =>
    admin
      .from('email_signup_requests')
      .update({ status: 'pending', confirmed_at: null })
      .eq('id', requestId)

  let contactId: string
  try {
    // Lists switched off since the signup are skipped; the rest are confirmed.
    const active = new Set((await getEmailLists()).map((l) => l.slug))
    const lists = row.lists.filter((slug) => active.has(slug))
    if (lists.length === 0) throw new Error('None of the requested lists is active any more')

    const result = await applyConsent({
      email: row.email,
      action: 'opt_in',
      source: 'signup_form',
      lists,
      sourceDetail: row.source_detail,
      consentText: row.consent_text,
      consentTextVersion: row.consent_text_version,
      ageAttested: row.age_attested,
      ageText: row.age_attested ? row.age_text : null,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      countryCode: row.country_code,
      evidenceNote: [
        `Double opt-in: signup request ${row.id} made ${row.created_at},`,
        `confirmed by email link ${confirmedAt}`,
        evidence.ipAddress ? ` from ${evidence.ipAddress}` : '',
        evidence.countryCode ? ` (${evidence.countryCode})` : '',
        '.',
      ].join(''),
    })
    contactId = result.contact_id
  } catch (err) {
    console.error('[signup] confirm consent failed:', err instanceof Error ? err.message : err)
    await release()
    return { status: 'failed' }
  }

  // Profile details from the form. The opt-in is already recorded, so a
  // failure here is only logged.
  try {
    const updates: Record<string, unknown> = {}
    if (row.timezone) updates.timezone = row.timezone
    if (row.birthday_month && row.birthday_day) {
      updates.birthday_month = row.birthday_month
      updates.birthday_day = row.birthday_day
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await admin.from('email_contacts').update(updates).eq('id', contactId)
      if (error) throw new Error(error.message)
    }
    if (row.first_name) {
      const { error } = await admin
        .from('email_contacts')
        .update({ first_name: row.first_name })
        .eq('id', contactId)
        .is('first_name', null)
      if (error) throw new Error(error.message)
    }
  } catch (err) {
    console.error('[signup] saving contact details failed:', err instanceof Error ? err.message : err)
  }

  return { status: 'confirmed', email: row.email, lists: row.lists }
}
