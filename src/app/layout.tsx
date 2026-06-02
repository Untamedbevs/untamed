import type { Metadata } from 'next'
import { Inter, Oswald } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import Script from 'next/script'
import { Suspense } from 'react'
import { AgeGate } from '@/components/AgeGate'
import { TrackingProvider } from '@/components/TrackingProvider'
import { ReferralBanner } from '@/components/ReferralBanner'
import { AccelPayRouteSync } from '@/components/AccelPayRouteSync'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})


const cyberBrush = localFont({
  src: '../fonts/CyberBrush.ttf',
  variable: '--font-cyber-brush',
  display: 'swap',
})

const dirtyHeadline = localFont({
  src: '../fonts/DirtyHeadline.ttf',
  variable: '--font-dirty-headline',
  display: 'swap',
})

const helveticaCondensed = localFont({
  src: [
    {
      path: '../fonts/HelveticaNeueCondensed.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/HelveticaNeueCondensedBold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-helvetica-condensed',
  display: 'swap',
})

const siteUrl = 'https://untamedbevs.com'
const ogImage = {
  url: '/images/logo-mark.png',
  width: 1025,
  height: 1024,
  alt: 'Untamed Beverages logo',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Untamed Beverages | Get In Touch With Your Wild Side',
  description:
    'Premium ready-to-drink vodka martinis. 2 martinis per can, 15% ALC/VOL. Black Panther Espresso, Cheetah Lemon Drop, Cougar Dirty Martini, Lioness Peach & Rosemary. Chill it. Shake it. Unleash it!',
  keywords: [
    'Untamed Beverages',
    'vodka martini',
    'ready to drink',
    'canned cocktails',
    'espresso martini',
    'lemon drop martini',
    'dirty martini',
    'peach rosemary martini',
    'premium cocktails',
  ],
  authors: [{ name: 'Untamed Beverages, LLC' }],
  icons: {
    icon: '/images/logo-mark.png',
    apple: '/images/logo-mark.png',
  },
  openGraph: {
    title: 'Untamed Beverages | Get In Touch With Your Wild Side',
    description:
      'Premium ready-to-drink vodka martinis. 2 martinis per can. Chill it. Shake it. Unleash it!',
    url: siteUrl,
    siteName: 'Untamed Beverages',
    type: 'website',
    locale: 'en_US',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Untamed Beverages | Get In Touch With Your Wild Side',
    description:
      'Premium ready-to-drink vodka martinis. 2 martinis per can. Chill it. Shake it. Unleash it!',
    images: [ogImage.url],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} ${cyberBrush.variable} ${dirtyHeadline.variable} ${helveticaCondensed.variable}`}>
      <head>
        <Script src="https://cart.accelpay.io/scripts/brand.js" strategy="afterInteractive" />
        <Script id="accelpay-brand" strategy="afterInteractive">
          {`apbrand = { id: 5008728 };`}
        </Script>
      </head>
      <body className="bg-untamed-black text-untamed-white antialiased">
        <TrackingProvider>
          <AgeGate />
          <Suspense fallback={null}>
            <AccelPayRouteSync />
          </Suspense>
          <Suspense fallback={null}>
            <ReferralBanner />
          </Suspense>
          {children}
        </TrackingProvider>
      </body>
    </html>
  )
}
