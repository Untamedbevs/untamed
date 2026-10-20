'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Check, X } from 'lucide-react'

interface ShippingStatesProps {
  compact?: boolean
  accentColor?: string
}

/** States (plus DC) we can legally ship to. Update this list when coverage changes. */
export const SHIPPING_STATES = new Set([
  'AL', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY',
  'LA', 'MA', 'MD', 'ME', 'MN', 'MO', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
])

const STATE_COUNT = [...SHIPPING_STATES].filter((s) => s !== 'DC').length

/** Tile-grid cartogram: [abbr, name, col, row] on a 12 x 8 grid. */
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

/** Anchor for "Ships to 42 states + DC" links; lands on the full checker on /shop. */
export const SHIP_CHECK_ID = 'ship-check'
export const SHIP_CHECK_HREF = `/shop#${SHIP_CHECK_ID}`

const SORTED_TILES = [...TILES].sort((a, b) => a[1].localeCompare(b[1]))

/**
 * "Do we ship to you?" tile map. Shipping states glow in the accent color,
 * the rest sit dark. Tapping a tile or picking from the dropdown gives an
 * instant yes / not-yet answer.
 */
export function ShippingStates({ compact = false, accentColor = '#C68BFF' }: ShippingStatesProps) {
  const [selected, setSelected] = useState<string>('')
  const selectRef = useRef<HTMLSelectElement>(null)

  // Arriving via a "Ships to 42 states + DC" link: focus the picker so they can check right away.
  useEffect(() => {
    if (compact) return
    const focusIfTargeted = () => {
      if (window.location.hash === `#${SHIP_CHECK_ID}`) selectRef.current?.focus({ preventScroll: true })
    }
    focusIfTargeted()
    window.addEventListener('hashchange', focusIfTargeted)
    return () => window.removeEventListener('hashchange', focusIfTargeted)
  }, [compact])
  const selectedTile = TILES.find((t) => t[0] === selected)
  const ships = selected ? SHIPPING_STATES.has(selected) : null

  return (
    <div
      id={compact ? undefined : SHIP_CHECK_ID}
      className={`scroll-mt-28 border border-card-border overflow-hidden ${
        compact ? 'mt-4 rounded-xl bg-untamed-black-card/50' : 'rounded-2xl bg-untamed-black-card'
      }`}
    >
      <div className={`${compact ? 'px-4 pt-4' : 'px-6 py-4 border-b border-card-border'} flex items-center gap-3`}>
        <MapPin className={compact ? 'w-4 h-4' : 'w-5 h-5'} style={{ color: accentColor }} />
        <div>
          <h3
            className={
              compact
                ? 'text-xs uppercase tracking-wider font-medium text-untamed-white-muted'
                : 'text-untamed-white font-bold text-base'
            }
          >
            We ship to {STATE_COUNT} states + DC
          </h3>
          {!compact && (
            <p className="text-untamed-white-muted text-xs">Tap your state or pick it below</p>
          )}
        </div>
      </div>

      <div className={compact ? 'px-4 pt-3' : 'px-6 pt-5'}>
        <div
          className="grid gap-[3px] sm:gap-1"
          style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
          role="list"
          aria-label="Map of states we ship to"
        >
          {TILES.map(([abbr, name, col, row], i) => {
            const on = SHIPPING_STATES.has(abbr)
            const isSelected = abbr === selected
            return (
              <button
                key={abbr}
                type="button"
                role="listitem"
                title={`${name}: ${on ? 'we ship here' : 'not yet'}`}
                aria-label={`${name}: ${on ? 'we ship here' : 'not yet'}`}
                onClick={() => setSelected(isSelected ? '' : abbr)}
                className={`aspect-square rounded-[4px] flex items-center justify-center font-bold leading-none transition-all duration-300 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-untamed-white ${
                  compact ? 'text-[7px] sm:text-[9px]' : 'text-[8px] sm:text-[11px]'
                }`}
                style={{
                  gridColumnStart: col + 1,
                  gridRowStart: row + 1,
                  backgroundColor: on ? accentColor : 'transparent',
                  color: on ? '#0A0A0A' : 'rgba(160,160,160,0.45)',
                  border: on ? 'none' : '1px dashed rgba(160,160,160,0.25)',
                  boxShadow: isSelected
                    ? `0 0 0 2px #FAFAFA, 0 0 16px ${on ? accentColor : 'transparent'}`
                    : on
                      ? `0 0 10px ${accentColor}33`
                      : 'none',
                  opacity: on ? 1 : 0.8,
                  transitionDelay: `${i * 8}ms`,
                }}
              >
                {abbr}
              </button>
            )
          })}
        </div>
      </div>

      <div className={compact ? 'p-4' : 'px-6 py-5'}>
        <label className="sr-only" htmlFor={compact ? 'ship-state-compact' : 'ship-state'}>
          Check your state
        </label>
        <select
          ref={selectRef}
          id={compact ? 'ship-state-compact' : 'ship-state'}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-card-border bg-untamed-black-light px-3 py-2.5 text-sm text-untamed-white focus:outline-none focus:border-untamed-white-muted"
        >
          <option value="">Do we ship to you? Pick your state…</option>
          {SORTED_TILES.map(([abbr, name]) => (
            <option key={abbr} value={abbr}>
              {name}
            </option>
          ))}
        </select>

        {selectedTile && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
            style={{
              backgroundColor: ships ? `${accentColor}1A` : 'rgba(160,160,160,0.08)',
              color: ships ? accentColor : '#A0A0A0',
            }}
            aria-live="polite"
          >
            {ships ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            <span>
              {ships
                ? `Yes! We ship to ${selectedTile[1]}. Your martinis are a few clicks away.`
                : `Not yet. We can't ship to ${selectedTile[1]} right now, but we're working on it.`}
            </span>
          </div>
        )}

        {!compact && (
          <div className="mt-4 flex items-center justify-center gap-5 text-xs text-untamed-white-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-[3px]" style={{ backgroundColor: accentColor }} />
              We ship here
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-[3px] border border-dashed border-untamed-white-muted/40" />
              Not yet
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
