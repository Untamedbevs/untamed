'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, Loader2, Mail, User, Share2,
  TrendingUp, Users, Building2, MousePointerClick,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { ReferralLinkCard } from '@/components/referral/ReferralLinkCard'
import { TierProgress } from '@/components/referral/TierProgress'
import { ShareTabs } from '@/components/referral/ShareTabs'
import type {
  ReferralParticipant,
  ReferralRewardTier,
  ReferralRewardEarned,
  ReferralInvite,
} from '@/lib/referral/types'

const GOLD = '#FFD700'
const GOLD_GLOW = 'rgba(255, 215, 0, 0.3)'

export default function ReferralPage() {
  const [participant, setParticipant] = useState<ReferralParticipant | null>(null)
  const [tiers, setTiers] = useState<ReferralRewardTier[]>([])
  const [rewards, setRewards] = useState<ReferralRewardEarned[]>([])
  const [invites, setInvites] = useState<ReferralInvite[]>([])
  const [consumerLink, setConsumerLink] = useState('')
  const [distributorLink, setDistributorLink] = useState('')

  const [view, setView] = useState<'landing' | 'dashboard'>('landing')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoChecked, setAutoChecked] = useState(false)

  // Code customization
  const [editingCode, setEditingCode] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError, setCodeError] = useState('')

  const loadDashboard = useCallback(async (memberEmail: string) => {
    try {
      const res = await fetch(`/api/referral/dashboard?email=${encodeURIComponent(memberEmail)}`)
      if (!res.ok) return false
      const data = await res.json()
      setParticipant(data.participant)
      setTiers(data.tiers)
      setRewards(data.rewards)
      setInvites(data.invites)
      setConsumerLink(data.consumerLink)
      setDistributorLink(data.distributorLink)
      setView('dashboard')
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (autoChecked) return
    setAutoChecked(true)
    const savedEmail = localStorage.getItem('ut_referral_email')
    if (savedEmail) {
      loadDashboard(savedEmail)
    }
  }, [autoChecked, loadDashboard])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/referral/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to join')
      }

      const data = await res.json()
      localStorage.setItem('ut_referral_email', data.participant.email)
      localStorage.setItem('ut_loyalty_email', data.participant.email)
      setParticipant(data.participant)
      setConsumerLink(data.consumerLink)
      setDistributorLink(data.distributorLink)

      // Load full dashboard (tiers, rewards, invites)
      await loadDashboard(data.participant.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeChange() {
    setCodeLoading(true)
    setCodeError('')

    try {
      const res = await fetch('/api/referral/code', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: participant?.email, newCode }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update code')
      }

      const data = await res.json()
      setParticipant(data.participant)
      setConsumerLink(data.consumerLink)
      setDistributorLink(data.distributorLink)
      setEditingCode(false)
      setNewCode('')
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setCodeLoading(false)
    }
  }

  // Landing / enrollment view
  if (view === 'landing') {
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
              <p className="text-lg text-untamed-white-muted mb-10">
                Share Untamed with friends and businesses. Earn rewards for every signup and
                retailer lead you bring to the pack.
              </p>

              {/* Inline enrollment form */}
              <form onSubmit={handleJoin} className="mb-10">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <User
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                      style={{ color: GOLD }}
                    />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="relative flex-1">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                      style={{ color: GOLD }}
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-black uppercase tracking-wider text-sm whitespace-nowrap transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    style={{ backgroundColor: GOLD, boxShadow: `0 0 20px ${GOLD_GLOW}` }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Get My Links
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
                {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}
              </form>

              {/* Two referral paths explanation */}
              <div className="grid sm:grid-cols-2 gap-5 mb-10 text-left">
                <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#22c55e1A' }}>
                      <Users className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Refer Consumers</h3>
                  </div>
                  <p className="text-sm text-untamed-white-muted leading-relaxed mb-3">
                    Share your personal link with friends, family, and social followers. When they sign up for the loyalty program or make a purchase, you earn points and unlock reward tiers.
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FF8C2A1A' }}>
                      <Building2 className="w-5 h-5 text-[#FF8C2A]" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Refer Retailers</h3>
                  </div>
                  <p className="text-sm text-untamed-white-muted leading-relaxed mb-3">
                    Know a bar, restaurant, or liquor store that should carry Untamed? Send them your retail referral link. When they submit a lead form, you earn rewards for connecting us.
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

              {/* Tier preview */}
              <TierPreview />
            </motion.div>
          </div>
        </div>

        <Footer />
      </div>
    )
  }

  // Dashboard view
  if (!participant) return null

  // Compute click breakdown from events (approximate from total)
  const consumerClicks = participant.total_clicks
  const stats = [
    { label: 'Total Clicks', value: consumerClicks, icon: MousePointerClick, color: '#FFD700' },
    { label: 'Consumer Signups', value: participant.consumer_signups, icon: Users, color: '#22c55e' },
    { label: 'Distributor Leads', value: participant.distributor_leads, icon: Building2, color: '#FF8C2A' },
    { label: 'Paid Conversions', value: participant.paid_conversions, icon: TrendingUp, color: '#9B30FF' },
  ]

  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Header */}
            <div className="text-center mb-10">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4"
                style={{ backgroundColor: '#FFD7001A', color: GOLD }}
              >
                <Share2 className="w-4 h-4" />
                Your Referral Dashboard
              </div>
              <h1 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase">
                Welcome back, <span style={{ color: GOLD }}>{participant.display_name || 'Pack Member'}</span>
              </h1>
            </div>

            {/* Referral links */}
            <div className="grid sm:grid-cols-2 gap-6 mb-10">
              <ReferralLinkCard
                type="consumer"
                link={consumerLink}
                clicks={participant.total_clicks}
                conversions={participant.consumer_signups}
              />
              <ReferralLinkCard
                type="distributor"
                link={distributorLink}
                clicks={participant.total_clicks}
                conversions={participant.distributor_leads}
              />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-4 text-center"
                >
                  <stat.icon className="w-5 h-5 mx-auto mb-2" style={{ color: stat.color }} />
                  <p className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Code customization */}
            <div className="rounded-2xl border-2 border-card-border bg-untamed-black-card p-6 mb-10">
              <h3 className="font-bold text-white mb-3">Your Referral Code</h3>
              {editingCode ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="New code (2-20 chars, lowercase)"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toLowerCase())}
                    maxLength={20}
                    className="w-full px-4 py-3 bg-untamed-black border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none text-sm font-mono"
                  />
                  {codeError && <p className="text-red-400 text-sm">{codeError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCodeChange}
                      disabled={codeLoading || !newCode}
                      className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                      {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingCode(false); setCodeError('') }}
                      className="px-6 py-2.5 rounded-full border border-card-border text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <code className="text-lg font-mono text-yellow-400">{participant.referral_code}</code>
                  <button
                    onClick={() => { setEditingCode(true); setNewCode(participant.referral_code) }}
                    className="text-sm text-muted-foreground hover:text-white transition-colors underline"
                  >
                    Customize
                  </button>
                </div>
              )}
            </div>

            {/* Share tabs */}
            <div className="mb-10">
              <h3 className="font-bold text-white text-lg mb-4">Share Untamed</h3>
              <ShareTabs
                consumerLink={consumerLink}
                distributorLink={distributorLink}
                customMessage={participant.custom_message}
                email={participant.email}
                invites={invites}
                onMessageSaved={(msg) =>
                  setParticipant((p) => (p ? { ...p, custom_message: msg } : p))
                }
                onInviteSent={(invite) => setInvites((prev) => [invite, ...prev])}
              />
            </div>

            {/* Tier progress */}
            <div className="mb-10">
              <h3 className="font-bold text-white text-lg mb-4">Reward Tiers</h3>
              <TierProgress
                tiers={tiers}
                rewards={rewards}
                consumerSignups={participant.consumer_signups}
                distributorLeads={participant.distributor_leads}
              />
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
    <div className="mt-12">
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
