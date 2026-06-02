'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Share2,
  TrendingUp,
  Users,
  Building2,
  Sparkles,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { JoinForm } from '@/components/loyalty/JoinForm'
import { useTracking } from '@/components/TrackingProvider'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import type { ReferralRewardTier } from '@/lib/referral/types'

const GOLD = '#FFD700'
const GOLD_GLOW = 'rgba(255, 215, 0, 0.3)'

const PORTAL_REFERRALS = '/portal/login?returnTo=%2Fportal%2Freferrals'

export default function ReferralPage() {
  const { visitorId } = useTracking()

  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <div className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Ambient glows */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full blur-[160px] opacity-20 pointer-events-none"
          style={{ backgroundColor: GOLD }}
        />
        <div
          className="absolute -top-10 right-0 w-72 h-72 rounded-full blur-[140px] opacity-10 pointer-events-none"
          style={{ backgroundColor: '#FF8C2A' }}
        />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Left: headline + cans + quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-[0.25em] uppercase mb-5 border"
                style={{
                  backgroundColor: '#FFD7000D',
                  color: GOLD,
                  borderColor: `${GOLD}40`,
                }}
              >
                <Share2 className="w-3.5 h-3.5" />
                Referral Program
              </div>

              <h1
                className="font-condensed text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-wider leading-none mb-4"
                style={{ color: GOLD }}
              >
                Spread the Wild
              </h1>
              <p className="text-base md:text-lg text-untamed-white-muted mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Share Untamed with friends and businesses. Earn rewards for every
                signup and retailer lead you bring to the pack &mdash; then watch
                it all in your member portal.
              </p>

              {/* Fanned cans */}
              <div className="relative flex items-end justify-center lg:justify-start gap-2 sm:gap-4 mb-8">
                <div
                  className="absolute bottom-0 left-1/2 lg:left-1/3 -translate-x-1/2 w-80 h-48 rounded-full blur-[120px] opacity-30 pointer-events-none"
                  style={{ backgroundColor: GOLD }}
                />
                {drinks.map((d, i) => (
                  <motion.div
                    key={d.slug}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                    className="relative w-20 h-[160px] sm:w-24 sm:h-[190px] md:w-28 md:h-[220px] lg:w-32 lg:h-[250px]"
                    style={{ transform: `rotate(${(i - 1.5) * 4}deg)` }}
                  >
                    <Image
                      src={siteAssetAbsoluteUrl(d.canImage)}
                      alt={d.name}
                      fill
                      className="object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                      priority={i < 2}
                      unoptimized
                    />
                  </motion.div>
                ))}
              </div>

              {/* Quick stats */}
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                  style={{ borderColor: `${GOLD}40`, color: GOLD }}
                >
                  <Users className="w-4 h-4" />
                  Earn on every signup
                </div>
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                  style={{ borderColor: `${GOLD}40`, color: GOLD }}
                >
                  <Building2 className="w-4 h-4" />
                  Bigger rewards for retailers
                </div>
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                  style={{ borderColor: `${GOLD}40`, color: GOLD }}
                >
                  <TrendingUp className="w-4 h-4" />
                  Unlock tier rewards
                </div>
              </div>
            </motion.div>

            {/* Right: inline join (above the fold) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5" style={{ color: GOLD }} />
                  <h2 className="font-bold text-white text-xl">
                    Get your referral link
                  </h2>
                </div>
                <p className="text-sm text-untamed-white-muted mb-6">
                  Enter your name and email. We&apos;ll send a 6-digit code
                  &mdash; no password needed &mdash; and drop you straight into
                  your referral dashboard.
                </p>
                <JoinForm
                  visitorId={visitorId}
                  accentColor={GOLD}
                  accentGlow={GOLD_GLOW}
                  redirectTo="/portal/referrals"
                />
                <Link
                  href={PORTAL_REFERRALS}
                  className="inline-block mt-4 text-untamed-white-muted text-sm hover:text-untamed-white transition-colors underline underline-offset-4"
                >
                  Already a member? Sign in
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Below-hero content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
            {/* Two referral paths explanation */}
            <div className="grid sm:grid-cols-2 gap-5 mb-12 text-left">
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#22c55e1A' }}
                  >
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="font-bold text-white text-lg">Refer Consumers</h3>
                </div>
                <p className="text-sm text-untamed-white-muted leading-relaxed mb-3">
                  Share your personal link with friends, family, and social
                  followers. When they sign up for the loyalty program or make a
                  purchase, you earn points and unlock reward tiers.
                </p>
                <ul className="space-y-1.5 text-sm text-untamed-white-muted">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-green-400 shrink-0" />
                    <span>Earn points for every new loyalty signup</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-green-400 shrink-0" />
                    <span>Bonus rewards when they make a purchase</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-green-400 shrink-0" />
                    <span>Share via text, social media, or email</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#FF8C2A1A' }}
                  >
                    <Building2 className="w-5 h-5 text-[#FF8C2A]" />
                  </div>
                  <h3 className="font-bold text-white text-lg">Refer Retailers</h3>
                </div>
                <p className="text-sm text-untamed-white-muted leading-relaxed mb-3">
                  Know a bar, restaurant, or liquor store that should carry
                  Untamed? Send them your retail referral link. When they submit
                  a lead form, you earn rewards for connecting us.
                </p>
                <ul className="space-y-1.5 text-sm text-untamed-white-muted">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-[#FF8C2A] shrink-0" />
                    <span>Earn bigger rewards for retailer leads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-[#FF8C2A] shrink-0" />
                    <span>Help your favorite spots stock Untamed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-[#FF8C2A] shrink-0" />
                    <span>Unlock top-tier rewards faster</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 mb-12 text-left">
              <h3 className="font-condensed text-xl font-bold text-white uppercase mb-5 text-center">
                How It Works
              </h3>
              <div className="grid sm:grid-cols-3 gap-5">
                {[
                  {
                    icon: Sparkles,
                    title: 'Join',
                    body: 'Sign up with your name and email above to activate your personal referral code and dashboard.',
                  },
                  {
                    icon: Share2,
                    title: 'Share your link',
                    body: 'Copy your link or send a warm intro by email. Anyone who clicks is tracked to you for 30 days.',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Earn rewards',
                    body: 'Get credit when they sign up or buy, and unlock tier rewards as your referrals add up.',
                  },
                ].map((step, i) => {
                  const Icon = step.icon
                  return (
                    <div key={i} className="flex flex-col">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#FFD7001A' }}
                        >
                          <Icon className="w-5 h-5" style={{ color: GOLD }} />
                        </div>
                        <h4 className="font-bold text-white text-lg">{step.title}</h4>
                      </div>
                      <p className="text-sm text-untamed-white-muted leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tier preview */}
            <TierPreview />

            {/* Closing CTA */}
            <div className="mt-12">
              <Link
                href={PORTAL_REFERRALS}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-black uppercase tracking-wider text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                style={{ backgroundColor: GOLD, boxShadow: `0 0 20px ${GOLD_GLOW}` }}
              >
                <Sparkles className="w-5 h-5" />
                Get My Referral Link
              </Link>
            </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}

function TierPreview() {
  const [tiers, setTiers] = useState<ReferralRewardTier[]>([])

  useEffect(() => {
    fetch('/api/referral/tiers')
      .then((res) => res.json())
      .then((data) => setTiers(data.tiers || []))
      .catch(() => {})
  }, [])

  if (!tiers.length) return null

  return (
    <div>
      <h3 className="font-condensed text-xl font-bold text-white uppercase mb-6">
        Rewards You Can Earn
      </h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="rounded-2xl border border-card-border bg-untamed-black-card p-5 text-left"
          >
            <h4 className="font-bold text-white mb-1">{tier.tier_name}</h4>
            <p className="text-sm text-muted-foreground">{tier.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
