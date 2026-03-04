'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Mail, Loader2, Trophy, Gift, Receipt, ScanLine } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { drinks } from '@/lib/drinks'
import type { LoyaltyMember, LoyaltyTransaction, LoyaltyReceipt } from '@/lib/loyalty/types'
import { POINTS, REWARDS } from '@/lib/loyalty/constants'
import { useTracking } from '@/components/TrackingProvider'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { JoinForm } from './JoinForm'
import { MemberDashboard } from './MemberDashboard'
import { RewardsShowcase } from './RewardsShowcase'

type View = 'landing' | 'lookup' | 'dashboard'

const BRAND_COLOR = '#FFD700'
const BRAND_COLOR_LIGHT = '#FFA500'
const BRAND_GLOW = 'rgba(255, 215, 0, 0.3)'

interface LoyaltyLandingProps {
  drink?: Drink
}

function getTheme(drink?: Drink) {
  return {
    color: drink?.color || BRAND_COLOR,
    colorLight: drink?.colorLight || BRAND_COLOR_LIGHT,
    colorGlow: drink?.colorGlow || BRAND_GLOW,
  }
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

  const theme = getTheme(drink)

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
      <div className="min-h-screen bg-untamed-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.color }} />
      </div>
    )
  }

  return (
    <>
      <Navigation />

      <main>
        {/* ============================================
            HERO SECTION
            ============================================ */}
        <section className="relative min-h-screen flex items-center overflow-hidden">
          {drink?.scratchBackground && (
            <div className="absolute inset-0">
              <Image
                src={drink.scratchBackground}
                alt=""
                fill
                className="object-cover opacity-40"
                priority
                aria-hidden="true"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-untamed-black/80 via-untamed-black/60 to-untamed-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-untamed-black/70 to-transparent" />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 md:pt-32 md:pb-20">
            {drink && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Link
                  href={`/drinks/${drink.slug}`}
                  className="inline-flex items-center gap-2 text-untamed-white-muted hover:text-untamed-white transition-colors duration-300 mb-8 md:mb-12 text-sm tracking-wider uppercase"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {drink.name}
                </Link>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Text */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                <p
                  className="text-sm tracking-[0.3em] uppercase mb-3 font-medium"
                  style={{ color: theme.color }}
                >
                  {drink ? `${drink.name} Rewards` : 'Untamed Rewards'}
                </p>

                <h1
                  className="font-[var(--font-oswald)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold uppercase tracking-wider leading-none mb-3"
                  style={{ color: theme.color }}
                >
                  Join the Pack
                </h1>

                <p className="text-untamed-white-muted text-lg md:text-xl mb-8 max-w-xl">
                  Earn points with every purchase. Upload your receipts, unlock exclusive rewards, and unleash your wild side.
                </p>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4">
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${theme.color}40`, color: theme.color }}
                  >
                    <Sparkles className="w-4 h-4" />
                    {POINTS.SIGNUP_BONUS} pts signup bonus
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${theme.color}40`, color: theme.color }}
                  >
                    <Receipt className="w-4 h-4" />
                    {POINTS.PER_RECEIPT} pts per receipt
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${theme.color}40`, color: theme.color }}
                  >
                    <Gift className="w-4 h-4" />
                    {REWARDS.length} rewards to unlock
                  </div>
                </div>
              </motion.div>

              {/* Right: Can(s) + Animal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="relative flex items-center justify-center"
              >
                <div
                  className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full blur-[100px] opacity-30"
                  style={{ backgroundColor: theme.color }}
                />

                {drink ? (
                  <>
                    {drink.animalImage && (
                      <div className="absolute -bottom-8 -right-4 md:-right-8 w-40 h-56 md:w-56 md:h-72 opacity-30">
                        <Image
                          src={drink.animalImage}
                          alt={drink.animal}
                          fill
                          className="object-contain object-bottom"
                        />
                      </div>
                    )}
                    <div className="relative w-48 h-[380px] md:w-56 md:h-[440px] lg:w-64 lg:h-[500px] animate-float">
                      <Image
                        src={drink.canImage}
                        alt={`${drink.name} ${drink.flavor} Can`}
                        fill
                        className="object-contain drop-shadow-[0_0_40px_rgba(0,0,0,0.5)]"
                        priority
                      />
                    </div>
                  </>
                ) : (
                  <div className="relative flex items-end justify-center gap-2 sm:gap-4">
                    {drinks.map((d, i) => (
                      <motion.div
                        key={d.slug}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                        className="relative w-24 h-[190px] sm:w-32 sm:h-[250px] md:w-40 md:h-[310px] lg:w-44 lg:h-[340px]"
                        style={{ transform: `rotate(${(i - 1.5) * 4}deg)` }}
                      >
                        <Image
                          src={d.canImage}
                          alt={d.name}
                          fill
                          className="object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                          priority={i < 2}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            JOIN / LOOKUP / DASHBOARD SECTION
            ============================================ */}
        {view === 'landing' && (
          <>
            {/* Join Section */}
            <section className="relative py-20 md:py-28">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

              <div
                className="absolute top-1/2 left-0 w-72 h-72 rounded-full blur-[150px] opacity-10"
                style={{ backgroundColor: theme.color }}
              />
              <div
                className="absolute top-1/2 right-0 w-72 h-72 rounded-full blur-[150px] opacity-10"
                style={{ backgroundColor: theme.color }}
              />

              <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                  >
                    <Sparkles className="w-10 h-10 mb-4" style={{ color: theme.color }} />
                    <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                      Get Started
                    </h2>
                    <p className="text-untamed-white-muted text-base md:text-lg leading-relaxed mb-6">
                      Enter your name and email to join. It&apos;s free, takes 5 seconds, and you&apos;ll earn {POINTS.SIGNUP_BONUS} points just for signing up.
                    </p>
                    <button
                      onClick={() => setView('lookup')}
                      className="text-untamed-white-muted text-sm hover:text-untamed-white transition-colors underline underline-offset-4"
                    >
                      Already a member? Check your rewards
                    </button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="flex justify-center"
                  >
                    <JoinForm
                      drink={drink || drinks[0]}
                      visitorId={visitorId}
                      onJoined={handleJoined}
                      accentColor={theme.color}
                      accentGlow={theme.colorGlow}
                    />
                  </motion.div>
                </div>
              </div>
            </section>

            {/* How It Works Section */}
            <section className="relative py-20 md:py-28 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

              <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-12">
                    How It Works
                  </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                  {[
                    { step: '01', title: 'Join the Pack', desc: 'Sign up with your email. Instant signup bonus points.' },
                    { step: '02', title: 'Upload Receipts', desc: 'Snap a photo of your purchase receipt. We verify and credit your points.' },
                    { step: '03', title: 'Unlock Rewards', desc: 'Redeem points for exclusive Untamed merch, glassware, and variety packs.' },
                  ].map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: idx * 0.15 }}
                      className="text-center"
                    >
                      <p
                        className="font-[var(--font-oswald)] text-5xl md:text-6xl font-bold mb-3 opacity-30"
                        style={{ color: theme.color }}
                      >
                        {item.step}
                      </p>
                      <h3
                        className="font-[var(--font-oswald)] text-xl md:text-2xl font-bold uppercase tracking-wider mb-3"
                        style={{ color: theme.color }}
                      >
                        {item.title}
                      </h3>
                      <p className="text-untamed-white-muted text-sm md:text-base">
                        {item.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Rewards Showcase Section */}
            <section className="relative py-20 md:py-28">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="text-center mb-12"
                >
                  <p
                    className="text-sm tracking-[0.3em] uppercase mb-3"
                    style={{ color: theme.color }}
                  >
                    Earn &amp; Redeem
                  </p>
                  <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white">
                    Available Rewards
                  </h2>
                </motion.div>

                <RewardsShowcase
                  accentColor={theme.color}
                />
              </div>
            </section>
          </>
        )}

        {view === 'lookup' && (
          <section className="relative py-20 md:py-28">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

            <div className="max-w-md mx-auto px-4 sm:px-6 text-center space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Trophy className="w-12 h-12 mx-auto mb-4" style={{ color: theme.color }} />
                <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-2">
                  Welcome Back
                </h2>
                <p className="text-untamed-white-muted text-base mb-8">
                  Enter your email to view your rewards.
                </p>

                <form onSubmit={handleLookup} className="space-y-4">
                  <div className="relative">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                      style={{ color: theme.color }}
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none"
                    />
                  </div>

                  {lookupError && <p className="text-red-400 text-sm">{lookupError}</p>}

                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="w-full py-3.5 rounded-full font-bold text-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
                    style={{ backgroundColor: theme.color }}
                  >
                    {lookupLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      'View My Rewards'
                    )}
                  </button>
                </form>

                <button
                  onClick={() => setView('landing')}
                  className="text-untamed-white-muted text-sm hover:text-untamed-white transition-colors underline underline-offset-4 mt-4"
                >
                  New here? Join the Pack
                </button>
              </motion.div>
            </div>
          </section>
        )}

        {view === 'dashboard' && member && (
          <section className="relative py-20 md:py-28">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <MemberDashboard
                  drink={drink || drinks[0]}
                  member={member}
                  transactions={transactions}
                  receipts={receipts}
                  onRefresh={handleRefresh}
                  accentColor={theme.color}
                  accentGlow={theme.colorGlow}
                />
              </motion.div>
            </div>
          </section>
        )}
        {/* ============================================
            QR CODE CALLOUT SECTION
            ============================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[180px] opacity-10"
            style={{ backgroundColor: theme.color }}
          />

          <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center"
            >
              <ScanLine className="w-10 h-10 mb-4" style={{ color: theme.color }} />
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                Scan to Join
              </h2>
              <p className="text-untamed-white-muted text-base md:text-lg max-w-lg mb-8">
                Scan the QR code on any Untamed can or box to come straight here and start earning rewards!
              </p>

              <div
                className="relative p-4 rounded-2xl border bg-white inline-block"
                style={{ borderColor: `${theme.color}40` }}
              >
                <Image
                  src={drink ? `/images/qr/qr-${drink.slug}.png` : '/images/qr/qr-rewards-generic.png'}
                  alt="Scan to join Untamed Rewards"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              <p className="text-muted text-xs mt-4 uppercase tracking-wider">
                {drink ? `${drink.name} Rewards` : 'Untamed Rewards'} &bull; Scan with your phone camera
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
