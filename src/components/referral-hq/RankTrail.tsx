'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Lock, Mountain } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ASSET_BASE,
  RANKS,
  compactPoints,
  formatDay,
  formatPoints,
  nextRank,
  rankArt,
  type Rank,
} from '@/lib/referral-hq/program'
import './hq.css'

// SVG space matches the 3:2 map art so % positions line up at any width.
const W = 150
const H = 100

function pt(r: Rank) {
  return { x: (r.map.x / 100) * W, y: (r.map.y / 100) * H }
}

/** Smooth path through the rank markers (Catmull-Rom → cubic Bézier). */
function trailPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`
  }
  return d
}

/** Fraction of the trail walked, measured by straight-line segment lengths. */
function walkedFraction(points: number) {
  const pts = RANKS.map(pt)
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y))
  const total = seg.reduce((a, b) => a + b, 0)
  let walked = 0
  for (let i = 0; i < seg.length; i++) {
    const from = RANKS[i].points
    const to = RANKS[i + 1].points
    if (points >= to) walked += seg[i]
    else {
      if (points > from) walked += seg[i] * ((points - from) / (to - from))
      break
    }
  }
  return total ? walked / total : 0
}

/**
 * Fog-of-war trail from Cub to Legend: every rank burns back the fog. With
 * `locked`, it is a preview for members who haven't enrolled yet.
 */
export function RankTrail({
  points,
  earnedDates = {},
  locked = false,
}: {
  /** Lifetime engagement points. */
  points: number
  earnedDates?: Record<string, string>
  locked?: boolean
}) {
  const next = nextRank(points)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = RANKS.find((r) => r.id === selectedId) ?? next ?? RANKS[RANKS.length - 1]

  const path = trailPath(RANKS.map(pt))
  const walked = walkedFraction(points)
  const reachedCount = RANKS.filter((r) => points >= r.points).length

  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] overflow-hidden">
      <div className="px-5 pt-5 sm:px-6">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
          <Mountain className="w-3.5 h-3.5" /> The trail
        </h2>
        <p className="font-wild text-3xl sm:text-4xl text-white mt-1 leading-none">Claim the summit</p>
        <p className="text-sm text-[#A0A0A0] mt-1.5">
          {locked
            ? 'Join Pack Rewards above to get on the map. Every rank burns back the fog.'
            : `Every rank burns back the fog. ${reachedCount} of ${RANKS.length} ranks claimed.`}
        </p>
      </div>

      <div className="mt-4 px-2 sm:px-4">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-[#07040c]">
          <Image
            src={`${ASSET_BASE}/map.jpg`}
            alt="Trail map: a path from the jungle up to a moonlit summit"
            fill
            sizes="(min-width: 1280px) 1100px, 100vw"
            className="object-cover"
          />

          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <filter id="hq-fog-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
              <mask id="hq-fog-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <rect width={W} height={H} fill="white" />
                <g filter="url(#hq-fog-blur)">
                  {/* The trailhead is always visible so new members see where to start. */}
                  <circle cx={pt(RANKS[0]).x - 4} cy={pt(RANKS[0]).y + 6} r={12} fill="black" />
                  {RANKS.map((r) => {
                    const reached = points >= r.points
                    const isNext = next?.id === r.id
                    const p = pt(r)
                    return (
                      <circle
                        key={r.id}
                        cx={p.x}
                        cy={p.y}
                        r={reached ? 20 : isNext ? 9 : 0}
                        fill="black"
                        className="hq-fog-hole"
                      />
                    )
                  })}
                </g>
              </mask>
              <linearGradient id="hq-trail-gold" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#FFA500" />
                <stop offset="1" stopColor="#FFD700" />
              </linearGradient>
            </defs>

            <rect width={W} height={H} fill="#0b0612" opacity={0.82} mask="url(#hq-fog-mask)" />

            <path d={path} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.5} strokeDasharray="1.2 1.6" strokeLinecap="round" />
            <path
              d={path}
              pathLength={1}
              fill="none"
              stroke="url(#hq-trail-gold)"
              strokeWidth={0.7}
              strokeLinecap="round"
              strokeDasharray="1 1"
              strokeDashoffset={1 - walked}
              className="hq-trail"
              style={{ filter: 'drop-shadow(0 0 1.2px rgba(255,215,0,0.9))' }}
            />
          </svg>

          {RANKS.map((r) => {
            const reached = points >= r.points
            const isNext = next?.id === r.id
            const isSelected = selected.id === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center focus:outline-none"
                style={{ left: `${r.map.x}%`, top: `${r.map.y}%` }}
                aria-label={`${r.name}: ${formatPoints(r.points)} engagement points${reached ? ', claimed' : ''}`}
                aria-pressed={isSelected}
              >
                <span
                  className={cn(
                    'relative flex items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110',
                    'h-9 w-9 sm:h-14 sm:w-14 lg:h-[4.5rem] lg:w-[4.5rem]',
                    isSelected && 'scale-110'
                  )}
                >
                  {isNext && <span className="absolute inset-0 rounded-full border-2 border-[#9B30FF] hq-ping" />}
                  {reached && <span className="absolute inset-1 rounded-full bg-[#FFD700]/25 blur-md" />}
                  <Image
                    src={rankArt(r.id)}
                    alt=""
                    width={80}
                    height={80}
                    className={cn(
                      'relative h-full w-full object-contain transition-[filter,opacity] duration-500',
                      reached
                        ? 'drop-shadow-[0_0_10px_rgba(255,215,0,0.55)]'
                        : isNext
                          ? 'grayscale-[70%] brightness-75'
                          : 'grayscale brightness-[.4] opacity-80'
                    )}
                  />
                  {!reached && !isNext && (
                    <Lock className="absolute h-3 w-3 sm:h-4 sm:w-4 text-[#A0A0A0]" />
                  )}
                </span>
                <span
                  className={cn(
                    'mt-0.5 hidden sm:block rounded-full px-2 py-0.5 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap',
                    reached
                      ? 'bg-black/70 text-[#FFD700]'
                      : isNext
                        ? 'bg-[#9B30FF]/80 text-white'
                        : 'bg-black/60 text-[#888]'
                  )}
                >
                  {r.name} · {compactPoints(r.points)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <MilestoneDetail rank={selected} points={points} earnedAt={earnedDates[selected.id]} locked={locked} />
    </section>
  )
}

function MilestoneDetail({
  rank,
  points,
  earnedAt,
  locked,
}: {
  rank: Rank
  points: number
  earnedAt?: string
  locked: boolean
}) {
  const reached = points >= rank.points

  return (
    <div className="m-2 sm:m-4 mt-3 rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A]/70 p-4 flex items-center gap-4">
      <Image
        src={rankArt(rank.id)}
        alt=""
        width={72}
        height={72}
        className={cn('h-14 w-14 sm:h-16 sm:w-16 shrink-0 object-contain', !reached && 'grayscale brightness-75')}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
          {formatPoints(rank.points)} engagement points
        </p>
        <p className="font-wild text-3xl text-white leading-none mt-1">{rank.name}</p>
        <p className="text-xs text-[#888] mt-1 italic">“{rank.tagline}”</p>
      </div>
      <span
        className={cn(
          'shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
          reached ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'bg-[#2A2A2A] text-[#A0A0A0]'
        )}
      >
        {reached ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        {reached
          ? earnedAt
            ? `Claimed ${formatDay(earnedAt)}`
            : 'Claimed'
          : locked
            ? 'Locked'
            : `${compactPoints(rank.points - points)} to go`}
      </span>
    </div>
  )
}
