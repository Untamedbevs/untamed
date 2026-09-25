'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Building2, Store, Truck, User, Utensils } from 'lucide-react'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { InquiryCTA, InquiryModal } from '@/components/retail/Inquiry'
import {
  ActivationIdeas,
  AdvantageGrid,
  OneTwoThree,
  PromiseToPartners,
  SectionIntro,
  SpiritLineup,
  WhyDifferent,
} from '@/components/retail/SellSections'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import {
  DISTRIBUTOR_ADVANTAGES,
  ON_PREMISE_ADVANTAGES,
  ORANGE,
  RETAILER_ADVANTAGES,
} from '@/lib/retail/sell'

function DistributeContent() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  useEffect(() => {
    if (!ref) return
    fetch('/api/referral/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: ref, type: 'distributor' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.referrerName) setReferrerName(data.referrerName)
      })
      .catch(() => {})
  }, [ref])

  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />
      <InquiryModal open={modalOpen} onClose={closeModal} referrerName={referrerName} />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-untamed-black via-untamed-black to-untamed-black-light" />
            <div className="absolute inset-0 opacity-20">
              <Image
                src={siteAssetAbsoluteUrl('/images/scratch-lioness.png')}
                alt=""
                fill
                className="object-cover"
                priority
                aria-hidden="true"
                unoptimized
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-untamed-black/40 via-transparent to-untamed-black" />
            <div className="absolute top-1/4 right-[12%] w-96 h-96 rounded-full blur-[150px] opacity-25 bg-lioness" />
            <div className="absolute bottom-0 left-[10%] w-80 h-80 rounded-full blur-[140px] opacity-15 bg-panther" />
          </div>

          <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-10 pb-8 md:pt-16 md:pb-4">
            <div className="max-w-5xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                <Image
                  src="https://media.untamedbeverages.com/media/Site_Assets/Graphics/1780139299257-untamed_coaster_design-v2.png"
                  alt="Untamed Beverages"
                  width={400}
                  height={400}
                  className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 mx-auto mb-6 rounded-full"
                  priority
                  unoptimized
                />

                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
                  style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}
                >
                  <Building2 className="w-4 h-4" />
                  Retail &amp; Distribution
                </div>

                <h1 className="font-condensed text-5xl sm:text-6xl lg:text-8xl font-bold text-white uppercase tracking-wide leading-[0.9] mb-5">
                  Carry{' '}
                  <span className="font-headline text-gradient-lioness">Untamed</span>
                  <br />
                  in Your Business
                </h1>
                <p className="text-lg sm:text-xl text-untamed-white-muted max-w-2xl mx-auto mb-4">
                  Premium canned vodka martinis that customers remember, reorder, and recommend.
                  Join the growing network of retailers, bars, restaurants, and distributors carrying Untamed.
                </p>
                <p className="text-untamed-white-muted text-base md:text-lg tracking-wider mb-10">
                  Chill it. Shake it.{' '}
                  <span className="font-wild cyber-brush-fix text-untamed-white text-2xl md:text-3xl">
                    Unleash it!
                  </span>
                </p>

                <div className="flex flex-col items-center gap-5">
                  <InquiryCTA label="Connect With Us" onClick={openModal} />
                  <div className="flex flex-wrap justify-center gap-3">
                    <a href="#retailers" className="px-5 py-2.5 rounded-full border border-[#FF8C2A40] text-[#FF8C2A] text-sm font-medium hover:bg-[#FF8C2A1A] transition-colors">
                      For Retailers
                    </a>
                    <a href="#on-premise" className="px-5 py-2.5 rounded-full border border-[#FF8C2A40] text-[#FF8C2A] text-sm font-medium hover:bg-[#FF8C2A1A] transition-colors">
                      For Bars &amp; Restaurants
                    </a>
                    <a href="#distributors" className="px-5 py-2.5 rounded-full border border-[#FF8C2A40] text-[#FF8C2A] text-sm font-medium hover:bg-[#FF8C2A1A] transition-colors">
                      For Distributors
                    </a>
                  </div>
                  <Link
                    href="/portal/login"
                    className="inline-flex items-center gap-1.5 text-sm text-untamed-white-muted hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Existing partner? <span className="underline underline-offset-2">Sign in to your portal</span>
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <SpiritLineup />
        <OneTwoThree />
        <PromiseToPartners />

        <section id="retailers" className="px-4 sm:px-6 lg:px-8 mb-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <SectionIntro
              eyebrow="For Retailers"
              icon={Store}
              headline={{ pre: 'Why Retailers Win With ', highlight: 'Untamed', style: 'brand' }}
              subhead="Premium cocktail credentials with a clear value story and a culture-led lineup that supports repeat purchasing."
            />
            <div className="mb-10">
              <AdvantageGrid advantages={RETAILER_ADVANTAGES} />
            </div>
            <div className="text-center">
              <InquiryCTA label="Carry Untamed in Your Store" onClick={openModal} />
            </div>
          </div>
        </section>

        <section id="on-premise" className="px-4 sm:px-6 lg:px-8 mb-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <SectionIntro
              eyebrow="For Bars & Restaurants"
              icon={Utensils}
              headline={{ pre: 'Premium Martinis, ', highlight: 'Simplified' }}
              subhead="Deliver a premium martini program with faster execution, tighter cost control, and consistent guest experience — without adding complexity behind the bar."
            />
            <div className="mb-12">
              <AdvantageGrid advantages={ON_PREMISE_ADVANTAGES} compact />
            </div>
            <div className="mb-10">
              <ActivationIdeas />
            </div>
            <div className="text-center">
              <InquiryCTA label="Add Untamed to Your Menu" onClick={openModal} />
            </div>
          </div>
        </section>

        <section id="distributors" className="px-4 sm:px-6 lg:px-8 mb-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <SectionIntro
              eyebrow="For Distributors"
              icon={Truck}
              headline={{ pre: 'A Brand That ', highlight: 'Sells Itself' }}
              subhead="Premium margins, explosive category growth, and a brand that retailers ask for by name."
            />
            <div className="mb-10">
              <AdvantageGrid advantages={DISTRIBUTOR_ADVANTAGES} />
            </div>
            <div className="text-center">
              <InquiryCTA label="Become a Distribution Partner" onClick={openModal} />
            </div>
          </div>
        </section>

        <WhyDifferent />

        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="rounded-3xl border-2 bg-gradient-to-b from-[#FF8C2A08] to-transparent p-10 sm:p-14" style={{ borderColor: '#FF8C2A33' }}>
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Ready to Bring <span className="font-headline" style={{ color: ORANGE }}>Untamed</span> to Your Business?
              </h2>
              <p className="text-untamed-white-muted text-lg mb-8 max-w-xl mx-auto">
                Whether you are a retailer, bar, restaurant, or distributor, we would love to start the conversation.
              </p>
              <InquiryCTA label="Connect With Us" onClick={openModal} />
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default function DistributePage() {
  return (
    <Suspense fallback={null}>
      <DistributeContent />
    </Suspense>
  )
}
