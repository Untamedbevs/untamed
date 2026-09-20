'use client'

import { motion } from 'framer-motion'
import { Check, Instagram, Sparkles, X } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { ProductCans } from '@/components/retail/SellSections'
import { ApplyCTA } from '@/components/influencers/ApplyCTA'
import { ApplyForm } from '@/components/influencers/ApplyForm'
import { CREATOR_PURPLE } from '@/lib/influencers/constants'
import {
  CONTENT_IDEAS,
  FILMS_WELL,
  FIT_NO,
  FIT_YES,
  HOW_IT_WORKS,
  WHAT_YOU_GET,
} from '@/lib/influencers/copy'

const PURPLE_SOFT = '#9B30FF1A'
const PURPLE_BORDER = '#9B30FF40'

export default function InfluencersPage() {
  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <div className="pt-8 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
                style={{ backgroundColor: PURPLE_SOFT, color: CREATOR_PURPLE }}
              >
                <Sparkles className="w-4 h-4" />
                Creator Partnerships
              </div>

              <h1 className="font-condensed text-4xl sm:text-6xl lg:text-7xl font-bold text-white uppercase mb-6">
                Create with{' '}
                <span className="font-headline" style={{ color: CREATOR_PURPLE }}>
                  Untamed
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-untamed-white-muted max-w-3xl mx-auto mb-10">
                We&apos;re looking for creators who actually go out, host, and drink a real martini
                on camera. Instagram, TikTok, YouTube — if your audience is 21+ and your content
                has taste, apply.
              </p>

              <div className="flex flex-col items-center gap-5 mb-12">
                <ApplyCTA />
                <a
                  href="https://instagram.com/untamedbevs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-untamed-white-muted hover:text-white transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                  See how we show up @untamedbevs
                </a>
              </div>
            </motion.div>

            <ProductCans />
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto"
          >
            <div
              className="rounded-3xl border-2 bg-gradient-to-b from-[#9B30FF08] to-transparent p-8 sm:p-12 text-center"
              style={{ borderColor: PURPLE_BORDER }}
            >
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-8">
                How it <span style={{ color: CREATOR_PURPLE }}>works</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                {HOW_IT_WORKS.map((item) => (
                  <div key={item.label}>
                    <p
                      className="font-condensed text-5xl sm:text-6xl font-bold"
                      style={{ color: CREATOR_PURPLE }}
                    >
                      {item.num}
                    </p>
                    <p className="text-white font-medium mt-2">{item.label}</p>
                    <p className="text-untamed-white-muted text-sm mt-1">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Who this is <span style={{ color: CREATOR_PURPLE }}>for</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                We don&apos;t work with everyone. That&apos;s the point.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8">
                <p className="text-sm font-medium uppercase tracking-wider text-green-400 mb-4">
                  A fit
                </p>
                <ul className="space-y-3">
                  {FIT_YES.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-untamed-white-muted">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8">
                <p className="text-sm font-medium uppercase tracking-wider text-red-400 mb-4">
                  Not a fit
                </p>
                <ul className="space-y-3">
                  {FIT_NO.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-untamed-white-muted">
                      <X className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                What you <span style={{ color: CREATOR_PURPLE }}>get</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {WHAT_YOU_GET.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6"
                >
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-untamed-white-muted leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Why it <span className="font-headline">films</span>
              </h2>
            </div>
            <div className="space-y-4">
              {FILMS_WELL.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.04 }}
                  className="flex gap-4 p-6 rounded-2xl border border-card-border bg-untamed-black-card"
                >
                  <div
                    className="w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: CREATOR_PURPLE }}
                  />
                  <div>
                    <h3 className="font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-untamed-white-muted leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto rounded-2xl border border-card-border bg-untamed-black-card p-8"
          >
            <h3 className="font-condensed text-xl font-bold text-white uppercase mb-4">
              Content that works
            </h3>
            <ul className="grid sm:grid-cols-2 gap-3">
              {CONTENT_IDEAS.map((idea) => (
                <li key={idea} className="flex gap-2 text-sm text-untamed-white-muted">
                  <span style={{ color: CREATOR_PURPLE }}>–</span>
                  {idea}
                </li>
              ))}
            </ul>
            <p className="text-xs text-untamed-white-muted/70 mt-6">
              Must be 21+. Always drink responsibly. Paid partnerships are disclosed.
            </p>
          </motion.div>
        </section>

        <section id="apply" className="px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-3xl border-2 bg-gradient-to-b from-[#9B30FF08] to-transparent p-6 sm:p-10"
              style={{ borderColor: PURPLE_BORDER }}
            >
              <div className="text-center mb-8">
                <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-3">
                  Apply to <span style={{ color: CREATOR_PURPLE }}>partner</span>
                </h2>
                <p className="text-untamed-white-muted">
                  We review every application. If it&apos;s not a fit, we&apos;ll still tell you.
                </p>
              </div>
              <ApplyForm />
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
