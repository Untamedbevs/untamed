/**
 * What every marketing email must carry (CAN-SPAM and the sending providers'
 * policies): a valid postal address, an unsubscribe link and a privacy-policy
 * link. Server-only: reads env.
 *
 * Env:
 *   EMAIL_POSTAL_ADDRESS   full street address or USPS-registered PO box.
 *                          Blasts refuse to queue or send while it's unset.
 */

export const POSTAL_ADDRESS_MISSING =
  'EMAIL_POSTAL_ADDRESS is not set. CAN-SPAM requires a postal address in every marketing email, so blasts are on hold until it is added in Vercel.'

/**
 * Used until EMAIL_POSTAL_ADDRESS is set, so blasts keep sending. It's the
 * address the site footer shows; CAN-SPAM wants a full street address or
 * registered PO box, so EMAIL_POSTAL_ADDRESS should still be set.
 */
export const FALLBACK_POSTAL_ADDRESS = 'Untamed Beverages, LLC, Parrish, FL 34219, USA'

export function getPostalAddress(): string {
  const v = process.env.EMAIL_POSTAL_ADDRESS?.trim()
  if (v) return v
  console.warn('[email] EMAIL_POSTAL_ADDRESS is not set; using the fallback company address in the footer.')
  return FALLBACK_POSTAL_ADDRESS
}

export function getPrivacyUrl(siteOrigin?: string): string {
  const origin = (
    siteOrigin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://untamedbeverages.com'
  ).replace(/\/$/, '')
  return `${origin}/privacy`
}
