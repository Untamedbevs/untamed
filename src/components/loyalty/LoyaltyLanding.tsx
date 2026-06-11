'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Loader2, Gift, Receipt, ScanLine } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { POINTS, REWARDS } from '@/lib/loyalty/constants'
import { useTracking } from '@/components/TrackingProvider'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { JoinForm } from './JoinForm'
import { RewardsShowcase } from './RewardsShowcase'

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
  const theme = getTheme(drink)

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
        <section className="relative overflow-hidden">
          {drink?.scratchBackground && (
            <div className="absolute inset-0">
              <Image
                src={siteAssetAbsoluteUrl(drink.scratchBackground)}
                alt=""
                fill
                className="object-cover opacity-40"
                priority
                unoptimized
                aria-hidden="true"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-untamed-black/80 via-untamed-black/60 to-untamed-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-untamed-black/70 to-transparent" />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
            {drink && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <a
                  href={`/drinks/${drink.slug}`}
                  className="inline-flex items-center gap-2 text-untamed-white-muted hover:text-untamed-white transition-colors duration-300 mb-8 md:mb-12 text-sm tracking-wider uppercase"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {drink.name}
                </a>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              {/* Left: headline + can(s) + quick stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center lg:text-left"
              >
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-[0.25em] uppercase mb-5 border"
                  style={{
                    backgroundColor: `${theme.color}0D`,
                    color: theme.color,
                    borderColor: `${theme.color}40`,
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {drink ? `${drink.name} Rewards` : 'Untamed Rewards'}
                </div>

                <h1
                  className="font-condensed text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-wider leading-none mb-4"
                  style={{ color: theme.color }}
                >
                  Join the Pack
                </h1>

                <p className="text-base md:text-lg text-untamed-white-muted mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Earn points with every purchase. Upload your receipts, unlock exclusive rewards, and <span className="font-wild cyber-brush-fix text-lg md:text-xl">unleash</span> your <span className="font-wild cyber-brush-fix text-lg md:text-xl">wild side</span>.
                </p>

                {/* Can(s) */}
                <div className="relative flex items-end justify-center lg:justify-start gap-2 sm:gap-4 mb-8">
                  <div
                    className="absolute bottom-0 left-1/2 lg:left-1/3 -translate-x-1/2 w-80 h-48 rounded-full blur-[120px] opacity-30 pointer-events-none"
                    style={{ backgroundColor: theme.color }}
                  />
                  {drink ? (
                    <>
                      {drink.animalImage && (
                        <div className="absolute -bottom-4 right-0 lg:right-auto lg:left-32 w-32 h-44 md:w-40 md:h-56 opacity-30 pointer-events-none">
                          <Image
                            src={siteAssetAbsoluteUrl(drink.animalImage)}
                            alt={drink.animal}
                            fill
                            className="object-contain object-bottom"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="relative w-32 h-[250px] sm:w-36 sm:h-[280px] md:w-40 md:h-[310px] animate-float">
                        <Image
                          src={siteAssetAbsoluteUrl(drink.canImage)}
                          alt={`${drink.name} ${drink.flavor} Can`}
                          fill
                          className="object-contain drop-shadow-[0_0_40px_rgba(0,0,0,0.5)]"
                          priority
                          unoptimized
                        />
                      </div>
                    </>
                  ) : (
                    drinks.map((d, i) => (
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
                    ))
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
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

              {/* Right: inline join (above the fold) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="w-full max-w-md mx-auto"
              >
                <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5" style={{ color: theme.color }} />
                    <h2 className="font-bold text-white text-xl">Get Started</h2>
                  </div>
                  <p className="text-sm text-untamed-white-muted mb-6">
                    Enter your name and email. We&apos;ll send a 6-digit code
                    &mdash; no password needed &mdash; and you&apos;ll earn{' '}
                    {POINTS.SIGNUP_BONUS} points just for signing up.
                  </p>
                  <JoinForm
                    drink={drink || drinks[0]}
                    visitorId={visitorId}
                    accentColor={theme.color}
                    accentGlow={theme.colorGlow}
                  />
                  <Link
                    href="/portal/login?returnTo=%2Fportal"
                    className="inline-block mt-4 text-untamed-white-muted text-sm hover:text-untamed-white transition-colors underline underline-offset-4"
                  >
                    Already a member? Sign in
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            HOW IT WORKS SECTION
            ============================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-condensed text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-12">
                How It Works
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {[
                { step: '01', title: 'Join the Pack', desc: 'Sign up with your email and a 6-digit code. Instant signup bonus points.' },
                { step: '02', title: 'Upload Receipts', desc: 'Snap a photo of your purchase receipt. We verify and credit your points.' },
                { step: '03', title: 'Unlock Rewards', desc: 'Redeem points for exclusive Untamed merch, glassware, and stickers.' },
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
                    className="font-condensed text-5xl md:text-6xl font-bold mb-3 opacity-30"
                    style={{ color: theme.color }}
                  >
                    {item.step}
                  </p>
                  <h3
                    className="font-condensed text-xl md:text-2xl font-bold uppercase tracking-wider mb-3"
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

        {/* ============================================
            REWARDS SHOWCASE SECTION
            ============================================ */}
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
              <h2 className="font-condensed text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white">
                Available Rewards
              </h2>
            </motion.div>

            <RewardsShowcase accentColor={theme.color} />
          </div>
        </section>

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
              <h2 className="font-condensed text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                Scan to Join
              </h2>
              <p className="text-untamed-white-muted text-base md:text-lg max-w-lg mb-8">
                Scan the QR code on any <span className="font-headline">Untamed</span> can or box to come straight here and start earning rewards!
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
