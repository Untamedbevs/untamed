'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight,
  Share2,
  TrendingUp,
  Users,
  Building2,
  LogIn,
  Sparkles,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import type { ReferralRewardTier } from '@/lib/referral/types'

const GOLD = '#FFD700'
const GOLD_GLOW = 'rgba(255, 215, 0, 0.3)'

const PORTAL_REFERRALS = '/portal/login?returnTo=%2Fportal%2Freferrals'

export default function ReferralPage() {
  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ backgroundColor: '#FFD7001A', color: GOLD }}
            >
              <Share2 className="w-4 h-4" />
              Referral Program
            </div>

            <h1 className="font-condensed text-4xl sm:text-5xl font-bold text-white uppercase mb-4">
              Spread the <span style={{ color: GOLD }}>Wild</span>
            </h1>
            <p className="text-lg text-untamed-white-muted mb-10 max-w-2xl mx-auto">
              Share Untamed with friends and businesses. Earn rewards for every
              signup and retailer lead you bring to the pack. Your personal link
              and live dashboard live in your member portal.
            </p>

            {/* Primary CTA into the portal */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
              <Link
                href={PORTAL_REFERRALS}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-black uppercase tracking-wider text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                style={{ backgroundColor: GOLD, boxShadow: `0 0 20px ${GOLD_GLOW}` }}
              >
                <LogIn className="w-5 h-5" />
                Sign In to Get My Link
              </Link>
              <Link
                href={PORTAL_REFERRALS}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-white uppercase tracking-wider text-sm border border-card-border transition-all duration-300 hover:border-white/40"
              >
                Create an Account
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

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
                    icon: LogIn,
                    title: 'Sign in',
                    body: 'Log into your member portal to activate your personal referral code and dashboard.',
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
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: '#FFD7001A' }}
                      >
                        <Icon className="w-5 h-5" style={{ color: GOLD }} />
                      </div>
                      <h4 className="font-bold text-white mb-1">{step.title}</h4>
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
