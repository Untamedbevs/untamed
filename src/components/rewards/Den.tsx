'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Crosshair, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import { WELCOMED_COOKIE } from '@/lib/rewards/welcome'
import { ClawSlash, Embers, Gate, fitName, useCountUp } from './pack-fx'
import './portal.css'
import './rewards.css'

export interface DenSpirit {
  name: string
  color: string
  habitat: string
  portrait: string
  can: string
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The top of the Pack dashboard: the member's spirit animal in its habitat,
 * a live points counter, rank, and the next milestone with a progress bar.
 */
export function DenHero({
  firstName,
  spirit,
  points,
  rank,
  next,
  previousThreshold,
  claimable,
  memberSince,
  delayMs = 0,
}: {
  firstName: string | null
  spirit: DenSpirit | null
  points: number
  rank: { name: string; art: string; tagline: string } | null
  next: { title: string; points: number; icon: string | null } | null
  previousThreshold: number
  claimable: number
  memberSince: string
  /** Hold the count-up until an intro overlay has finished. */
  delayMs?: number
}) {
  const accent = spirit?.color ?? '#9B30FF'
  const [hello, setHello] = useState('Welcome back')
  const [run, setRun] = useState(delayMs === 0)
  useEffect(() => {
    setHello(greeting())
    if (delayMs) {
      const t = setTimeout(() => setRun(true), delayMs)
      return () => clearTimeout(t)
    }
  }, [delayMs])
  const shown = useCountUp(points, run, 1600)
  const progress = next ? Math.min(1, Math.max(0, (points - previousThreshold) / (next.points - previousThreshold))) : 1
  const since = new Date(memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <section className="pk-enter pk-glass relative overflow-hidden" style={{ ['--i' as string]: 0, ['--pk-delay' as string]: `${delayMs}ms` }}>
      {spirit && <Image src={spirit.habitat} alt="" fill priority sizes="(min-width: 1024px) 1100px, 100vw" className="pk-backdrop object-cover opacity-60" />}
      <div className="absolute inset-0" style={{ background: `linear-gradient(100deg, #050507 25%, #050507cc 50%, transparent 85%), radial-gradient(70% 90% at 0% 0%, ${accent}40, transparent 60%)` }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#050507] to-transparent md:hidden" />

      <div className="relative grid min-h-[26rem] gap-6 p-6 sm:p-8 md:grid-cols-[1.25fr_1fr] md:p-10">
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
            <span style={{ color: accent }}>{spirit ? `${spirit.name} pack` : 'Untamed pack'}</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>Since {since}</span>
          </div>
          <h1 className="mt-3 max-w-full font-wild cyber-brush-fix leading-[0.95]">
            <span className="block text-2xl text-white/70 sm:text-3xl">{hello},</span>
            <span className={cn('pk-gradient-text', fitName(firstName, ['text-5xl sm:text-7xl', 'text-4xl sm:text-6xl', 'text-3xl sm:text-5xl']))}>
              {firstName || 'Pack member'}
            </span>
          </h1>

          <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <div className="font-headline text-6xl leading-none tabular-nums sm:text-7xl" style={{ textShadow: `0 0 40px ${accent}88` }}>
                {shown.toLocaleString('en-US')}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#FFD700]">Trail points</div>
            </div>
            {rank && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 py-1.5 pl-1.5 pr-4 backdrop-blur">
                <Image src={rank.art} alt="" width={34} height={34} />
                <div>
                  <div className="text-sm font-semibold leading-tight">{rank.name}</div>
                  <div className="text-[10px] text-white/50">{rank.tagline}</div>
                </div>
              </div>
            )}
          </div>

          {next && (
            <Link href="/portal/rewards" className="group mt-6 block max-w-md">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">
                  <span className="font-semibold text-white">{Math.max(0, next.points - points).toLocaleString('en-US')}</span> to {next.title}
                </span>
                <Image src={artSrc(next.icon)} alt="" width={36} height={36} className="transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="relative h-full rounded-full transition-[width] duration-[1600ms] ease-out"
                  style={{ width: `${run ? Math.max(4, progress * 100) : 0}%`, background: `linear-gradient(90deg, ${accent}, #FFD700)` }}
                >
                  <span className="absolute inset-y-0 right-0 w-6 rounded-full bg-white/60 blur-sm" />
                </div>
              </div>
            </Link>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            {claimable > 0 && (
              <Link
                href="/portal/rewards"
                className="rw-glow inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-black"
                style={{ background: 'linear-gradient(100deg, #FFD700, #FFA500)', ['--rw-glow' as string]: '#FFD70088' }}
              >
                <Gift className="h-4 w-4" /> Claim {claimable} reward{claimable === 1 ? '' : 's'}
              </Link>
            )}
            <Link
              href="/portal/hunts"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.03]"
              style={{ background: `linear-gradient(100deg, ${accent}, #FFD700)` }}
            >
              <Crosshair className="h-4 w-4" /> Go on a Hunt
            </Link>
            <Link href="/portal/rewards" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-5 py-3 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/10">
              My rewards <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {spirit && (
          <div className="pointer-events-none relative hidden md:block">
            <div className="absolute inset-[15%] rounded-full blur-3xl" style={{ background: `${accent}55` }} />
            <Image src={spirit.portrait} alt="" fill sizes="420px" className="rw-float object-contain object-bottom drop-shadow-[0_30px_40px_rgba(0,0,0,0.9)]" />
            <Image src={spirit.can} alt="" width={120} height={315} className="pk-bob absolute bottom-0 right-2 h-[55%] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)]" />
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Full-screen intro over the dashboard. `opened` follows onboarding: the gate
 * doors from the journey part to reveal the HQ. `welcome` greets a member on
 * their first visit of a session, then slashes away.
 */
export function DashboardIntro({
  variant,
  firstName,
  spirit,
  points,
  nextTitle,
}: {
  variant: 'opened' | 'welcome'
  firstName: string | null
  spirit: DenSpirit | null
  points: number
  nextTitle: string | null
}) {
  const accent = spirit?.color ?? '#9B30FF'
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>('show')
  const [gateOpen, setGateOpen] = useState(false)
  const shown = useCountUp(points, variant === 'welcome', 1500)

  useEffect(() => {
    document.cookie = `${WELCOMED_COOKIE}=1; path=/; samesite=lax`
    if (variant === 'opened') {
      window.history.replaceState(null, '', '/portal')
      const open = setTimeout(() => setGateOpen(true), 450)
      const done = setTimeout(() => setPhase('gone'), 2000)
      return () => {
        clearTimeout(open)
        clearTimeout(done)
      }
    }
    const leave = setTimeout(() => setPhase('leaving'), 3200)
    return () => clearTimeout(leave)
  }, [variant])

  useEffect(() => {
    if (phase !== 'leaving') return
    const t = setTimeout(() => setPhase('gone'), 750)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'gone') return null
  if (variant === 'opened') return <Gate open={gateOpen} accent={accent} label="Your HQ is open" />

  return (
    <div
      role="dialog"
      aria-label="Welcome back"
      onClick={() => setPhase('leaving')}
      className={cn('fixed inset-0 z-[90] cursor-pointer overflow-hidden bg-black text-white', phase === 'leaving' && 'pk-fade-out')}
      style={{ ['--pk-accent' as string]: accent }}
    >
      {spirit && <Image src={spirit.habitat} alt="" fill priority sizes="100vw" className="pk-backdrop object-cover opacity-80" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/60" />
      <Embers count={22} />
      {phase === 'leaving' && <ClawSlash color={accent} />}

      <div className={cn('relative flex h-full flex-col items-center justify-center px-6 text-center transition-transform duration-700', phase === 'leaving' && 'scale-110')}>
        {spirit && (
          <div className="pk-scene-forward relative mb-4 h-56 w-56 sm:h-72 sm:w-72">
            <div className="absolute inset-[10%] rounded-full blur-3xl" style={{ background: `${accent}77` }} />
            <Image src={spirit.portrait} alt="" fill sizes="288px" className="relative object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.9)]" />
          </div>
        )}
        <div className="pk-scene-forward">
          <p style={{ ['--i' as string]: 0 }} className="text-xs font-semibold uppercase tracking-[0.45em] text-[#FFD700]">
            Welcome back to the pack
          </p>
          <h1
            style={{ ['--i' as string]: 1 }}
            className={cn('mt-3 max-w-full font-wild cyber-brush-fix leading-[0.95]', fitName(firstName, ['text-6xl sm:text-8xl', 'text-5xl sm:text-7xl', 'text-4xl sm:text-6xl']))}
          >
            <span className="pk-gradient-text">{firstName || 'Pack member'}</span>
          </h1>
          <div style={{ ['--i' as string]: 2 }} className="mt-6 font-headline text-5xl tabular-nums" >
            {shown.toLocaleString('en-US')}
            <span className="ml-2 align-middle text-sm font-sans font-semibold uppercase tracking-[0.25em] text-white/60">pts</span>
          </div>
          {nextTitle && (
            <p style={{ ['--i' as string]: 3 }} className="mt-2 text-sm text-white/70">
              Next stop: <span className="text-white">{nextTitle}</span>
            </p>
          )}
          <p style={{ ['--i' as string]: 4 }} className="mt-10 text-[11px] uppercase tracking-[0.3em] text-white/40">
            Tap to enter
          </p>
        </div>
      </div>
    </div>
  )
}
