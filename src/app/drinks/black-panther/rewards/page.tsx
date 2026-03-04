import type { Metadata } from 'next'
import { getDrinkBySlug } from '@/lib/drinks'
import { LoyaltyLanding } from '@/components/loyalty/LoyaltyLanding'

const drink = getDrinkBySlug('black-panther')!

export const metadata: Metadata = {
  title: `${drink.name} Rewards | Untamed Beverages`,
  description: `Join the Pack! Earn points and unlock exclusive rewards with ${drink.name} ${drink.flavor}.`,
}

export default function BlackPantherRewardsPage() {
  return <LoyaltyLanding drink={drink} />
}
