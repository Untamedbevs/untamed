import type { Metadata } from 'next'
import { LoyaltyLanding } from '@/components/loyalty/LoyaltyLanding'

export const metadata: Metadata = {
  title: 'Join the Pack | Untamed Beverages',
  description:
    'Be part of Untamed from day one. Share your moments, bring your friends, and get first access to what is next.',
}

export default function RewardsPage() {
  return <LoyaltyLanding />
}
