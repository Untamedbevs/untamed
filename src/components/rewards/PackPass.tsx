import Image from 'next/image'
import Link from 'next/link'
import { Gift, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import type { Milestone } from '@/lib/rewards/catalog'
import type { SpiritAnimal } from '@/lib/rewards/spirit-animals'
import { compactPoints, formatPoints, rankArt, rankFor } from '@/lib/referral-hq/program'
import { ClawMarks } from './ClawMarks'
import './rewards.css'

/**
 * The member's Pack Pass: their spirit animal, trail points, rank, and how
 * close the next milestone is. Themed with the spirit animal's color.
 */
export function PackPass({
  firstName,
  memberSince,
  points,
  spirit,
  nextMilestone,
  previousThreshold,
  claimable,
}: {
  firstName: string | null
  memberSince: string
  /** Lifetime engagement points. */
  points: number
  spirit: SpiritAnimal | null
  nextMilestone: Milestone | null
  /** Points of the last milestone reached (0 before the first), for the progress ring. */
  previousThreshold: number
  /** Rewards reached but not claimed yet. */
  claimable: number
}) {
  const accent = spirit?.color ?? '#9B30FF'
  const rank = rankFor(points)
  const progress = nextMilestone
    ? Math.min(1, Math.max(0, (points - previousThreshold) / (nextMilestone.points - previousThreshold)))
    : 1
  const since = new Date(memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <section
      className="rw-shine relative overflow-hidden rounded-[28px] border border-[#2A2A2A] bg-[#101010] p-5 sm:p-7"
      style={{ background: `radial-gradient(120% 140% at 0% 0%, ${accent}33 0%, #101010 46%), radial-gradient(80% 120% at 100% 100%, #FFD70014 0%, transparent 60%), #101010` }}
    >
      <ClawMarks className="pointer-events-none absolute -right-6 -top-8 h-56 w-56 opacity-[0.06]" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4 md:gap-5">
          <div className="rw-float relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
            <div className="absolute inset-2 rounded-full blur-2xl" style={{ background: `${accent}55` }} />
            <Image
              src={spirit?.art ?? artSrc('first-tracks')}
              alt=""
              fill
              sizes="112px"
              className="relative object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A0A0A0]">Pack Pass</div>
            <h1 className="font-wild cyber-brush-fix text-4xl leading-none text-white sm:text-5xl">{firstName || 'Pack member'}</h1>
            <p className="mt-1.5 text-sm text-[#A0A0A0]">
              {spirit ? (
                <>
                  <span style={{ color: accent }}>{spirit.name}</span> spirit ·{' '}
                </>
              ) : null}
              In the pack since {since}
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2 sm:gap-3 md:ml-4">
          <Stat label="Trail points" value={formatPoints(points)} highlight />
          <Stat
            label="Rank"
            value={rank?.name ?? 'Unranked'}
            icon={rank ? <Image src={rankArt(rank.id)} alt="" width={22} height={22} /> : null}
          />
          <Stat
            label="Rewards ready"
            value={String(claimable)}
            icon={<Gift className={cn('h-4 w-4', claimable ? 'text-[#FFD700]' : 'text-[#666]')} />}
            href={claimable ? '/portal/rewards' : undefined}
          />
        </div>

        {nextMilestone ? (
          <Link
            href="/portal/rewards"
            className="group flex items-center gap-4 rounded-2xl border border-[#2A2A2A] bg-black/30 p-3 pr-5 transition-colors hover:border-[#FFD700]/40 md:w-72"
          >
            <ProgressRing progress={progress} color={accent}>
              <Image src={artSrc(nextMilestone.icon)} alt="" width={46} height={46} />
            </ProgressRing>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#A0A0A0]">Next milestone</div>
              <div className="truncate font-semibold text-white">{nextMilestone.title}</div>
              <div className="text-sm text-[#FFD700]">
                {compactPoints(nextMilestone.points - points)} to go
                {nextMilestone.reward ? <span className="text-[#A0A0A0]"> · {nextMilestone.reward.name}</span> : null}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/[0.06] p-4 md:w-72">
            <Sparkles className="h-5 w-5 text-[#FFD700]" />
            <p className="text-sm text-white">You’ve reached every milestone on the trail. Legend.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  icon,
  highlight,
  href,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  highlight?: boolean
  href?: string
}) {
  const body = (
    <>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#888] sm:text-[11px] sm:tracking-[0.18em]">{label}</div>
      <div className="mt-1 flex items-center gap-1">
        {icon}
        <span className={cn('truncate font-semibold', highlight ? 'text-lg text-white sm:text-2xl' : 'text-sm text-white sm:text-lg')}>
          {value}
        </span>
      </div>
    </>
  )
  const cls = 'min-w-0 rounded-2xl border border-[#2A2A2A] bg-black/30 px-3 py-2.5 sm:px-4 sm:py-3'
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:border-[#FFD700]/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function ProgressRing({ progress, color, children }: { progress: number; color: string; children: React.ReactNode }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#2A2A2A" strokeWidth="5" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
