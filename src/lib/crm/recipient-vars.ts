import type { BlastRecipient } from '@/lib/crm/blast-filters'

export function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://untamedbevs.com'
  ).replace(/\/$/, '')
}

/** Merge-tag values available to every campaign email. */
export function recipientVars(r: Pick<BlastRecipient, 'email' | 'name' | 'firstName'>): Record<string, string> {
  const origin = siteOrigin()
  return {
    first_name: r.firstName || r.name.split(' ')[0] || '',
    name: r.name,
    email: r.email,
    portal_login_url: `${origin}/portal/login?email=${encodeURIComponent(r.email)}`,
    community_url: `${origin}/community`,
    hunts_url: `${origin}/portal/hunts`,
    rewards_url: `${origin}/portal/rewards`,
  }
}
