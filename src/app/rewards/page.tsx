import type { Metadata } from 'next'
import { LoyaltyLanding } from '@/components/loyalty/LoyaltyLanding'

export const metadata: Metadata = {
  title: 'Rewards | Untamed Beverages',
  description:
    'Join the Pack! Earn points with every purchase, upload receipts, and unlock exclusive Untamed rewards.',
}

export default function RewardsPage() {
  return <LoyaltyLanding />
}
