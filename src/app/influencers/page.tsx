'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  BadgeDollarSign,
  Check,
  Clapperboard,
  Instagram,
  Link2,
  Package,
  Sparkles,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { ApplyCTA } from '@/components/influencers/ApplyCTA'
import { ApplyForm } from '@/components/influencers/ApplyForm'
import { CREATOR_PURPLE } from '@/lib/influencers/constants'
import {
  CONTENT_IDEAS,
  FILMS_WELL,
  FIT_NO,
  FIT_YES,
  HOW_IT_WORKS,
  ON_CAMERA,
  WHAT_YOU_GET,
} from '@/lib/influencers/copy'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

const COASTER =
  'https://media.untamedbeverages.com/media/Site_Assets/Graphics/1780139299257-untamed_coaster_design-v2.png'

const GET_ICONS: LucideIcon[] = [Package, Clapperboard, BadgeDollarSign, Link2]

const LINE = [
  { num: '1', label: 'Can', detail: '12 oz · 15% ABV', color: 'var(--panther-light)' },
  { num: '2', label: 'Martinis', detail: 'Full 6 oz pours', color: 'var(--cheetah)' },
  { num: '$3', label: 'A cocktail', detail: 'The line in the caption', color: 'var(--lioness-light)' },
] as const

export default function InfluencersPage() {
  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-untamed-black via-untamed-black to-untamed-black-light" />
            <div className="absolute inset-0 opacity-20">
              <Image
                src={siteAssetAbsoluteUrl('/images/scratch-panther.png')}
                alt=""
                fill
                className="object-cover"
                priority
                aria-hidden="true"
                unoptimized
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-untamed-black/40 via-transparent to-untamed-black" />
            <div className="absolute top-1/4 left-[12%] w-96 h-96 rounded-full blur-[150px] opacity-25 bg-panther" />
            <div className="absolute bottom-0 right-[10%] w-96 h-96 rounded-full blur-[150px] opacity-20 bg-lioness" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-[120px] opacity-10 bg-cheetah" />
          </div>

          <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-10 pb-8 md:pt-16 md:pb-12">
            <div className="max-w-5xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                <Image
                  src={COASTER}
                  alt="Untamed Beverages"
                  width={400}
                  height={400}
                  className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 mx-auto mb-6 rounded-full"
                  priority
                  unoptimized
                />

                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
                  style={{ backgroundColor: '#9B30FF1A', color: CREATOR_PURPLE }}
                >
                  <Sparkles className="w-4 h-4" />
                  Creator Partnerships
                </div>

                <h1 className="font-condensed text-5xl sm:text-6xl lg:text-8xl font-bold text-white uppercase tracking-wide leading-[0.9] mb-5">
                  Create with{' '}
                  <span className="font-headline text-gradient-wild">Untamed</span>
                </h1>

                <p className="text-lg sm:text-xl text-untamed-white-muted max-w-2xl mx-auto mb-4">
                  We&apos;re looking for creators who actually go out, host, and drink a real martini
                  on camera. Instagram, TikTok, YouTube — if your audience is 21+ and your content
                  has taste, apply.
                </p>

                <p className="text-untamed-white-muted text-base md:text-lg tracking-wider mb-10">
                  Chill it. Shake it.{' '}
                  <span className="font-wild cyber-brush-fix text-untamed-white text-2xl md:text-3xl">
                    Unleash it!
                  </span>
                </p>

                <div className="flex flex-col items-center gap-5">
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
            </div>
          </div>
        </section>

        <section id="spirits" className="relative px-4 sm:px-6 lg:px-8 py-16 md:py-24 scroll-mt-24">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12 md:mb-16"
            >
              <p className="text-sm tracking-[0.3em] uppercase mb-3" style={{ color: CREATOR_PURPLE }}>
                The lineup
              </p>
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-white mb-4">
                Four spirits.{' '}
                <span className="font-headline text-gradient-wild">Four hooks.</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                People pick a cat. That&apos;s a series, a reason to come back, and a can that
                already looks like a night out.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
              {drinks.map((drink, index) => (
                <motion.article
                  key={drink.slug}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  className="group relative rounded-2xl overflow-hidden border border-card-border bg-untamed-black-card"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = drink.color
                    e.currentTarget.style.boxShadow = `0 0 48px ${drink.colorGlow}, 0 24px 60px rgba(0,0,0,0.45)`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = ''
                    e.currentTarget.style.boxShadow = ''
                  }}
                >
                  <div className="absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity duration-500">
                    <Image
                      src={siteAssetAbsoluteUrl(drink.scratchBackground)}
                      alt=""
                      fill
                      className="object-cover"
                      aria-hidden="true"
                      unoptimized
                    />
                  </div>
                  <div
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-[70px] opacity-40"
                    style={{ backgroundColor: drink.color }}
                  />
                  <div className="relative z-10 px-5 pt-8 pb-7 flex flex-col items-center text-center">
                    <div className="relative w-32 h-56 sm:w-36 sm:h-64 mb-6 group-hover:scale-105 transition-transform duration-500">
                      <Image
                        src={siteAssetAbsoluteUrl(drink.canImage)}
                        alt={`${drink.name} ${drink.flavor}`}
                        fill
                        className="object-contain drop-shadow-2xl"
                        unoptimized
                      />
                    </div>
                    <h3
                      className="font-wild cyber-brush-fix text-3xl md:text-4xl tracking-wider leading-none mb-2"
                      style={{ color: drink.color }}
                    >
                      {drink.name}
                    </h3>
                    <p className="text-white font-medium">{drink.flavor}</p>
                    <p className="text-untamed-white-muted text-sm mb-4">{drink.subtitle}</p>
                    <p className="text-sm text-untamed-white-muted leading-relaxed">
                      {ON_CAMERA[drink.slug]}
                    </p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 lg:px-8 py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute top-1/3 left-0 w-80 h-80 rounded-full blur-[160px] opacity-10 bg-panther" />
            <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[160px] opacity-10 bg-lioness" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <p className="text-sm tracking-[0.3em] uppercase mb-3" style={{ color: CREATOR_PURPLE }}>
              The line
            </p>
            <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-white mb-4">
              Say it in <span className="text-gradient-wild">one sentence</span>
            </h2>
            <p className="text-untamed-white-muted text-lg mb-12 max-w-xl mx-auto">
              If it takes more than this, we already lost the caption.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              {LINE.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                >
                  <p className="font-condensed text-7xl md:text-8xl font-bold leading-none" style={{ color: item.color }}>
                    {item.num}
                  </p>
                  <p className="text-white text-xl font-medium mt-2">{item.label}</p>
                  <p className="text-untamed-white-muted text-sm mt-1">{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto"
          >
            <div
              className="rounded-3xl border-2 bg-gradient-to-b from-[#9B30FF10] to-transparent p-8 sm:p-12 text-center"
              style={{ borderColor: '#9B30FF40' }}
            >
              <h2 className="font-condensed text-3xl sm:text-5xl font-bold text-white uppercase mb-10">
                How it <span style={{ color: CREATOR_PURPLE }}>works</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {HOW_IT_WORKS.map((item) => (
                  <div key={item.label}>
                    <p className="font-condensed text-6xl sm:text-7xl font-bold leading-none" style={{ color: CREATOR_PURPLE }}>
                      {item.num}
                    </p>
                    <p className="text-white font-medium text-lg mt-3">{item.label}</p>
                    <p className="text-untamed-white-muted text-sm mt-1">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-condensed text-3xl sm:text-5xl font-bold text-white uppercase mb-4">
                Who this is <span style={{ color: CREATOR_PURPLE }}>for</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                We don&apos;t work with everyone. That&apos;s the point.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-green-400/25 bg-untamed-black-card p-6 sm:p-8">
                <p className="text-sm font-medium uppercase tracking-wider text-green-400 mb-4">A fit</p>
                <ul className="space-y-3">
                  {FIT_YES.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-untamed-white-muted">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-red-400/25 bg-untamed-black-card p-6 sm:p-8">
                <p className="text-sm font-medium uppercase tracking-wider text-red-400 mb-4">Not a fit</p>
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

        <section className="px-4 sm:px-6 lg:px-8 pb-16 md:pb-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-condensed text-3xl sm:text-5xl font-bold text-white uppercase">
                What you <span style={{ color: CREATOR_PURPLE }}>get</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {WHAT_YOU_GET.map((item, i) => {
                const Icon = GET_ICONS[i] ?? Sparkles
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8"
                  >
                    <Icon className="w-7 h-7 mb-4" style={{ color: CREATOR_PURPLE }} />
                    <h3 className="font-bold text-white text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-untamed-white-muted leading-relaxed">{item.desc}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 pb-16 md:pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-condensed text-3xl sm:text-5xl font-bold text-white uppercase mb-4">
                Why it <span className="font-headline text-gradient-wild">films</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {FILMS_WELL.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.04 }}
                  className="flex gap-4 p-6 rounded-2xl border border-card-border bg-untamed-black-card"
                >
                  <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: CREATOR_PURPLE }} />
                  <div>
                    <h3 className="font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-untamed-white-muted leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 pb-16 md:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto rounded-3xl border border-[#9B30FF33] bg-gradient-to-b from-[#9B30FF0D] to-transparent p-8 sm:p-10"
          >
            <h3 className="font-condensed text-2xl sm:text-3xl font-bold text-white uppercase mb-6 text-center">
              Content that works
            </h3>
            <ul className="grid sm:grid-cols-2 gap-3">
              {CONTENT_IDEAS.map((idea) => (
                <li
                  key={idea}
                  className="flex gap-3 text-sm text-untamed-white-muted rounded-xl border border-card-border bg-untamed-black-card/80 px-4 py-3"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CREATOR_PURPLE }} />
                  {idea}
                </li>
              ))}
            </ul>
            <p className="text-xs text-untamed-white-muted/70 mt-6 text-center">
              Must be 21+. Always drink responsibly. Paid partnerships are disclosed.
            </p>
          </motion.div>
        </section>

        <section id="apply" className="px-4 sm:px-6 lg:px-8 pb-20 scroll-mt-24">
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-3xl border-2 bg-gradient-to-b from-[#9B30FF10] to-transparent p-6 sm:p-10"
              style={{ borderColor: '#9B30FF40' }}
            >
              <div className="text-center mb-8">
                <h2 className="font-condensed text-3xl sm:text-5xl font-bold text-white uppercase mb-3">
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
      </main>

      <Footer />
    </div>
  )
}
