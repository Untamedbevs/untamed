'use client'

import { useState } from 'react'
import { MapPinned } from 'lucide-react'
import { cn } from '@/lib/utils'
import { engagementAllowed } from '@/lib/rewards/state-rules'

/** Tile-grid cartogram, same layout as src/components/ShippingStates.tsx: [abbr, name, col, row]. */
const TILES: [string, string, number, number][] = [
  ['AK', 'Alaska', 0, 0], ['ME', 'Maine', 11, 0],
  ['VT', 'Vermont', 10, 1], ['NH', 'New Hampshire', 11, 1],
  ['WA', 'Washington', 1, 2], ['ID', 'Idaho', 2, 2], ['MT', 'Montana', 3, 2], ['ND', 'North Dakota', 4, 2],
  ['MN', 'Minnesota', 5, 2], ['IL', 'Illinois', 6, 2], ['WI', 'Wisconsin', 7, 2], ['MI', 'Michigan', 8, 2],
  ['NY', 'New York', 9, 2], ['RI', 'Rhode Island', 10, 2], ['MA', 'Massachusetts', 11, 2],
  ['OR', 'Oregon', 1, 3], ['NV', 'Nevada', 2, 3], ['WY', 'Wyoming', 3, 3], ['SD', 'South Dakota', 4, 3],
  ['IA', 'Iowa', 5, 3], ['IN', 'Indiana', 6, 3], ['OH', 'Ohio', 7, 3], ['PA', 'Pennsylvania', 8, 3],
  ['NJ', 'New Jersey', 9, 3], ['CT', 'Connecticut', 10, 3],
  ['CA', 'California', 1, 4], ['UT', 'Utah', 2, 4], ['CO', 'Colorado', 3, 4], ['NE', 'Nebraska', 4, 4],
  ['MO', 'Missouri', 5, 4], ['KY', 'Kentucky', 6, 4], ['WV', 'West Virginia', 7, 4], ['VA', 'Virginia', 8, 4],
  ['MD', 'Maryland', 9, 4], ['DE', 'Delaware', 10, 4],
  ['AZ', 'Arizona', 2, 5], ['NM', 'New Mexico', 3, 5], ['KS', 'Kansas', 4, 5], ['AR', 'Arkansas', 5, 5],
  ['TN', 'Tennessee', 6, 5], ['NC', 'North Carolina', 7, 5], ['SC', 'South Carolina', 8, 5],
  ['DC', 'Washington, D.C.', 9, 5],
  ['OK', 'Oklahoma', 4, 6], ['LA', 'Louisiana', 5, 6], ['MS', 'Mississippi', 6, 6], ['AL', 'Alabama', 7, 6],
  ['GA', 'Georgia', 8, 6],
  ['HI', 'Hawaii', 0, 7], ['TX', 'Texas', 4, 7], ['FL', 'Florida', 9, 7],
]

function friendsLabel(n: number) {
  return `${n} ${n === 1 ? 'friend' : 'friends'}`
}

/**
 * Friends who joined through the member's link and confirmed 21+, counted by
 * state. Counts only: the map never says which friend lives where. With
 * `locked`, it is a preview for members who haven't enrolled yet.
 */
export function TerritoryMap({
  friendsByState,
  homeState,
  locked = false,
}: {
  friendsByState: Record<string, number>
  homeState: string | null
  locked?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const total = Object.values(friendsByState).reduce((sum, n) => sum + n, 0)
  const claimed = Object.values(friendsByState).filter((n) => n > 0).length
  const max = Math.max(1, ...Object.values(friendsByState))
  const selectedTile = TILES.find((t) => t[0] === selected)

  function describe(abbr: string) {
    const friends = friendsByState[abbr] || 0
    if (friends) return `${friendsLabel(friends)} joined from here`
    if (!engagementAllowed(abbr)) return 'Pack Rewards isn’t open here yet'
    return 'No friends here yet'
  }

  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6 h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
            <MapPinned className="w-3.5 h-3.5" /> Your territory
          </h2>
          <p className="font-wild text-3xl sm:text-4xl text-white mt-1 leading-none">Grow your territory</p>
          <p className="text-sm text-[#A0A0A0] mt-1.5">
            {locked
              ? 'Join Pack Rewards to get your link. Each state lights up when a friend joins from there.'
              : total === 0
                ? 'Each state lights up when a friend joins through your link and confirms 21+.'
                : `${friendsLabel(total)} in the pack from ${claimed} ${claimed === 1 ? 'state' : 'states'}.`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl font-bold text-white tabular-nums leading-none">{claimed}</p>
          <p className="text-[10px] uppercase tracking-wider text-[#777] mt-1">
            {claimed === 1 ? 'State' : 'States'} claimed
          </p>
        </div>
      </div>

      <div
        className={cn('mt-5 grid gap-[3px] sm:gap-1', locked && 'opacity-60')}
        style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
        role="list"
        aria-label="Map of states where your friends joined"
      >
        {TILES.map(([abbr, name, col, row]) => {
          const friends = friendsByState[abbr] || 0
          const open = engagementAllowed(abbr)
          const isHome = abbr === homeState
          const isSelected = abbr === selected
          return (
            <button
              key={abbr}
              type="button"
              role="listitem"
              title={`${name}: ${describe(abbr)}`}
              aria-label={`${name}: ${describe(abbr)}${isHome ? ', your state' : ''}`}
              onClick={() => setSelected(isSelected ? null : abbr)}
              className={cn(
                'relative aspect-square rounded-[5px] flex flex-col items-center justify-center font-bold leading-none transition-transform duration-200 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
                'text-[8px] sm:text-[11px]',
                friends
                  ? 'text-[#0A0A0A]'
                  : open
                    ? 'bg-[#1C1C1C] border border-[#2A2A2A] text-[#666]'
                    : 'border border-dashed border-[#2A2A2A]/70 text-[#3A3A3A]',
                isHome && !friends && 'border-[#9B30FF] text-[#C89BFF] bg-[#9B30FF]/10',
                isSelected && 'ring-2 ring-white z-10'
              )}
              style={{
                gridColumnStart: col + 1,
                gridRowStart: row + 1,
                ...(friends
                  ? {
                      background: `linear-gradient(135deg, #FFD700, #FFA500)`,
                      opacity: 0.55 + 0.45 * (friends / max),
                      boxShadow: `0 0 ${8 + 10 * (friends / max)}px rgba(255,215,0,0.45)`,
                    }
                  : {}),
                ...(isHome && friends ? { outline: '2px solid #9B30FF', outlineOffset: '1px' } : {}),
              }}
            >
              {abbr}
              {friends > 0 && (
                <span className="hidden sm:block mt-0.5 text-[9px] font-semibold tabular-nums">{friends}</span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-4 min-h-[1.25rem] text-sm text-white" aria-live="polite">
        {selectedTile ? (
          <>
            <span className="font-semibold">{selectedTile[1]}</span>
            <span className="text-[#A0A0A0]">
              {' '}
              · {describe(selectedTile[0])}
              {selectedTile[0] === homeState ? ' · your state' : ''}
            </span>
          </>
        ) : (
          <span className="text-[#777]">Tap a state for details.</span>
        )}
      </p>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#A0A0A0]">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-gradient-to-br from-[#FFD700] to-[#FFA500]" /> Friends joined
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-[#9B30FF] bg-[#9B30FF]/10" /> Your state
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-[#2A2A2A] bg-[#1C1C1C]" /> Pack Rewards open
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-dashed border-[#2A2A2A]" /> Not open yet
        </li>
      </ul>
      <p className="mt-3 text-[11px] text-[#777]">
        Counts by state only. A friend shows up here after they join through your link and confirm they’re 21+.
      </p>
    </section>
  )
}
