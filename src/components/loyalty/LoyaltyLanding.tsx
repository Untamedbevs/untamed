'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Mail, Loader2 } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import type { LoyaltyMember, LoyaltyTransaction, LoyaltyReceipt } from '@/lib/loyalty/types'
import { POINTS } from '@/lib/loyalty/constants'
import { useTracking } from '@/components/TrackingProvider'
import { JoinForm } from './JoinForm'
import { MemberDashboard } from './MemberDashboard'
import { RewardsShowcase } from './RewardsShowcase'

type View = 'landing' | 'lookup' | 'dashboard'

interface LoyaltyLandingProps {
  drink: Drink
}

export function LoyaltyLanding({ drink }: LoyaltyLandingProps) {
  const { visitorId, ready } = useTracking()
  const [view, setView] = useState<View>('landing')
  const [member, setMember] = useState<LoyaltyMember | null>(null)
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [receipts, setReceipts] = useState<LoyaltyReceipt[]>([])
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [autoChecked, setAutoChecked] = useState(false)

  const loadMember = useCallback(async (email: string) => {
    const res = await fetch('/api/loyalty/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.found) {
      setMember(data.member)
      setTransactions(data.transactions)
      setReceipts(data.receipts)
      setView('dashboard')
      return true
    }
    return false
  }, [])

  useEffect(() => {
    if (autoChecked) return
    setAutoChecked(true)
    const savedEmail = localStorage.getItem('ut_loyalty_email')
    if (savedEmail) {
      loadMember(savedEmail)
    }
  }, [autoChecked, loadMember])

  function handleJoined(newMember: Record<string, unknown>) {
    setMember(newMember as unknown as LoyaltyMember)
    setTransactions([])
    setReceipts([])
    setView('dashboard')
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLookupLoading(true)
    setLookupError('')
    const found = await loadMember(lookupEmail)
    if (found) {
      localStorage.setItem('ut_loyalty_email', lookupEmail.toLowerCase().trim())
    } else {
      setLookupError('No account found with that email.')
    }
    setLookupLoading(false)
  }

  function handleRefresh() {
    if (member) {
      loadMember(member.email)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: drink.color }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Hero */}
      <section className="relative min-h-[50vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={drink.scratchBackground}
            alt=""
            fill
            className="object-cover opacity-30"
            priority
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/80 via-[#0A0A0A]/60 to-[#0A0A0A]" />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              href={`/drinks/${drink.slug}`}
              className="inline-flex items-center gap-2 text-[#A0A0A0] hover:text-white transition-colors text-sm tracking-wider uppercase mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {drink.name}
            </Link>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Can */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="relative shrink-0"
            >
              <div
                className="absolute inset-0 rounded-full blur-[60px] opacity-20"
                style={{ backgroundColor: drink.color }}
              />
              <div className="relative w-32 h-[250px] md:w-40 md:h-[310px] animate-float">
                <Image
                  src={drink.canImage}
                  alt={`${drink.name} ${drink.flavor}`}
                  fill
                  className="object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                  priority
                />
              </div>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <p
                className="text-sm tracking-[0.3em] uppercase mb-2 font-medium"
                style={{ color: drink.color }}
              >
                {drink.name} Rewards
              </p>
              <h1 className="font-[var(--font-oswald)] text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-wider text-white leading-tight mb-4">
                Join the Pack
              </h1>
              <p className="text-[#A0A0A0] text-base md:text-lg max-w-lg">
                Earn points with every purchase. Upload your receipts, unlock exclusive rewards, and unleash your wild side.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-20">
        {view === 'landing' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            {/* Quick value props */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Signup Bonus', value: `${POINTS.SIGNUP_BONUS} pts` },
                { label: 'Per Receipt', value: `${POINTS.PER_RECEIPT} pts` },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-4 rounded-xl border border-[#2A2A2A] bg-[#141414] text-center"
                >
                  <p
                    className="font-[var(--font-oswald)] text-2xl font-bold"
                    style={{ color: drink.color }}
                  >
                    {item.value}
                  </p>
                  <p className="text-[#999] text-xs uppercase tracking-wider mt-1">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Join Form */}
            <div className="flex flex-col items-center text-center space-y-4">
              <Sparkles className="w-8 h-8" style={{ color: drink.color }} />
              <h2 className="font-[var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white">
                Get Started
              </h2>
              <JoinForm
                drink={drink}
                visitorId={visitorId}
                onJoined={handleJoined}
              />
            </div>

            {/* Already a member link */}
            <div className="text-center">
              <button
                onClick={() => setView('lookup')}
                className="text-[#999] text-sm hover:text-white transition-colors underline underline-offset-4"
              >
                Already a member? Check your rewards
              </button>
            </div>

            {/* Rewards Preview */}
            <RewardsShowcase drink={drink} />
          </motion.div>
        )}

        {view === 'lookup' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="font-[var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white">
                Welcome Back
              </h2>
              <p className="text-[#999] text-sm">Enter your email to view your rewards.</p>
            </div>

            <form onSubmit={handleLookup} className="flex flex-col items-center gap-4 max-w-md mx-auto">
              <div className="relative w-full">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: drink.color }}
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-white placeholder:text-[#666] focus:outline-none"
                />
              </div>

              {lookupError && <p className="text-red-400 text-sm">{lookupError}</p>}

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full py-3.5 rounded-xl font-bold text-black uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ backgroundColor: drink.color }}
              >
                {lookupLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'View My Rewards'
                )}
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setView('landing')}
                className="text-[#999] text-sm hover:text-white transition-colors underline underline-offset-4"
              >
                New here? Join the Pack
              </button>
            </div>
          </motion.div>
        )}

        {view === 'dashboard' && member && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MemberDashboard
              drink={drink}
              member={member}
              transactions={transactions}
              receipts={receipts}
              onRefresh={handleRefresh}
            />
          </motion.div>
        )}
      </section>
    </div>
  )
}
