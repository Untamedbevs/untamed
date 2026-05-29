import type { Metadata } from 'next'
import { BrandKitContent } from './BrandKitContent'

export const metadata: Metadata = {
  title: 'Brand Kit | Untamed Beverages',
  description:
    'The official Untamed Beverages brand kit. Logos, fonts, colors, voice, messaging, and downloadable assets for press, partners, and social media.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function BrandKitPage() {
  return <BrandKitContent />
}
