import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Camera, Gift, Sparkles, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ANNUAL_REWARD_CAP_CENTS,
  PROGRAM_RULES_PATH,
  RANKS,
  formatPoints,
  formatRetailValue,
  nextRank,
  rankArt,
  rankFor,
} from '@/lib/referral-hq/program'
import './hq.css'

/** Rank hero: crest, progress to the next rank, and the member's numbers. */
export function RankCard({
  points,
  balance,
  friendsJoined,
  postsApproved,
  postsFeatured,
  rewardValueThisYearCents,
}: {
  /** Lifetime engagement points. */
  points: number
  /** Spendable points balance. */
  balance: number
  friendsJoined: number
  postsApproved: number
  postsFeatured: number
  rewardValueThisYearCents: number
}) {
  const rank = rankFor(points)
  const next = nextRank(points)
  const rankIndex = rank ? RANKS.indexOf(rank) : -1
  const floor = rank?.points ?? 0
  const toNext = next ? next.points - points : 0
  const pctToNext = next ? Math.min(1, (points - floor) / (next.points - floor)) : 1

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#141414]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/images/referral-hq/map.jpg')] bg-cover bg-center opacity-[0.14]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#9B30FF]/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-[#FFD700]/10 blur-3xl"
      />
      <div className="relative grid grid-cols-1 gap-6 p-5 sm:p-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
          <div className="relative shrink-0 self-center">
            <div className="absolute inset-4 rounded-full bg-[#9B30FF]/30 blur-2xl" aria-hidden />
            <Image
              src={rankArt(rank?.id ?? 'cub')}
              alt={rank ? `${rank.name} rank crest` : 'Locked rank crest'}
              width={176}
              height={176}
              className={cn(
                'relative h-36 w-36 sm:h-44 sm:w-44 object-contain hq-pop',
                !rank && 'grayscale brightness-50'
              )}
              priority
            />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="font-condensed text-xs uppercase tracking-[0.3em] text-[#A0A0A0]">
              Your rank · {rankIndex + 1} of {RANKS.length}
            </p>
            <h2 className="font-wild text-5xl sm:text-6xl leading-none text-white mt-2">
              {rank?.name ?? 'Unranked'}
            </h2>
            <p className="text-sm text-[#A0A0A0] mt-2">
              {rank?.tagline ?? 'Join Pack Rewards and confirm you’re 21+ to get on the map.'}
            </p>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-semibold uppercase tracking-wider text-white">
                  {formatPoints(points)} engagement pts
                </span>
                <span className="text-[#A0A0A0]">
                  {next ? (
                    <>
                      <span className="text-[#FFD700] font-semibold">
                        {formatPoints(toNext)} to {next.name}
                      </span>{' '}
                      · {formatPoints(next.points)}
                    </>
                  ) : (
                    'Summit reached'
                  )}
                </span>
              </div>
              <div
                className="mt-2 h-3 rounded-full bg-[#0A0A0A] border border-[#2A2A2A] overflow-hidden"
                role="progressbar"
                aria-valuemin={floor}
                aria-valuemax={next?.points ?? points}
                aria-valuenow={points}
                aria-label={next ? `Progress to ${next.name}` : 'Top rank'}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7B2D8E] via-[#9B30FF] to-[#FFD700] transition-[width] duration-700"
                  style={{ width: `${pctToNext * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[#777]">
                Rank comes from enrolling, friends who join and confirm 21+, and approved posts. Purchases
                never count toward rank, and ranks are bragging rights only.{' '}
                <Link href={PROGRAM_RULES_PATH} className="text-[#C89BFF] hover:text-white underline underline-offset-2">
                  Program Rules
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <Stat
            icon={Sparkles}
            label="Points balance"
            value={formatPoints(balance)}
            hint={
              <Link href="/portal/rewards" className="inline-flex items-center gap-1 text-[#FFD700] hover:text-white">
                Spend on merch <ArrowRight className="w-3 h-3" />
              </Link>
            }
            highlight
          />
          <Stat
            icon={UserPlus}
            label="Friends joined"
            value={formatPoints(friendsJoined)}
            hint="Through your link, 21+"
          />
          <Stat
            icon={Camera}
            label="Posts approved"
            value={formatPoints(postsApproved)}
            hint={`${postsFeatured} featured by Untamed`}
          />
          <Stat
            icon={Gift}
            label="Rewards this year"
            value={formatRetailValue(rewardValueThisYearCents)}
            hint={`Retail value · limit ${formatRetailValue(ANNUAL_REWARD_CAP_CENTS)}`}
          />
        </div>
      </div>
    </section>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 backdrop-blur-sm',
        highlight
          ? 'border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/[0.12] to-[#0A0A0A]/60'
          : 'border-[#2A2A2A] bg-[#0A0A0A]/60'
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A0]">
        <Icon className={cn('w-3.5 h-3.5', highlight && 'text-[#FFD700]')} />
        {label}
      </div>
      <div className="mt-1.5 font-display text-3xl font-bold text-white tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-[#777] truncate">{hint}</div>
    </div>
  )
}
