/**
 * What the preference center knows about one address. Shared by the page and
 * its POST handler (src/app/api/email/preferences/route.ts).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailLists, type EmailList } from '@/lib/messaging/consent'
import { getSuppressionReason, isBlockingSuppression } from '@/lib/email/signup'

export interface PreferenceList extends EmailList {
  /** The consent record says subscribed (a suppression still overrides it). */
  subscribed: boolean
}

export interface PreferenceState {
  email: string
  contactId: string | null
  ageVerified: boolean
  /** Only while a pause is in effect. */
  pausedUntil: string | null
  timezone: string | null
  birthdayMonth: number | null
  birthdayDay: number | null
  /** Active lists only. */
  lists: PreferenceList[]
  suppression: string | null
  /** Bounce, complaint, manual block, or deletion request: topics can't be turned on here. */
  blocked: boolean
}

/** A list the person is actually getting (subscribed and not suppressed). */
export function isReceiving(state: PreferenceState, list: PreferenceList): boolean {
  return list.subscribed && !state.suppression
}

export async function loadPreferenceState(email: string): Promise<PreferenceState> {
  const admin = createAdminClient()
  const [lists, suppression, contactResult] = await Promise.all([
    getEmailLists(),
    getSuppressionReason(email),
    admin
      .from('email_contacts')
      .select('id, age_verified_at, marketing_paused_until, timezone, birthday_month, birthday_day')
      .eq('email', email)
      .maybeSingle(),
  ])
  if (contactResult.error) throw new Error(`Contact lookup failed: ${contactResult.error.message}`)
  const contact = contactResult.data as {
    id: string
    age_verified_at: string | null
    marketing_paused_until: string | null
    timezone: string | null
    birthday_month: number | null
    birthday_day: number | null
  } | null

  const subscribed = new Set<string>()
  if (contact) {
    const { data, error } = await admin
      .from('email_consents')
      .select('list_slug, status')
      .eq('contact_id', contact.id)
    if (error) throw new Error(`Consent lookup failed: ${error.message}`)
    for (const row of (data || []) as { list_slug: string; status: string }[]) {
      if (row.status === 'subscribed') subscribed.add(row.list_slug)
    }
  }

  const pausedUntil =
    contact?.marketing_paused_until && new Date(contact.marketing_paused_until).getTime() > Date.now()
      ? contact.marketing_paused_until
      : null

  return {
    email,
    contactId: contact?.id ?? null,
    ageVerified: Boolean(contact?.age_verified_at),
    pausedUntil,
    timezone: contact?.timezone ?? null,
    birthdayMonth: contact?.birthday_month ?? null,
    birthdayDay: contact?.birthday_day ?? null,
    lists: lists.map((l) => ({ ...l, subscribed: subscribed.has(l.slug) })),
    suppression,
    blocked: isBlockingSuppression(suppression),
  }
}
