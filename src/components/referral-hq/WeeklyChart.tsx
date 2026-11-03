'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { UserPlus } from 'lucide-react'
import { REFERRALS_PER_YEAR } from '@/lib/referral-hq/program'
import type { WeeklyFriends } from '@/lib/referral-hq/progress'

function friendsLabel(n: number) {
  return `${n} ${n === 1 ? 'friend' : 'friends'} joined`
}

/** Single-series bar chart: friends who joined through the link and confirmed 21+, per week. */
export function WeeklyChart({ weeks, thisYear }: { weeks: WeeklyFriends[]; thisYear: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(4, ...weeks.map((w) => w.friends))
  const ticks = [0, Math.round(max / 2), max]
  const total = weeks.reduce((s, w) => s + w.friends, 0)

  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">Friends who joined per week</h2>
          <p className="text-sm text-[#A0A0A0] mt-1">
            <span className="text-white font-semibold tabular-nums">{total}</span> in the last {weeks.length} weeks
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#9B30FF]/40 bg-[#9B30FF]/10 px-2.5 py-1 text-xs font-semibold text-[#C89BFF]"
          title={`Friends you can be rewarded for per calendar year: ${REFERRALS_PER_YEAR}`}
        >
          <UserPlus className="w-3.5 h-3.5" /> {thisYear} of {REFERRALS_PER_YEAR} this year
        </span>
      </div>

      <div className="relative mt-6 h-48">
        {/* Recessive gridlines */}
        <div className="absolute inset-0 bottom-6 left-6">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-[#222]"
              style={{ bottom: `${(t / max) * 100}%` }}
            >
              <span className="absolute -left-6 -translate-y-1/2 text-[10px] text-[#555] tabular-nums">{t}</span>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 bottom-6 left-6 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {weeks.map((w, i) => (
            <div
              key={w.weekOf}
              className="relative flex-1 h-full flex items-end justify-center cursor-default"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`Week of ${format(parseISO(w.weekOf), 'MMM d')}: ${friendsLabel(w.friends)}`}
            >
              <div
                className="w-full max-w-[22px] rounded-t-[4px] transition-colors"
                style={{
                  height: `${(w.friends / max) * 100}%`,
                  minHeight: w.friends ? 2 : 0,
                  backgroundColor: hover === i ? '#C89BFF' : '#9B30FF',
                }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-2.5 py-1.5 text-xs shadow-lg">
                  <p className="text-[#A0A0A0]">Week of {format(parseISO(w.weekOf), 'MMM d')}</p>
                  <p className="font-semibold text-white tabular-nums">{friendsLabel(w.friends)}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="absolute left-6 right-0 bottom-0 flex gap-[2px]">
          {weeks.map((w, i) => (
            <span key={w.weekOf} className="flex-1 text-center text-[10px] text-[#555]">
              {i % 2 === 0 ? format(parseISO(w.weekOf), 'M/d') : ''}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Friends who joined per week</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Friends joined</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekOf}>
              <td>{w.weekOf}</td>
              <td>{w.friends}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
