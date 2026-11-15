import type { Metadata } from 'next'
import { PickYourFour } from '@/app/lp/pick-your-four/PickYourFour'

export const metadata: Metadata = {
  title: 'Shop | Untamed Beverages',
  description:
    'Pick any four boxes of Untamed martinis, in any mix of flavors. Each box is a 4-pack of cans with two martinis in every can.',
}

/** The shop is the Pick Your Four builder, with the full site navigation. */
export default function ShopPage() {
  return <PickYourFour siteNav />
}
