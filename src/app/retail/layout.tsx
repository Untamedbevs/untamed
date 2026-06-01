import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Carry Untamed | Retail & Distribution Partnerships',
  description:
    'Premium canned vodka martinis for retailers, bars, restaurants, and distributors. 1 can = 2 martinis = $3 per cocktail. Join the fastest-growing RTD brand.',
  openGraph: {
    title: 'Carry Untamed | Retail & Distribution',
    description:
      'Premium RTD vodka martinis with the best per-drink value on the market. Learn why retailers, bars, and distributors are choosing Untamed.',
    images: ['/images/logo-mark.png'],
  },
  twitter: {
    images: ['/images/logo-mark.png'],
  },
}

export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
