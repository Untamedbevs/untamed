import type { Metadata } from 'next'
import { Inter, Oswald, Metal_Mania, Permanent_Marker, Rubik_Dirt } from 'next/font/google'
import './globals.css'
import { AgeGate } from '@/components/AgeGate'

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

const metalMania = Metal_Mania({
  subsets: ['latin'],
  variable: '--font-metal-mania',
  weight: '400',
  display: 'swap',
})

const permanentMarker = Permanent_Marker({
  subsets: ['latin'],
  variable: '--font-permanent-marker',
  weight: '400',
  display: 'swap',
})

const rubikDirt = Rubik_Dirt({
  subsets: ['latin'],
  variable: '--font-rubik-dirt',
  weight: '400',
  display: 'swap',
})

export const metadata: Metadata = {
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
  openGraph: {
    title: 'Untamed Beverages | Get In Touch With Your Wild Side',
    description:
      'Premium ready-to-drink vodka martinis. 2 martinis per can. Chill it. Shake it. Unleash it!',
    url: 'https://untamedbevs.com',
    siteName: 'Untamed Beverages',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Untamed Beverages | Get In Touch With Your Wild Side',
    description:
      'Premium ready-to-drink vodka martinis. 2 martinis per can. Chill it. Shake it. Unleash it!',
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
    <html lang="en" className={`${inter.variable} ${oswald.variable} ${metalMania.variable} ${permanentMarker.variable} ${rubikDirt.variable}`}>
      <body className="bg-untamed-black text-untamed-white antialiased">
        <AgeGate />
        {children}
      </body>
    </html>
  )
}
