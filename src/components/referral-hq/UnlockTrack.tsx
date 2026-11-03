import Link from 'next/link'
import { ArrowRight, Check, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REWARDS } from '@/lib/loyalty/constants'
import {
  ANNUAL_REWARD_CAP_CENTS,
  compactPoints,
  formatPoints,
  formatRetailValue,
} from '@/lib/referral-hq/program'
import { CatalogArt } from './CatalogArt'

/** The merch catalog as a track: what the points balance already covers, and what's next. */
export function UnlockTrack({ balance }: { balance: number }) {
  const rewards = [...REWARDS].sort((a, b) => a.pointsCost - b.pointsCost)
  const next = rewards.find((r) => balance < r.pointsCost) ?? null

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#FFD700]/25 bg-gradient-to-br from-[#1d1608] via-[#141414] to-[#141414] p-5 sm:p-6 h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFD700]">
        <Gift className="w-3.5 h-3.5" /> Unlock track
      </h2>
      <p className="font-wild text-3xl text-white leading-none mt-2">{next ? `Next: ${next.name}` : 'All unlocked'}</p>
      <p className="text-xs text-[#A0A0A0] mt-1">
        {next
          ? `${formatPoints(next.pointsCost - balance)} points to go · your balance is ${formatPoints(balance)}`
          : 'Your balance covers everything in the catalog.'}
      </p>

      <ol className="mt-5 space-y-5">
        {rewards.map((r, i) => {
          const unlocked = balance >= r.pointsCost
          const isNext = next?.id === r.id
          return (
            <li key={r.id} className="relative flex items-center gap-4">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-7 -top-5 h-5 w-0.5 -translate-x-1/2',
                    unlocked ? 'bg-[#FFD700]' : 'bg-[#2A2A2A]'
                  )}
                />
              )}
              <CatalogArt
                rewardId={r.id}
                size={56}
                dim={!unlocked && !isNext}
                className={cn('h-14 w-14', unlocked && 'drop-shadow-[0_6px_18px_rgba(255,215,0,0.3)]')}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-semibold', unlocked || isNext ? 'text-white' : 'text-[#888]')}>
                  {r.name}
                </p>
                <p className="text-[11px] text-[#888]">
                  {formatPoints(r.pointsCost)} pts · approx. retail value {formatRetailValue(r.retailValueCents)}
                </p>
                {!unlocked && (
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#222] overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', isNext ? 'bg-[#FFD700]' : 'bg-[#9B30FF]/60')}
                      style={{ width: `${Math.min(100, (balance / r.pointsCost) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
                  unlocked ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'bg-[#2A2A2A] text-[#A0A0A0]'
                )}
              >
                {unlocked && <Check className="w-3 h-3" />}
                {unlocked ? 'Ready' : `${compactPoints(r.pointsCost - balance)} to go`}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-auto pt-5">
        <Link
          href="/portal/rewards"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#FFD700]/40 px-4 py-2 text-xs font-semibold text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
        >
          Redeem in Rewards <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <p className="mt-3 text-[11px] text-[#777]">
          Merch only, never alcohol. Redemptions count toward the {formatRetailValue(ANNUAL_REWARD_CAP_CENTS)} yearly
          reward limit.
        </p>
      </div>
    </section>
  )
}
