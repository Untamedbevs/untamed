'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Loader2,
  ScanLine,
  Share2,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { useTracking } from '@/components/TrackingProvider'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { UgcVideo } from '@/components/ugc/UgcVideo'
import { JoinForm } from './JoinForm'

const BRAND_COLOR = '#FFD700'
const BRAND_COLOR_LIGHT = '#FFA500'
const BRAND_GLOW = 'rgba(255, 215, 0, 0.3)'

type JoinIntent = 'refer' | 'ugc' | null

const INTENT_DESTINATIONS: Record<Exclude<JoinIntent, null>, string> = {
  refer: '/portal/referrals',
  ugc: '/portal/ugc/new',
}

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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-untamed-black flex items-center justify-center">
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: getTheme(drink).color }}
          />
        </div>
      }
    >
      <LoyaltyLandingInner drink={drink} />
    </Suspense>
  )
}

function LoyaltyLandingInner({ drink }: LoyaltyLandingProps) {
  const { visitorId, ready } = useTracking()
  const theme = getTheme(drink)
  const searchParams = useSearchParams()

  const initialIntent = searchParams.get('intent')
  const [intent, setIntent] = useState<JoinIntent>(
    initialIntent === 'refer' || initialIntent === 'ugc' ? initialIntent : null
  )
  const joinCardRef = useRef<HTMLDivElement>(null)

  function chooseIntent(next: Exclude<JoinIntent, null>) {
    setIntent(next)
    joinCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-untamed-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.color }} />
      </div>
    )
  }

  const joinHeading =
    intent === 'ugc'
      ? 'Share Your First Moment'
      : intent === 'refer'
        ? 'Get Your Personal Link'
        : 'Get Started'

  const joinSubcopy =
    intent === 'ugc'
      ? "Enter your name and email. We'll send a 6-digit code — no password needed — and drop you right where you can post your photo or video."
      : intent === 'refer'
        ? "Enter your name and email. We'll send a 6-digit code — no password needed — and hand you your personal share link."
        : "Enter your name and email. We'll send a 6-digit code — no password needed — and you're in."

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
              {/* Left: headline + can(s) + community pills */}
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
                  The Untamed Pack
                </div>

                <h1
                  className="font-condensed text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-wider leading-none mb-4"
                  style={{ color: theme.color }}
                >
                  Join the Pack
                </h1>

                <p className="text-base md:text-lg text-untamed-white-muted mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Be part of <span className="font-headline">Untamed</span> from
                  day one. Share your moments, bring your friends, and get first
                  access to what&rsquo;s next.
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

                {/* Community pills — no points jargon */}
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${theme.color}40`, color: theme.color }}
                  >
                    <Camera className="w-4 h-4" />
                    Share your moments
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${theme.color}40`, color: theme.color }}
                  >
                    <Share2 className="w-4 h-4" />
                    Bring your friends
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${theme.color}40`, color: theme.color }}
                  >
                    <Sparkles className="w-4 h-4" />
                    First access to what&rsquo;s next
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
                <div
                  ref={joinCardRef}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8 text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5" style={{ color: theme.color }} />
                    <h2 className="font-bold text-white text-xl">{joinHeading}</h2>
                  </div>
                  <p className="text-sm text-untamed-white-muted mb-5">
                    {joinSubcopy}
                  </p>

                  {/* The single most important thing a past customer needs to know */}
                  <div
                    className="flex items-start gap-3 rounded-xl border px-4 py-3 mb-5"
                    style={{
                      borderColor: `${theme.color}40`,
                      backgroundColor: `${theme.color}0D`,
                    }}
                  >
                    <ShoppingBag
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: theme.color }}
                    />
                    <p className="text-sm text-untamed-white leading-relaxed">
                      <strong>Ordered from us before?</strong> Your account
                      already exists — it was created with your order and is
                      tied to the email you used at checkout. Enter that email
                      below and you&rsquo;re in.
                    </p>
                  </div>

                  <JoinForm
                    drink={drink || drinks[0]}
                    visitorId={visitorId}
                    accentColor={theme.color}
                    accentGlow={theme.colorGlow}
                    redirectTo={intent ? INTENT_DESTINATIONS[intent] : '/portal'}
                  />
                  <p className="mt-4 text-xs text-muted">
                    One form for everyone — new members are created on the
                    spot, and past customers pick up right where their orders
                    left off.{' '}
                    <Link
                      href={
                        intent
                          ? `/portal/login?returnTo=${encodeURIComponent(INTENT_DESTINATIONS[intent])}`
                          : '/portal/login?returnTo=%2Fportal'
                      }
                      className="underline underline-offset-2 hover:text-untamed-white transition-colors"
                    >
                      Have a password? Sign in here
                    </Link>
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            TWO WAYS IN — Share a moment / Bring a friend
            ============================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="font-condensed text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-3">
                Be Part of It
              </h2>
              <p className="text-untamed-white-muted max-w-2xl mx-auto">
                The pack is built by its members. Two ways to leave your mark
                from day one.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Share a moment */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${theme.color}1A` }}
                  >
                    <Camera className="w-5 h-5" style={{ color: theme.color }} />
                  </div>
                  <h3 className="font-condensed text-2xl font-bold uppercase tracking-wider text-white">
                    Share a Moment
                  </h3>
                </div>
                <p className="text-sm text-untamed-white-muted leading-relaxed mb-5">
                  Post a photo or video of your Untamed moment — the cooler at
                  the lake, the tailgate, the back porch. The best ones get
                  featured on the site for the whole pack to see.
                </p>

                <FeaturedProof />

                <button
                  onClick={() => chooseIntent('ugc')}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-black uppercase tracking-wider text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    backgroundColor: theme.color,
                    boxShadow: `0 0 20px ${theme.colorGlow}`,
                  }}
                >
                  <Camera className="w-4 h-4" />
                  Share a moment
                </button>
              </motion.div>

              {/* Bring a friend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-2xl border border-card-border bg-untamed-black-card p-6 sm:p-8 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${theme.color}1A` }}
                  >
                    <Share2 className="w-5 h-5" style={{ color: theme.color }} />
                  </div>
                  <h3 className="font-condensed text-2xl font-bold uppercase tracking-wider text-white">
                    Bring a Friend
                  </h3>
                </div>
                <p className="text-sm text-untamed-white-muted leading-relaxed mb-5">
                  Get your own personal link and send it to the people who&rsquo;d
                  love this. Takes 10 seconds, and you&rsquo;ll see every friend
                  who joins through you.
                </p>

                <ul className="space-y-2.5 text-sm text-untamed-white-muted mb-6">
                  {[
                    'Your own link — share it anywhere',
                    'Watch your pack grow on your dashboard',
                    'Know a bar or store? Intro them too',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <ArrowRight
                        className="w-3.5 h-3.5 mt-0.5 shrink-0"
                        style={{ color: theme.color }}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => chooseIntent('refer')}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold uppercase tracking-wider text-sm border transition-all duration-300 hover:scale-[1.02]"
                  style={{ borderColor: `${theme.color}66`, color: theme.color }}
                >
                  <Share2 className="w-4 h-4" />
                  Get my link
                </button>
              </motion.div>
            </div>
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
                Scan the QR code on any <span className="font-headline">Untamed</span> can or box to come straight here and join the pack.
              </p>

              <div
                className="relative p-4 rounded-2xl border bg-white inline-block"
                style={{ borderColor: `${theme.color}40` }}
              >
                <Image
                  src={drink ? `/images/qr/qr-${drink.slug}.png` : '/images/qr/qr-rewards-generic.png'}
                  alt="Scan to join the Untamed Pack"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              <p className="text-muted text-xs mt-4 uppercase tracking-wider">
                {drink ? `${drink.name}` : 'Untamed'} &bull; Scan with your phone camera
              </p>
            </motion.div>
          </div>
        </section>

        {/* Low-key points footnote */}
        <section className="relative pb-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm text-muted">
              Members also earn points on everything — purchases, posts,
              referrals — redeemable for Untamed merch.{' '}
              <Link
                href="/portal/login?returnTo=%2Fportal%2Frewards"
                className="underline underline-offset-4 hover:text-untamed-white transition-colors"
              >
                See your points
              </Link>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}

/**
 * Social proof for the "Share a Moment" card: a mini grid of real featured
 * community posts. Renders nothing until there are at least 3 to show.
 */
function FeaturedProof() {
  interface ProofAsset {
    id: string
    asset_type: 'image' | 'video'
    url: string
    processed_urls: Record<string, string> | null
    processing_status: 'uploaded' | 'processing' | 'ready' | 'failed'
  }
  interface ProofPost {
    id: string
    caption: string | null
    contributor_display_name: string | null
    assets: ProofAsset[]
  }

  const [posts, setPosts] = useState<ProofPost[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/community/posts?featured=1&limit=4')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const list = ((data?.posts as ProofPost[]) || []).filter(
          (p) => p.assets.length > 0
        )
        setPosts(list.slice(0, 4))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (posts.length < 3) return null

  return (
    <div className="mb-6">
      <div className="grid grid-cols-4 gap-2">
        {posts.map((post) => {
          const primary = post.assets[0]
          return (
            <div
              key={post.id}
              className="relative aspect-square rounded-xl overflow-hidden border border-untamed-white/10 bg-black"
            >
              {primary.asset_type === 'video' ? (
                <UgcVideo
                  src={primary.url}
                  processedUrls={primary.processed_urls}
                  processingStatus={primary.processing_status}
                  context="list"
                  fit="cover"
                  controls={false}
                  autoplay
                  muted
                  loop
                  lazy
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primary.url}
                  alt={post.caption || 'Untamed community post'}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted mt-2">
        Recently featured from the community &middot;{' '}
        <Link
          href="/community"
          className="underline underline-offset-2 hover:text-untamed-white transition-colors"
        >
          see the gallery
        </Link>
      </p>
    </div>
  )
}
