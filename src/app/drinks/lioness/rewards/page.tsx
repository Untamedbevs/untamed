import type { Metadata } from 'next'
import { getDrinkBySlug } from '@/lib/drinks'
import { LoyaltyLanding } from '@/components/loyalty/LoyaltyLanding'

const drink = getDrinkBySlug('lioness')!

export const metadata: Metadata = {
  title: `Join the Pack | ${drink.name} | Untamed Beverages`,
  description: `Join the pack with ${drink.name} ${drink.flavor}. Share your moments, bring your friends, and get first access to what is next.`,
}

export default function LionessRewardsPage() {
  return <LoyaltyLanding drink={drink} />
}
