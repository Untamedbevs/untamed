import type { Metadata } from 'next'
import { PitchDeck } from './PitchDeck'

export const metadata: Metadata = {
  title: 'Investor Presentation | Untamed Beverages',
  description:
    'Untamed Beverages — The Ready-to-Serve Martini Company. Investor presentation.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function PitchPage() {
  return <PitchDeck />
}
