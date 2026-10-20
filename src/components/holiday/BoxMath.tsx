import { Truck } from 'lucide-react'
import { HOLIDAY_PROMO } from '@/lib/promo/holiday'

const FLAVOR_COLORS = ['#9B30FF', '#E6D800', '#8DB33A', '#FF8C2A']

/**
 * "1 · 2 · 3 · 4 = free shipping" meter. Static — AccelPay doesn't expose box
 * quantity to the page, so this explains the math rather than tracking it.
 */
export function BoxMath({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const n = HOLIDAY_PROMO.freeShippingBoxes
  const total = n * HOLIDAY_PROMO.boxPrice
  const cell = size === 'sm' ? 'h-9 text-sm' : 'h-12 sm:h-14 text-lg sm:text-xl'

  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr)) auto` }}>
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className={`${cell} flex items-center justify-center rounded-md font-condensed font-bold text-untamed-black`}
            style={{ backgroundColor: FLAVOR_COLORS[i % FLAVOR_COLORS.length] }}
          >
            {i + 1}
          </div>
        ))}
        <div
          className={`${cell} flex items-center gap-2 rounded-md bg-[#FFD700] px-3 sm:px-4 font-condensed font-bold uppercase tracking-wider text-untamed-black`}
        >
          <Truck className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} aria-hidden="true" />
          Free
        </div>
      </div>
      <p className={`mt-2 text-untamed-white-muted ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        <span className="text-untamed-white font-semibold">{n} boxes = ${total}</span> &mdash; clears the $
        {HOLIDAY_PROMO.freeShippingThreshold} mark. Mix any flavors, shipping&apos;s on us.
      </p>
    </div>
  )
}
