/**
 * Consent records for marketing email.
 *
 * Every opt-in, opt-out, unsubscribe, complaint, and hard bounce goes through
 * the `email_apply_consent` database function, which writes the evidence row,
 * the per-list status, and the suppression list in one transaction. See
 * supabase/migrations/00027_email_contacts_and_consent.sql.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getMarketingCountries } from '@/lib/email/config'

export type ConsentAction = 'opt_in' | 'opt_out' | 'unsubscribe_all' | 'complaint' | 'hard_bounce'

export type ConsentSource =
  | 'repermission_email'
  | 'signup_form'
  | 'checkout'
  | 'preference_page'
  | 'unsubscribe_link'
  | 'one_click'
  | 'mailto'
  | 'ses_feedback'
  | 'admin'
  | 'import'

export interface ApplyConsentParams {
  email: string
  action: ConsentAction
  source: ConsentSource
  lists?: string[]
  sourceDetail?: string | null
  consentText?: string | null
  consentTextVersion?: string | null
  campaignId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  countryCode?: string | null
  actorStaffId?: string | null
  evidenceNote?: string | null
  ageAttested?: boolean
  ageText?: string | null
  sourceMessageId?: string | null
}

export interface ApplyConsentResult {
  contact_id: string
  email: string
  action: ConsentAction
  lists: string[]
  changed: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function cleanIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const first = ip.split(',')[0].trim()
  // inet accepts IPv4/IPv6 literals; anything else would fail the whole call.
  return /^[0-9a-f:.]+$/i.test(first) && first.length <= 45 ? first : null
}

export async function applyConsent(params: ApplyConsentParams): Promise<ApplyConsentResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('email_apply_consent', {
    p_email: params.email,
    p_action: params.action,
    p_source: params.source,
    p_list_slugs: params.lists && params.lists.length > 0 ? params.lists : null,
    p_source_detail: params.sourceDetail ?? null,
    p_consent_text: params.consentText ?? null,
    p_consent_text_version: params.consentTextVersion ?? null,
    p_campaign_id: isUuid(params.campaignId) ? params.campaignId : null,
    p_ip_address: cleanIp(params.ipAddress),
    p_user_agent: params.userAgent ?? null,
    p_country_code: params.countryCode ?? null,
    p_actor_staff_id: params.actorStaffId ?? null,
    p_evidence_note: params.evidenceNote ?? null,
    p_age_attested: params.ageAttested ?? false,
    p_age_text: params.ageText ?? null,
    p_source_message_id: params.sourceMessageId ?? null,
  })

  if (error) {
    throw new Error(`Consent update failed: ${error.message}`)
  }
  return data as ApplyConsentResult
}

/** Request details kept as consent evidence. */
export function requestEvidence(headers: Headers): {
  ipAddress: string | null
  userAgent: string | null
  countryCode: string | null
} {
  return {
    ipAddress: cleanIp(headers.get('x-forwarded-for') || headers.get('x-real-ip')),
    userAgent: headers.get('user-agent'),
    countryCode: headers.get('x-vercel-ip-country'),
  }
}

export interface EligibleRecipient {
  contact_id: string
  email: string
  first_name: string | null
  last_name: string | null
  loyalty_member_id: string | null
  referral_participant_id: string | null
  distributor_lead_id: string | null
}

const RPC_PAGE_SIZE = 1000
const EMAIL_FILTER_CHUNK = 2000

async function pagedRpc(
  fn: 'email_marketing_recipients' | 'email_repermission_recipients',
  args: Record<string, unknown>
): Promise<EligibleRecipient[]> {
  const admin = createAdminClient()
  const out: EligibleRecipient[] = []
  for (let from = 0; ; from += RPC_PAGE_SIZE) {
    const { data, error } = await admin
      .rpc(fn, args)
      .range(from, from + RPC_PAGE_SIZE - 1)
    if (error) throw new Error(`${fn} failed: ${error.message}`)
    const rows = (data || []) as EligibleRecipient[]
    out.push(...rows)
    if (rows.length < RPC_PAGE_SIZE) break
  }
  return out
}

async function withEmailChunks(
  emails: string[] | null,
  run: (chunk: string[] | null) => Promise<EligibleRecipient[]>
): Promise<EligibleRecipient[]> {
  if (emails === null) return run(null)
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  const out: EligibleRecipient[] = []
  for (let i = 0; i < unique.length; i += EMAIL_FILTER_CHUNK) {
    out.push(...(await run(unique.slice(i, i + EMAIL_FILTER_CHUNK))))
  }
  return out
}

/**
 * Contacts allowed to receive marketing on `listSlug` right now: subscribed,
 * 21+ where required, allowed country, not paused, not suppressed, and (when
 * `sunset` is given) not long-unengaged. `emails` narrows the result to an
 * audience-filter selection (null = everyone on the list).
 */
export async function getMarketingRecipients(
  listSlug: string,
  emails: string[] | null,
  sunset?: { days: number; minSends: number } | null
): Promise<EligibleRecipient[]> {
  const countries = getMarketingCountries()
  return withEmailChunks(emails, (chunk) =>
    pagedRpc('email_marketing_recipients', {
      p_list_slug: listSlug,
      p_allowed_countries: countries,
      p_emails: chunk,
      p_sunset_days: sunset?.days ?? null,
      p_sunset_min_sends: sunset?.minSends ?? null,
    })
  )
}

/** Contacts who may get the one-time permission request. */
export async function getRepermissionRecipients(
  sources: string[],
  emails: string[] | null
): Promise<EligibleRecipient[]> {
  const countries = getMarketingCountries()
  return withEmailChunks(emails, (chunk) =>
    pagedRpc('email_repermission_recipients', {
      p_sources: sources,
      p_allowed_countries: countries,
      p_emails: chunk,
    })
  )
}

export interface EmailList {
  slug: string
  name: string
  description: string | null
  audience: 'consumer' | 'trade'
  requires_age_verification: boolean
  is_active: boolean
  sort_order: number
}

export async function getEmailLists(includeInactive = false): Promise<EmailList[]> {
  const admin = createAdminClient()
  let query = admin
    .from('email_lists')
    .select('slug, name, description, audience, requires_age_verification, is_active, sort_order')
    .order('sort_order', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw new Error(`Could not load email lists: ${error.message}`)
  return (data || []) as EmailList[]
}
