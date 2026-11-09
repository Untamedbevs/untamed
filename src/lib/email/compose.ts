/**
 * Personalize and render block content for one recipient: merge variables,
 * subject, signed unsubscribe/preference links, List-Unsubscribe headers.
 * Used by campaign sends, flows, previews, and test sends so they all match.
 */

import { getSiteOrigin } from '@/lib/email/config'
import { fillTags, type EmailBlock, type MergeVars } from '@/lib/email/blocks'
import { renderBlocksEmail } from '@/lib/messaging/marketing-email'
import {
  buildListUnsubscribeHeaders,
  buildPreferencesUrl,
  buildUnsubscribeUrl,
} from '@/lib/messaging/unsubscribe'

export interface RecipientInfo {
  email: string
  first_name?: string | null
  last_name?: string | null
  points_balance?: number | null
}

export function baseVars(r: RecipientInfo, extra: MergeVars = {}): MergeVars {
  const origin = getSiteOrigin()
  const name = [r.first_name, r.last_name].filter(Boolean).join(' ')
  return {
    first_name: r.first_name?.trim() || '',
    name,
    email: r.email,
    site_url: origin,
    portal_url: `${origin}/portal`,
    portal_login_url: `${origin}/portal/login?email=${encodeURIComponent(r.email)}`,
    community_url: `${origin}/community`,
    points_balance: r.points_balance ?? undefined,
    ...extra,
  }
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

export function renderForRecipient(params: {
  recipient: RecipientInfo
  subject: string
  preheader?: string | null
  blocks: EmailBlock[]
  vars?: MergeVars
  reason: string
  kind: 'marketing' | 'transactional'
  campaignId?: string | null
  utmCampaign?: string | null
}): RenderedEmail {
  const email = params.recipient.email.toLowerCase()
  const vars = { ...baseVars(params.recipient), ...(params.vars || {}) }
  const unsubscribeUrl = buildUnsubscribeUrl(email, params.campaignId || null)
  const { html, text } = renderBlocksEmail({
    blocks: params.blocks,
    vars,
    recipientEmail: email,
    unsubscribeUrl,
    preferencesUrl: buildPreferencesUrl(email),
    reason: params.reason,
    preheader: params.preheader ? fillTags(params.preheader, vars) : null,
    utmCampaign: params.utmCampaign,
    kind: params.kind,
  })
  return {
    subject: fillTags(params.subject, vars).trim(),
    html,
    text,
    headers: buildListUnsubscribeHeaders(email, params.campaignId || null),
  }
}

/** URL-safe campaign slug for UTM tags, e.g. "spring-drop-2026-11-05". */
export function utmSlug(name: string, date = new Date()): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'email'}-${date.toISOString().slice(0, 10)}`
}
