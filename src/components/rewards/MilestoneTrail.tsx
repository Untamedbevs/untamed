'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Crosshair, Gift, Loader2, Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import { formatValue, type Milestone, type MilestoneState } from '@/lib/rewards/catalog'
import { compactPoints, formatPoints } from '@/lib/referral-hq/program'
import './rewards.css'

export interface TrailStop {
  milestone: Milestone
  state: MilestoneState
}

/**
 * The points trail: every milestone as a medallion along one line, filled up
 * to the member's points. Reached rewards can be claimed right here.
 * Milestones are spaced evenly and the fill moves proportionally between them,
 * so close and far-apart thresholds both read clearly.
 */
export function MilestoneTrail({
  points,
  stops,
  accent = '#9B30FF',
  avatar,
  canClaim,
  blockedMessage,
}: {
  points: number
  stops: TrailStop[]
  accent?: string
  /** The member's spirit animal art, shown at their spot on the line. */
  avatar?: string
  /** False while the member can't redeem (not enrolled, read-only View As). */
  canClaim: boolean
  blockedMessage?: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<Milestone | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [unlocked, setUnlocked] = useState<Milestone | null>(null)
  const [error, setError] = useState('')

  if (!stops.length) return null

  const n = stops.length
  // Even slots, proportional fill between neighbors.
  const slot = (i: number) => ((i + 1) / n) * 100
  let filled = 100
  for (let i = 0; i < n; i++) {
    const prev = i === 0 ? 0 : stops[i - 1].milestone.points
    const here = stops[i].milestone.points
    if (points < here) {
      filled = (i + (points - prev) / (here - prev)) * (100 / n)
      break
    }
  }
  // Keep the end labels inside the card.
  const place = (pct: number) => `${5 + pct * 0.88}%`
  const next = stops.find((s) => s.state === 'next')?.milestone ?? null
  const ready = stops.filter((s) => s.state === 'claimable')

  async function claim(m: Milestone) {
    setClaiming(true)
    setError('')
    try {
      const res = await fetch('/api/portal/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId: m.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Claim failed')
      setConfirming(null)
      setUnlocked(m)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#2A2A2A] bg-[#111] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline text-2xl uppercase tracking-wide text-white">The Trail</h2>
          <p className="text-sm text-[#A0A0A0]">
            Every milestone unlocks a reward. Points come from joining, friends, approved posts and Hunts.
          </p>
        </div>
        {ready.length > 0 && (
          <div className="rounded-full border border-[#FFD700]/40 bg-[#FFD700]/10 px-3 py-1 text-xs font-semibold text-[#FFD700]">
            {ready.length} reward{ready.length === 1 ? '' : 's'} ready to claim
          </div>
        )}
      </div>

      {/* Desktop: one horizontal line */}
      <div className="relative mt-8 hidden h-[230px] md:block">
        <div className="absolute left-[5%] right-[7%] top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#222]">
          <div
            className="rw-fill h-full rounded-full"
            style={{ width: `${filled}%`, background: `linear-gradient(90deg, ${accent}, #FFD700)` }}
          />
        </div>
        {stops.map((stop, i) => (
          <div
            key={stop.milestone.id}
            className={cn('absolute flex -translate-x-1/2 flex-col items-center', i % 2 ? 'top-[calc(50%+18px)]' : 'bottom-[calc(50%+18px)] flex-col-reverse')}
            style={{ left: place(slot(i)) }}
          >
            <Medallion stop={stop} onClaim={() => setConfirming(stop.milestone)} canClaim={canClaim} />
            <div className={cn('w-28 text-center', i % 2 ? 'mt-2' : 'mb-2')}>
              <div className={cn('text-xs font-semibold', stop.state === 'locked' ? 'text-[#777]' : 'text-white')}>
                {stop.milestone.title}
              </div>
              <div className="text-[11px] text-[#A0A0A0]">
                {compactPoints(stop.milestone.points)}
                {stop.milestone.reward ? ` · ${formatValue(stop.milestone.reward.value_cents)}` : ''}
              </div>
            </div>
          </div>
        ))}
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: place(Math.min(filled, 100)) }}>
          <div className="relative">
            <div className="rw-glow h-9 w-9 overflow-hidden rounded-full border-2 bg-black" style={{ borderColor: accent, ['--rw-glow' as string]: `${accent}66` }}>
              {avatar && <Image src={avatar} alt="" width={36} height={36} className="h-full w-full object-contain" />}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: a vertical path */}
      <ol className="relative mt-6 space-y-3 md:hidden">
        <div className="absolute bottom-6 left-[27px] top-6 w-1 rounded-full bg-[#222]" aria-hidden>
          <div className="rw-fill w-full rounded-full" style={{ height: `${filled}%`, background: `linear-gradient(180deg, ${accent}, #FFD700)` }} />
        </div>
        {stops.map((stop) => (
          <li key={stop.milestone.id} className="relative flex items-center gap-3">
            <Medallion stop={stop} onClaim={() => setConfirming(stop.milestone)} canClaim={canClaim} small />
            <div className="min-w-0 flex-1">
              <div className={cn('text-sm font-semibold', stop.state === 'locked' ? 'text-[#777]' : 'text-white')}>
                {stop.milestone.title}
              </div>
              <div className="text-xs text-[#A0A0A0]">
                {formatPoints(stop.milestone.points)} pts
                {stop.milestone.reward ? ` · ${stop.milestone.reward.name}` : ' · Marker'}
              </div>
            </div>
            <StateChip stop={stop} points={points} />
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#2A2A2A] bg-black/30 p-4 sm:flex-row sm:items-center">
        {next ? (
          <>
            <Image src={artSrc(next.icon)} alt="" width={44} height={44} className="shrink-0" />
            <p className="flex-1 text-sm text-[#D0D0D0]">
              <span className="font-semibold text-white">{formatPoints(next.points - points)} points</span> to{' '}
              {next.title}
              {next.reward ? (
                <>
                  {' '}
                  and a <span className="text-[#FFD700]">{next.reward.name}</span>
                </>
              ) : null}
              .
            </p>
            <Link
              href="/portal/hunts"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#9B30FF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7E22CE]"
            >
              <Crosshair className="h-4 w-4" />
              Find a Hunt
            </Link>
          </>
        ) : (
          <p className="text-sm text-[#D0D0D0]">You’ve reached the top of the trail. New milestones show up here when we add them.</p>
        )}
      </div>
      {blockedMessage && <p className="mt-3 text-xs text-[#A0A0A0]">{blockedMessage}</p>}

      {confirming && (
        <Dialog onClose={() => !claiming && setConfirming(null)}>
          <Image src={artSrc(confirming.reward?.icon ?? confirming.icon)} alt="" width={120} height={120} className="rw-pop mx-auto" />
          <h3 className="mt-3 text-center font-headline text-2xl uppercase text-white">{confirming.reward?.name}</h3>
          <p className="mt-1 text-center text-sm text-[#A0A0A0]">
            You reached {confirming.title}. Claim it and our team will send it to you
            {confirming.reward?.kind === 'gift_card' ? ' by email' : ''}. Your points stay on your trail.
          </p>
          {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={claiming}
              className="flex-1 rounded-full border border-[#2A2A2A] px-4 py-2.5 text-sm text-[#A0A0A0] hover:text-white"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={() => claim(confirming)}
              disabled={claiming}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FFD700] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#FFE45C] disabled:opacity-60"
            >
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Claim it
            </button>
          </div>
        </Dialog>
      )}

      {unlocked && (
        <Dialog onClose={() => setUnlocked(null)}>
          <div className="relative mx-auto h-40 w-40">
            <div
              className="rw-burst absolute inset-0 rounded-full"
              style={{ background: 'repeating-conic-gradient(#FFD70055 0deg 8deg, transparent 8deg 24deg)' }}
            />
            <Image src={artSrc(unlocked.reward?.icon ?? unlocked.icon)} alt="" fill sizes="160px" className="rw-pop object-contain p-4" />
          </div>
          <h3 className="mt-2 text-center font-wild cyber-brush-fix block text-4xl text-[#FFD700]">Unlocked</h3>
          <p className="mt-1 text-center text-sm text-[#D0D0D0]">
            Your {unlocked.reward?.name} is claimed. We’ll email you when it’s on its way.
          </p>
          <button
            type="button"
            onClick={() => setUnlocked(null)}
            className="mt-5 w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#9B30FF] hover:text-white"
          >
            Keep climbing
          </button>
        </Dialog>
      )}
    </section>
  )
}

function Medallion({
  stop,
  onClaim,
  canClaim,
  small,
}: {
  stop: TrailStop
  onClaim: () => void
  canClaim: boolean
  small?: boolean
}) {
  const { milestone, state } = stop
  const size = small ? 56 : 64
  const art = (
    <div className={cn('relative', state === 'claimable' && 'rw-glow rounded-full')} style={{ width: size, height: size }}>
      <Image
        src={artSrc(milestone.icon)}
        alt=""
        width={size}
        height={size}
        className={cn(
          'h-full w-full object-contain transition-transform duration-300',
          state === 'locked' && 'opacity-40 grayscale',
          state === 'next' && 'opacity-80',
          state === 'claimable' && 'hover:scale-110'
        )}
      />
      {state === 'locked' && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#333] bg-[#111]">
          <Lock className="h-3 w-3 text-[#777]" />
        </span>
      )}
      {state === 'claimed' && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#39FF14]">
          <Check className="h-3 w-3 text-black" />
        </span>
      )}
    </div>
  )
  if (state === 'claimable' && canClaim) {
    return (
      <button type="button" onClick={onClaim} aria-label={`Claim ${milestone.reward?.name}`} className="rounded-full">
        {art}
      </button>
    )
  }
  return art
}

function StateChip({ stop, points }: { stop: TrailStop; points: number }) {
  const { state, milestone } = stop
  const label =
    state === 'claimed'
      ? 'Claimed'
      : state === 'claimable'
        ? 'Tap to claim'
        : state === 'reached'
          ? 'Reached'
          : state === 'next'
            ? `${compactPoints(milestone.points - points)} to go`
            : 'Locked'
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        state === 'claimable' && 'border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]',
        state === 'claimed' && 'border-[#39FF14]/30 text-[#39FF14]',
        state === 'reached' && 'border-[#9B30FF]/40 text-[#C89BFF]',
        state === 'next' && 'border-[#9B30FF]/40 bg-[#9B30FF]/10 text-[#C89BFF]',
        state === 'locked' && 'border-[#2A2A2A] text-[#666]'
      )}
    >
      {label}
    </span>
  )
}

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className="rw-rise relative w-full max-w-sm rounded-3xl border border-[#2A2A2A] bg-[#141414] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-[#666] hover:text-white" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  )
}
