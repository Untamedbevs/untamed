import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Carry Untamed | Retail & Distribution Partnerships',
  description:
    'Premium canned vodka martinis for retailers, bars, restaurants, and distributors. 1 can = 2 martinis = $3 per cocktail. Join the fastest-growing RTS brand.',
  openGraph: {
    title: 'Carry Untamed | Retail & Distribution',
    description:
      'Premium RTS vodka martinis with the best per-drink value on the market. Learn why retailers, bars, and distributors are choosing Untamed.',
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

export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
