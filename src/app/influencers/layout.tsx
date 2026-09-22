import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Creator Partnerships | Untamed Beverages',
  description:
    'Partner with Untamed. We’re looking for 21+ creators on Instagram, TikTok, and YouTube who live nightlife, hosting, and real cocktails — not a mass gifting mill.',
  openGraph: {
    title: 'Create with Untamed',
    description:
      'Four wild vodka martinis. A ritual that films. Creator partnerships for people whose audience is 21+ and whose content has taste.',
    images: [
      'https://media.untamedbeverages.com/media/Site_Assets/Graphics/1780139299257-untamed_coaster_design-v2.png',
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      'https://media.untamedbeverages.com/media/Site_Assets/Graphics/1780139299257-untamed_coaster_design-v2.png',
    ],
  },
}

export default function InfluencersLayout({ children }: { children: React.ReactNode }) {
  return children
}
