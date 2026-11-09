/**
 * Wording for the one-time permission request: the email and the confirm page.
 *
 * Every opt-in records the exact consent sentence and this version, so the
 * text here is legal evidence. Changing ANY wording below means bumping
 * REPERMISSION_COPY_VERSION, and the new version can't be sent until it is
 * approved by setting EMAIL_REPERMISSION_APPROVED_VERSION to match.
 *
 * Status: DRAFT, pending counsel review.
 */

import {
  getApprovedCheckoutConsentVersion,
  getApprovedRepermissionVersion,
} from '@/lib/email/config'

export const REPERMISSION_COPY_VERSION = 'repermission-2026-11-v1'

export type RepermissionAudience = 'consumer' | 'trade'

interface AudienceCopy {
  /** Contact sources that receive this version of the request. */
  sources: string[]
  /** Lists the person joins by confirming. */
  lists: string[]
  subject: string
  /** Plain text; {{first_name}} is replaced (falls back to "there"). */
  body: string
  ctaLabel: string
  /** Footer: why they got a one-time message. */
  reason: string
  pageHeading: string
  /** The sentence the person agrees to. Recorded verbatim with each opt-in. */
  consentText: string
  /** Required 21+ attestation, recorded verbatim. Null = not asked. */
  ageText: string | null
}

export const REPERMISSION_COPY: Record<RepermissionAudience, AudienceCopy> = {
  consumer: {
    sources: ['loyalty', 'order', 'referral'],
    lists: ['new_drinks', 'offers', 'community'],
    subject: 'Still want to hear from Untamed?',
    body: [
      'Hi {{first_name}},',
      "You've ordered from Untamed or joined the pack, and we'd like to keep you posted by email on new drinks, offers, and community news.",
      "We only email people who say yes. If you'd like to hear from us, confirm below. If not, you don't need to do anything. This is the only time we'll ask.",
    ].join('\n\n'),
    ctaLabel: 'Yes, keep me posted',
    reason: "You're receiving this one-time message because you've ordered from or signed up with Untamed Beverages.",
    pageHeading: 'Keep hearing from Untamed',
    consentText:
      'Yes, email me about new Untamed drinks, offers, and community news. I can unsubscribe at any time.',
    ageText: 'I am 21 years of age or older.',
  },
  trade: {
    sources: ['distributor'],
    lists: ['trade'],
    subject: 'Wholesale updates from Untamed Beverages',
    body: [
      'Hi {{first_name}},',
      "You reached out to Untamed about carrying our drinks. We'd like to send you occasional trade updates: wholesale pricing, distribution news, and programs for bars, stores, and distributors.",
      "We only email people who say yes. If you'd like these updates, confirm below. If not, there's nothing to do. This is the only time we'll ask.",
    ].join('\n\n'),
    ctaLabel: 'Yes, send trade updates',
    reason: "You're receiving this one-time message because you contacted Untamed Beverages about wholesale.",
    pageHeading: 'Untamed trade updates',
    consentText:
      'Yes, email me Untamed trade and wholesale updates. I can unsubscribe at any time.',
    ageText: null,
  },
}

export function isRepermissionCopyApproved(): boolean {
  return getApprovedRepermissionVersion() === REPERMISSION_COPY_VERSION
}

/**
 * AccelPay checkout marketing checkbox (`buyerAcceptsMarketing` on orders).
 *
 * A ticked box becomes an opt-in to the consumer lists only once `text` holds
 * the exact checkbox wording shown at checkout and that version is approved
 * via EMAIL_CHECKOUT_CONSENT_APPROVED_VERSION. Until then checkout ticks are
 * kept in the order payload and can be recorded later with
 * scripts/email/backfill-checkout-consent.mjs.
 *
 * Open questions for AccelPay / counsel before approving:
 *   - the exact wording, and whether the box starts checked (about 91% of
 *     stored orders have it ticked, which suggests it may be pre-checked)
 *   - whether AccelPay verifies the buyer is 21+ at checkout; if it does, set
 *     ageVerifiedAtCheckout so these buyers can receive 21+ lists
 */
export const CHECKOUT_CONSENT = {
  version: 'accelpay-checkout-unconfirmed',
  /** Exact checkbox wording from the AccelPay checkout. Null = unknown. */
  text: null as string | null,
  lists: ['new_drinks', 'offers', 'community'],
  ageVerifiedAtCheckout: false,
  ageText: 'Age verified by AccelPay at checkout',
}

export function isCheckoutConsentApproved(): boolean {
  return (
    Boolean(CHECKOUT_CONSENT.text) &&
    getApprovedCheckoutConsentVersion() === CHECKOUT_CONSENT.version
  )
}

export function fillFirstName(text: string, firstName: string | null | undefined): string {
  return text.replace(/\{\{first_name\}\}/g, firstName?.trim() || 'there')
}
