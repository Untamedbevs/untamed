/**
 * Pages reached from links in emails. Their URLs carry signed tokens that
 * identify the recipient, so they skip the age gate (unsubscribing must take
 * one step), third-party pixels and the cart embed (which read the full URL),
 * and first-party page-view tracking.
 */
const PRIVATE_EMAIL_PATHS = ['/unsubscribe', '/email/']

export function isPrivateEmailPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return PRIVATE_EMAIL_PATHS.some((p) => pathname === p || pathname.startsWith(p))
}
