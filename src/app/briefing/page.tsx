import type { Metadata } from 'next'
import { BriefingDeck } from './BriefingDeck'

export const metadata: Metadata = {
  title: 'Owner Briefing | Untamed Beverages',
  description: 'Retail lead engine — owner briefing. Confidential.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function BriefingPage() {
  return <BriefingDeck />
}
