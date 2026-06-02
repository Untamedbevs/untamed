import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { CommunityGallery } from './CommunityGallery'
import { drinks } from '@/lib/drinks'

export const metadata: Metadata = {
  title: 'Untamed Community | Real moments, real drinks',
  description:
    'Photos and videos from the Untamed community -- members and partners sharing how they unleash it. Submit your own to earn loyalty points.',
}

export const revalidate = 60

export default function CommunityPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen">
        <section className="relative pt-10 md:pt-14 pb-12 md:pb-16 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 right-0 w-96 h-96 rounded-full blur-[180px] opacity-10 bg-cougar" />
            <div className="absolute bottom-1/3 left-0 w-96 h-96 rounded-full blur-[180px] opacity-10 bg-cheetah" />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="font-condensed text-4xl sm:text-6xl lg:text-7xl font-bold text-white uppercase mb-4">
              The <span className="font-headline text-gradient-wild">Untamed</span> Community
            </h1>
            <p className="text-lg text-untamed-white-muted max-w-2xl mx-auto">
              Real moments from real members. Tag your photos and videos for a
              chance to be featured on this page and earn loyalty points.
            </p>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-untamed-white-muted">
              Loading the gallery...
            </div>
          }
        >
          <CommunityGallery drinks={drinks.map((d) => ({ slug: d.slug, name: d.name }))} />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
