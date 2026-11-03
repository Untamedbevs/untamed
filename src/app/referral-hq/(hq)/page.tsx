import { buildShareLinks } from '@/lib/referral/helpers'
import { DEMO_REFERRER } from '@/lib/referral-hq/mock-data'
import { TerritoryDashboard } from './TerritoryDashboard'

export default function ReferralHqPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbeverages.com'
  const { consumerLink } = buildShareLinks(siteUrl, DEMO_REFERRER.code)

  return <TerritoryDashboard referrer={DEMO_REFERRER} shareLink={consumerLink} />
}
