import Image from 'next/image'
import { Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TROPHIES, formatDay, trophyArt, trophyProgress, type Progress } from '@/lib/referral-hq/program'

/** Badges earned from engagement. With `locked`, a preview where nothing is earned yet. */
export function TrophyCase({
  progress,
  earnedDates = {},
  locked = false,
}: {
  progress: Progress
  earnedDates?: Record<string, string>
  locked?: boolean
}) {
  const valueOf = (t: (typeof TROPHIES)[number]) => (locked ? 0 : trophyProgress(t, progress))
  const earnedCount = TROPHIES.filter((t) => valueOf(t) >= t.goal).length

  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6 h-full">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
            <Award className="w-3.5 h-3.5" /> Trophy case
          </h2>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Badges for joining, bringing in friends, and telling your story. Bragging rights only: no points, no
            prizes.
          </p>
        </div>
        <p className="font-display text-2xl font-bold text-white tabular-nums">
          {earnedCount}
          <span className="text-[#555]">/{TROPHIES.length}</span>
        </p>
      </div>

      <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TROPHIES.map((t) => {
          const value = valueOf(t)
          const earned = value >= t.goal
          const date = earnedDates[t.id]
          return (
            <li
              key={t.id}
              className={cn(
                'group relative flex flex-col items-center rounded-2xl border p-3 text-center transition-colors',
                earned
                  ? 'border-[#FFD700]/25 bg-gradient-to-b from-[#FFD700]/[0.08] to-transparent'
                  : 'border-[#222] bg-[#0A0A0A]/60'
              )}
            >
              <Image
                src={trophyArt(t)}
                alt=""
                width={112}
                height={112}
                className={cn(
                  'h-20 w-20 sm:h-24 sm:w-24 object-contain transition-[filter,transform] duration-300 group-hover:scale-105',
                  earned ? 'drop-shadow-[0_6px_18px_rgba(255,215,0,0.3)]' : 'grayscale opacity-35'
                )}
              />
              <p className={cn('mt-2 text-sm font-bold leading-tight', earned ? 'text-white' : 'text-[#888]')}>
                {t.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#777]">{t.description}</p>
              {earned ? (
                <p className="mt-2 text-[11px] font-semibold text-[#FFD700]">
                  {date ? `Earned ${formatDay(date)}` : 'Earned'}
                </p>
              ) : (
                <div className="mt-2 w-full">
                  <div className="h-1.5 w-full rounded-full bg-[#222] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#9B30FF]"
                      style={{ width: `${Math.min(100, (value / t.goal) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#777] tabular-nums">
                    {value}/{t.goal}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
