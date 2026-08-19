'use client'

import { Suspense, useCallback, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Check, Store, Truck, Utensils } from 'lucide-react'
import { DistributorLeadForm } from '@/components/referral/DistributorLeadForm'
import { InquiryCTA, InquiryModal } from '@/components/retail/Inquiry'
import {
  ActivationIdeas,
  AdvantageGrid,
  OneTwoThree,
  ProductCans,
  PromiseToPartners,
  SectionIntro,
  WhyDifferent,
} from '@/components/retail/SellSections'
import { ADVANTAGE_SETS, ORANGE } from '@/lib/retail/sell'
import type { RetailLandingPage } from '@/lib/retail/landing-pages'

const SECTION_ICONS = {
  on_premise: Utensils,
  retailer: Store,
  distributor: Truck,
} as const

function LeadCard({ page }: { page: RetailLandingPage }) {
  return (
    <div
      id="inquire"
      className="rounded-2xl border-2 bg-untamed-black-card p-6 md:p-8 scroll-mt-24"
      style={{ borderColor: '#FF8C2A33' }}
    >
      <h2 className="font-condensed text-2xl font-bold uppercase text-white">{page.cta}</h2>
      <p className="mt-1 text-sm text-untamed-white-muted">We reach out within 48 hours.</p>
      <div className="mt-6">
        <Suspense fallback={null}>
          <DistributorLeadForm defaultBusinessType={page.defaultBusinessType} />
        </Suspense>
      </div>
    </div>
  )
}

export function RetailCampaignLanding({ page }: { page: RetailLandingPage }) {
  const [modalOpen, setModalOpen] = useState(false)
  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])
  const advantages = ADVANTAGE_SETS[page.advantageSet]
  const SectionIcon = SECTION_ICONS[page.advantageSet]

  return (
    <div className="min-h-screen bg-untamed-black text-untamed-white">
      <InquiryModal
        open={modalOpen}
        onClose={closeModal}
        defaultBusinessType={page.defaultBusinessType}
        title={page.cta}
      />

      <header className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-5">
        <a href="/" className="flex items-center gap-3">
          <Image src="/images/logo-mark.png" alt="Untamed Beverages" width={40} height={40} className="h-10 w-10" />
          <Image src="/images/logo-text.png" alt="Untamed Beverages" width={140} height={28} className="h-6 w-auto hidden sm:block" />
        </a>
        <p className="font-condensed text-[11px] uppercase tracking-[0.3em] text-untamed-white-muted">
          {page.eyebrow}
        </p>
      </header>

      <div className="pt-4 pb-24 md:pb-16">
        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-start">
              <div className="text-center lg:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
                    style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}
                  >
                    <SectionIcon className="w-4 h-4" />
                    {page.audience}
                  </div>

                  <h1 className="font-condensed text-4xl sm:text-6xl lg:text-7xl font-bold text-white uppercase mb-6">
                    {page.headline.pre}
                    <span
                      className={page.headline.style === 'brand' ? 'font-headline' : undefined}
                      style={{ color: ORANGE }}
                    >
                      {page.headline.highlight}
                    </span>
                    {page.headline.post}
                  </h1>
                  <p className="text-lg sm:text-xl text-untamed-white-muted max-w-2xl mx-auto lg:mx-0 mb-8">
                    {page.subhead}
                  </p>

                  <ul className="space-y-3 text-left max-w-xl mx-auto lg:mx-0 mb-8">
                    {page.proof.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm sm:text-base text-untamed-white-muted">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF8C2A1A]">
                          <Check className="h-3.5 w-3.5" style={{ color: ORANGE }} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="flex justify-center mb-10 lg:hidden">
                    <InquiryCTA label={page.cta} onClick={openModal} />
                  </div>
                </motion.div>

                <ProductCans />
              </div>

              <div className="hidden lg:block sticky top-8">
                <LeadCard page={page} />
              </div>
            </div>
          </div>
        </section>

        <OneTwoThree />

        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-7xl mx-auto">
            <SectionIntro
              eyebrow={page.sectionEyebrow}
              icon={SectionIcon}
              headline={page.sectionHeadline}
              subhead={page.sectionSubhead}
            />
            <AdvantageGrid advantages={advantages} compact={page.advantageSet === 'on_premise'} />
            {page.showActivationIdeas && (
              <div className="mt-12">
                <ActivationIdeas />
              </div>
            )}
            <div className="text-center mt-10 lg:hidden">
              <InquiryCTA label={page.cta} onClick={openModal} />
            </div>
          </div>
        </section>

        <PromiseToPartners />
        <WhyDifferent />

        <section className="px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div
              className="rounded-3xl border-2 bg-gradient-to-b from-[#FF8C2A08] to-transparent p-10 sm:p-14 text-center"
              style={{ borderColor: '#FF8C2A33' }}
            >
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                {page.finalHeadline.pre}
                <span className="font-headline" style={{ color: ORANGE }}>
                  {page.finalHeadline.highlight}
                </span>
                {page.finalHeadline.post}
              </h2>
              <p className="text-untamed-white-muted text-lg mb-8 max-w-xl mx-auto">{page.finalSubhead}</p>
              <InquiryCTA label={page.cta} onClick={openModal} />
            </div>
          </motion.div>
        </section>
      </div>

      <footer className="border-t border-card-border px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <Image src="/images/logo-mark.png" alt="Untamed Beverages" width={32} height={32} className="h-8 w-8" />
            <span className="text-sm text-untamed-white-muted">1 can. 2 martinis. $3 per cocktail.</span>
          </a>
          <p className="text-xs text-muted">Must be 21+. Please drink responsibly.</p>
        </div>
      </footer>

      {!modalOpen && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-card-border bg-untamed-black/90 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <InquiryCTA label={page.cta} onClick={openModal} />
        </div>
      )}
    </div>
  )
}
