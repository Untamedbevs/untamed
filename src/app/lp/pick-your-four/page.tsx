import type { Metadata } from 'next'
import { PickYourFour } from './PickYourFour'

export const metadata: Metadata = {
  title: 'Pick Your Four | Untamed Beverages',
  description:
    'Pick any four boxes of Untamed martinis, in any mix of flavors. Each box is a 4-pack of cans.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Pick Your Four | Untamed Beverages',
    description: 'Pick any four boxes, in any mix of flavors.',
    images: ['/images/logo-mark.png'],
  },
}

export default function PickYourFourPage() {
  return <PickYourFour />
}
