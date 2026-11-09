import type { BlastRecipient } from '@/lib/crm/blast-filters'
import { buildShareLinks } from '@/lib/referral/helpers'

/** Origin for links inside emails. Same fallback as buildUnsubscribeUrl. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbeverages.com').replace(/\/$/, '')
}

/** Merge tags that need the recipient's own referral code. */
export const REFERRAL_TAG_KEYS = ['referral_link', 'shop_referral_link', 'retail_referral_link', 'referral_code'] as const

/** True when the text uses any merge tag that needs a referral code. */
export function usesReferralTags(text: string): boolean {
  return REFERRAL_TAG_KEYS.some((key) => new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'i').test(text))
}

/**
 * Merge-tag values available to every campaign email. Referral tags are only
 * present when the recipient has a referral code; callers check that before
 * sending a body that uses them.
 */
export function recipientVars(
  r: Pick<BlastRecipient, 'email' | 'name' | 'firstName'>,
  referralCode?: string | null
): Record<string, string> {
  const origin = siteOrigin()
  const vars: Record<string, string> = {
    first_name: r.firstName || r.name.split(' ')[0] || '',
    name: r.name,
    email: r.email,
    portal_url: `${origin}/portal`,
    portal_login_url: `${origin}/portal/login?email=${encodeURIComponent(r.email)}`,
    portal_referrals_url: `${origin}/portal/login?email=${encodeURIComponent(r.email)}&returnTo=${encodeURIComponent('/portal/referrals')}`,
    community_url: `${origin}/community`,
    hunts_url: `${origin}/portal/hunts`,
    rewards_url: `${origin}/portal/rewards`,
  }
  if (referralCode) {
    const { consumerLink, distributorLink } = buildShareLinks(origin, referralCode)
    vars.referral_code = referralCode
    vars.referral_link = consumerLink
    vars.shop_referral_link = `${origin}/shop?ref=${referralCode}`
    vars.retail_referral_link = distributorLink
  }
  return vars
}
