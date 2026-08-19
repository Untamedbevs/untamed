'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Heart } from 'lucide-react'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import {
  ACTIVATION_IDEAS,
  ONE_TWO_THREE,
  ORANGE,
  PROMISE_ITEMS,
  PROMISE_PARAGRAPHS,
  WHY_DIFFERENT,
  type Advantage,
} from '@/lib/retail/sell'
import { SELL_ICONS } from '@/components/retail/sell-icons'

export function ProductCans() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="flex justify-center gap-4 sm:gap-8"
    >
      {drinks.map((drink) => (
        <div key={drink.slug} className="text-center">
          <div className="relative w-16 h-28 sm:w-24 sm:h-40 mx-auto mb-2">
            <Image
              src={siteAssetAbsoluteUrl(drink.canImage)}
              alt={drink.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <p className="text-xs sm:text-sm text-untamed-white-muted">{drink.flavor}</p>
        </div>
      ))}
    </motion.div>
  )
}

export function OneTwoThree() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 mb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto"
      >
        <div className="rounded-3xl border-2 border-[#FF8C2A33] bg-gradient-to-b from-[#FF8C2A08] to-transparent p-8 sm:p-12 text-center">
          <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-8">
            The <span style={{ color: ORANGE }}>1-2-3</span> Advantage
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {ONE_TWO_THREE.items.map((item) => (
              <div key={item.label}>
                <p className="font-condensed text-5xl sm:text-6xl font-bold" style={{ color: ORANGE }}>
                  {item.num}
                </p>
                <p className="text-white font-medium mt-2">{item.label}</p>
                <p className="text-untamed-white-muted text-sm">{item.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-untamed-white-muted mt-8 max-w-2xl mx-auto">{ONE_TWO_THREE.footnote}</p>
        </div>
      </motion.div>
    </section>
  )
}

export function PromiseToPartners() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 mb-20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}
          >
            <Heart className="w-4 h-4" />
            Our Promise
          </div>
          <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
            Our Promise to <span style={{ color: ORANGE }}>Partners</span>
          </h2>
          <p className="text-untamed-white-muted text-lg max-w-3xl mx-auto">
            We will build this company with discipline. We will honor the brand, but we will also honor the numbers.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-6 text-untamed-white-muted text-base leading-relaxed"
          >
            {PROMISE_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>
                {paragraph.includes('Untamed') ? (
                  <>
                    {paragraph.split('Untamed')[0]}
                    <span className="font-headline text-white">Untamed</span>
                    {paragraph.split('Untamed')[1]}
                  </>
                ) : (
                  paragraph
                )}
              </p>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {PROMISE_ITEMS.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                className="flex gap-4 p-5 rounded-xl border border-card-border bg-untamed-black-card"
              >
                <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: ORANGE }} />
                <div>
                  <h3 className="font-bold text-white text-sm mb-1">{item.label}</h3>
                  <p className="text-xs text-untamed-white-muted leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export function AdvantageGrid({
  advantages,
  compact = false,
}: {
  advantages: Advantage[]
  compact?: boolean
}) {
  return (
    <div className={`grid sm:grid-cols-2 ${advantages.length > 4 ? 'lg:grid-cols-4' : ''} gap-6`}>
      {advantages.map((adv, i) => {
        const Icon = SELL_ICONS[adv.icon]
        return (
          <motion.div
            key={adv.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="rounded-2xl border border-card-border bg-untamed-black-card p-6"
          >
            <Icon className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} mb-3`} style={{ color: ORANGE }} />
            <h3 className={`font-bold text-white mb-2 ${compact ? 'text-sm' : ''}`}>{adv.title}</h3>
            <p className={`${compact ? 'text-xs' : 'text-sm'} text-untamed-white-muted leading-relaxed`}>
              {adv.description}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}

export function ActivationIdeas() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="rounded-2xl border border-card-border bg-untamed-black-card p-8"
    >
      <h3 className="font-condensed text-xl font-bold text-white uppercase mb-4">Activation Ideas</h3>
      <ul className="grid sm:grid-cols-2 gap-3">
        {ACTIVATION_IDEAS.map((idea) => (
          <li key={idea} className="flex items-start gap-2 text-sm text-untamed-white-muted">
            <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ORANGE }} />
            {idea}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

export function WhyDifferent() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 mb-20">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
            Why <span className="font-headline">Untamed</span> Is Different
          </h2>
        </motion.div>

        <div className="space-y-6">
          {WHY_DIFFERENT.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="flex gap-4 p-6 rounded-2xl border border-card-border bg-untamed-black-card"
            >
              <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: ORANGE }} />
              <div>
                <h3 className="font-bold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-untamed-white-muted leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SectionIntro({
  eyebrow,
  icon: Icon,
  headline,
  subhead,
}: {
  eyebrow: string
  icon: LucideIcon
  headline: { pre: string; highlight: string; post?: string; style?: 'brand' | 'orange' }
  subhead: string
}) {
  const brand = headline.style === 'brand'
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="text-center mb-12"
    >
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4"
        style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}
      >
        <Icon className="w-4 h-4" />
        {eyebrow}
      </div>
      <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
        {headline.pre}
        <span className={brand ? 'font-headline' : undefined} style={brand ? undefined : { color: ORANGE }}>
          {headline.highlight}
        </span>
        {headline.post}
      </h2>
      <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">{subhead}</p>
    </motion.div>
  )
}
