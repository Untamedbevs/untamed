'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { DistributorLeadForm } from '@/components/referral/DistributorLeadForm'
import type { RetailLandingPage } from '@/lib/retail/landing-pages'
import { drinks } from '@/lib/drinks'

const ORANGE = '#FF8C2A'

export function RetailCampaignLanding({ page }: { page: RetailLandingPage }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-untamed-black text-untamed-white">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <a href="/" className="flex items-center gap-2.5">
          <Image src="/images/logo-mark.png" alt="Untamed Beverages" width={36} height={36} className="h-9 w-9" />
          <span className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-untamed-white-muted">
            Untamed
          </span>
        </a>
        <p className="font-condensed text-[11px] uppercase tracking-[0.3em] text-muted">{page.eyebrow}</p>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-6 md:grid-cols-2 md:px-10 md:pt-10">
        <div>
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.35em] text-[#FFD700]">
            {page.audience}
          </p>
          <h1 className="mt-3 font-condensed text-4xl font-bold uppercase leading-[1.05] tracking-tight md:text-5xl">
            {page.headline}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-untamed-white-muted md:text-lg">
            {page.subhead}
          </p>
          <ul className="mt-8 space-y-3">
            {page.proof.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm md:text-base">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFD700]/15">
                  <Check className="h-3.5 w-3.5 text-[#FFD700]" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-8 inline-flex rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-[1.02] md:hidden"
            style={{ backgroundColor: ORANGE }}
          >
            {page.cta}
          </button>
          <div className="mt-10 flex flex-wrap gap-3">
            {drinks.map((d) => (
              <span
                key={d.slug}
                className="rounded-full border border-card-border px-3 py-1 font-condensed text-[11px] uppercase tracking-widest text-untamed-white-muted"
              >
                {d.name}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden md:block">
          <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
            <h2 className="font-condensed text-2xl font-bold uppercase">{page.cta}</h2>
            <p className="mt-1 text-sm text-muted">We reach out within 48 hours.</p>
            <div className="mt-6">
              <Suspense fallback={null}>
                <DistributorLeadForm defaultBusinessType={page.defaultBusinessType} />
              </Suspense>
            </div>
          </div>
        </div>
      </main>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-4 md:hidden">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-card-border bg-untamed-black-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-condensed text-lg font-bold uppercase">{page.cta}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">
                Close
              </button>
            </div>
            <Suspense fallback={null}>
              <DistributorLeadForm defaultBusinessType={page.defaultBusinessType} onSuccess={() => setOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
