import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Creator Partnerships | Untamed Beverages',
  description:
    'Partner with Untamed. We’re looking for 21+ creators on Instagram, TikTok, and YouTube who live nightlife, hosting, and real cocktails — not a mass gifting mill.',
  openGraph: {
    title: 'Create with Untamed',
    description:
      'Creator partnerships for a premium canned vodka martini. Apply with your handle. We review the actual page.',
    images: ['/images/logo-mark.png'],
  },
  twitter: {
    images: ['/images/logo-mark.png'],
  },
}

export default function InfluencersLayout({ children }: { children: React.ReactNode }) {
  return children
}
