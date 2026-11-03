import Link from 'next/link'
import { ArrowRight, Award, Camera, Gift, Sparkles, Trophy, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDay, formatPoints } from '@/lib/referral-hq/program'
import type { FeedEntry } from '@/lib/referral-hq/progress'

const ICON: Record<FeedEntry['kind'], LucideIcon> = {
  enrolled: Sparkles,
  friend: UserPlus,
  content: Camera,
  bonus: Sparkles,
  rank: Trophy,
  badge: Award,
  redeem: Gift,
}

const TINT: Record<FeedEntry['kind'], string> = {
  enrolled: '#9B30FF',
  friend: '#9B30FF',
  content: '#FFD700',
  bonus: '#FFD700',
  rank: '#FFD700',
  badge: '#FFD700',
  redeem: '#888888',
}

const STATUS_LABEL: Record<NonNullable<FeedEntry['status']>, string> = {
  pending: 'Pending',
  fulfilled: 'Shipped',
  cancelled: 'Cancelled',
}

/** Recent engagement, friends, milestones and redemptions. Purchase points live in the full history. */
export function ActivityFeed({ entries }: { entries: FeedEntry[] }) {
  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6 h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">Pack activity</h2>
        <Link
          href="/portal/rewards"
          className="inline-flex items-center gap-1 rounded-full border border-[#FFD700]/40 px-3 py-1 text-xs font-semibold text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
        >
          Full points history <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 text-sm text-[#777]">
          Nothing yet. Share a moment or bring in a friend and it shows up here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[#222]">
          {entries.map((e) => {
            const Icon = ICON[e.kind]
            const tint = TINT[e.kind]
            return (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                  style={{ borderColor: `${tint}55`, backgroundColor: `${tint}1A` }}
                >
                  <Icon className="w-4 h-4" style={{ color: tint }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{e.label}</p>
                  <p className="text-xs text-[#777] truncate">
                    {e.detail}
                    {e.status ? ` · ${STATUS_LABEL[e.status]}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'font-display text-base font-bold tabular-nums',
                      e.points === null ? 'text-[#555]' : e.points > 0 ? 'text-[#FFD700]' : 'text-[#A0A0A0]'
                    )}
                  >
                    {e.points === null
                      ? e.kind === 'rank' || e.kind === 'badge'
                        ? 'Earned'
                        : '—'
                      : `${e.points > 0 ? '+' : '−'}${formatPoints(Math.abs(e.points))} pts`}
                  </p>
                  <p className="text-[11px] text-[#555]">{formatDay(e.date)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
