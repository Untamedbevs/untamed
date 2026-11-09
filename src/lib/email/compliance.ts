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

export function getPostalAddress(): string | undefined {
  const v = process.env.EMAIL_POSTAL_ADDRESS?.trim()
  return v ? v : undefined
}

export function getPrivacyUrl(siteOrigin?: string): string {
  const origin = (
    siteOrigin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://untamedbeverages.com'
  ).replace(/\/$/, '')
  return `${origin}/privacy`
}
