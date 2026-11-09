/**
 * Works out who a blast may go to. Shared by the preview and send routes so
 * staff see exactly the list that will be queued.
 *
 * 1. Audience filters narrow WHO the send is aimed at (or "everyone on the list").
 * 2. Consent rules decide who may actually receive it: a recorded opt-in for
 *    the list (or, for the permission request, never asked before), not
 *    suppressed, not paused, not sunset, 21+ where required, allowed country.
 */

import {
  applyContactFilters,
  hasContactFilters,
  queryRecipients,
  type BlastFilters,
} from '@/lib/crm/blast-filters'
import { getEmailSettings } from '@/lib/email/settings'
import { filterSuppressed } from '@/lib/messaging/suppressions'
import {
  getEmailLists,
  getMarketingRecipients,
  getRepermissionRecipients,
  type EligibleRecipient,
  type EmailList,
} from '@/lib/messaging/consent'
import { REPERMISSION_COPY, type RepermissionAudience } from '@/lib/email/consent-copy'

export type BlastKind = 'marketing' | 'repermission'

export interface BlastTarget {
  kind: BlastKind
  listSlug?: string
  repermissionAudience?: RepermissionAudience
  filters: BlastFilters
}

export interface BlastPlan {
  kind: BlastKind
  list: EmailList | null
  repermissionAudience: RepermissionAudience | null
  /** Addresses matching the audience filters; null for "everyone on the list". */
  matchedCount: number | null
  /** Of the matched addresses, how many are on the suppression list. */
  suppressedCount: number
  recipients: EligibleRecipient[]
}

export class BlastPlanError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
  }
}

export async function planBlast(target: BlastTarget): Promise<BlastPlan> {
  const filters = target.filters
  if (!filters?.audience) throw new BlastPlanError('Audience is required')

  let list: EmailList | null = null
  let repermissionAudience: RepermissionAudience | null = null

  if (target.kind === 'marketing') {
    if (!target.listSlug) throw new BlastPlanError('Choose the list this email is for')
    list = (await getEmailLists()).find((l) => l.slug === target.listSlug) || null
    if (!list) throw new BlastPlanError('That list does not exist or is inactive')
  } else if (target.kind === 'repermission') {
    if (target.repermissionAudience !== 'consumer' && target.repermissionAudience !== 'trade') {
      throw new BlastPlanError('Choose consumer or trade for the permission request')
    }
    repermissionAudience = target.repermissionAudience
  } else {
    throw new BlastPlanError('Unknown blast type')
  }

  let audienceEmails: string[] | null = null
  let suppressedCount = 0
  if (filters.audience !== 'subscribers') {
    audienceEmails = (await queryRecipients(filters)).map((r) => r.email)
  }
  if (hasContactFilters(filters)) {
    audienceEmails = await applyContactFilters(audienceEmails, filters)
  }
  if (audienceEmails && audienceEmails.length > 0) {
    const { suppressed } = await filterSuppressed(audienceEmails.map((email) => ({ email })))
    suppressedCount = suppressed.length
  }

  const settings = await getEmailSettings()
  const recipients = list
    ? await getMarketingRecipients(list.slug, audienceEmails, {
        days: settings.sunset_days,
        minSends: settings.sunset_min_sends,
      })
    : await getRepermissionRecipients(REPERMISSION_COPY[repermissionAudience!].sources, audienceEmails)

  return {
    kind: target.kind,
    list,
    repermissionAudience,
    matchedCount: audienceEmails ? audienceEmails.length : null,
    suppressedCount,
    recipients,
  }
}
