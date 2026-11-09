/**
 * Wording for website email signups, the double opt-in confirmation email,
 * and the preference center.
 *
 * Every opt-in records the exact sentence shown and SIGNUP_COPY_VERSION, so
 * the consent and age sentences are legal evidence. Changing ANY of them means
 * bumping SIGNUP_COPY_VERSION. Forms send the version they displayed, and the
 * server refuses a mismatch (a stale page showing old wording). The email and
 * page wording further down isn't consent evidence and can change freely.
 *
 * Status: DRAFT, pending counsel review. Not gated: signups use this wording
 * as soon as it ships, because every signup is confirmed by email first.
 *
 * No imports, so client forms show the same text the server records.
 */

export const SIGNUP_COPY_VERSION = 'signup-2026-11-v1'

export type SignupForm = 'website' | 'join' | 'trade'

interface SignupFormCopy {
  /** Which lists the form can sign people up for. */
  audience: 'consumer' | 'trade'
  /** The sentence the person agrees to. Recorded verbatim with the opt-in. */
  consentText: string
  /** Kept as the opt-in's source detail, with where the form was shown. */
  sourceLabel: string
}

export const SIGNUP_FORMS: Record<SignupForm, SignupFormCopy> = {
  // Newsletter form (footer, homepage, shop, /subscribe), shown beside the topic checkboxes.
  website: {
    audience: 'consumer',
    consentText:
      "Yes, send me Untamed Beverages marketing emails on the topics I've checked. I can unsubscribe at any time.",
    sourceLabel: 'Website signup form',
  },
  // Separate, unticked checkbox on the loyalty "Join the Pack" form.
  join: {
    audience: 'consumer',
    consentText:
      'Also email me about new Untamed drinks, offers, and community news. I can unsubscribe at any time.',
    sourceLabel: 'Loyalty join form checkbox',
  },
  // Separate, unticked checkbox on the wholesale / distributor inquiry form.
  trade: {
    audience: 'trade',
    consentText: 'Email me Untamed trade and wholesale updates. I can unsubscribe at any time.',
    sourceLabel: 'Wholesale inquiry form checkbox',
  },
}

/** Required (unticked) checkbox for consumer lists. Recorded verbatim. */
export const SIGNUP_AGE_TEXT = 'I am 21 years of age or older.'

/** Shown above the save button on /email/preferences; recorded with topics turned on there. */
export const PREFERENCES_CONSENT_TEXT =
  "Yes, send me Untamed Beverages marketing emails on the topics I've turned on. I can change this or unsubscribe at any time."

/** Double opt-in confirmation email. Merge tags as in src/lib/email/blocks.ts. */
export const SIGNUP_CONFIRM_EMAIL = {
  subject: 'Confirm your Untamed email signup',
  preheader: "One click and you're in.",
  heading: 'Confirm your signup',
  body: [
    'Hi {{first_name|there}},',
    'Thanks for signing up for emails from Untamed Beverages. Please confirm this is your address by clicking the button below.',
  ].join('\n\n'),
  /** Followed by the list names, e.g. "You'll get: New drinks & drops and Offers & promotions." */
  topicsPrefix: "You'll get: ",
  footnote:
    "The link works for 7 days. If you didn't sign up, just ignore this email and you won't be subscribed.",
  ctaLabel: 'Confirm my signup',
  reason:
    "You're receiving this one-time message because this address was entered in an email signup form on untamedbeverages.com.",
}

/** Confirm page (/email/confirm-signup). */
export const SIGNUP_CONFIRM_PAGE = {
  heading: 'Confirm your signup',
  button: 'Confirm my signup',
  doneHeading: "You're subscribed",
}

/** "Email me a link" for the preference center. */
export const PREFERENCES_LINK_EMAIL = {
  subject: 'Your Untamed email preferences link',
  heading: 'Manage your emails',
  body:
    "Here's your link to choose which Untamed emails you get, pause them for a while, or unsubscribe.\n\nIf you didn't ask for this, you can ignore this email. Nothing changes until you use the link.",
  ctaLabel: 'Manage email preferences',
  reason:
    "You're receiving this because someone asked for an email preferences link for this address on untamedbeverages.com.",
}
