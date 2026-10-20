'use client'

import { Truck, Package } from 'lucide-react'
import { HOLIDAY_PROMO, isHolidayPromoActive } from '@/lib/promo/holiday'

interface ShippingRatesProps {
  compact?: boolean
  accentColor?: string
}

const TIERS: { range: string; price: string; perBox: string | null }[] = [
  { range: '2–6 boxes', price: '$19.95', perBox: '$3.33–$9.98' },
  { range: '7–12 boxes', price: '$39.95', perBox: '$3.33–$5.71' },
  { range: '13+ boxes', price: 'Free', perBox: null },
]

const FREE_AT = HOLIDAY_PROMO.freeShippingBoxes
const HOLIDAY_TIERS: typeof TIERS = [
  { range: `2–${FREE_AT - 1} boxes`, price: '$19.95', perBox: `$${(19.95 / (FREE_AT - 1)).toFixed(2)}–$9.98` },
  { range: `${FREE_AT}+ boxes`, price: 'Free', perBox: null },
]

/**
 * Displays shipping rate tiers to help customers make informed
 * decisions about order quantity. Minimum order is 2 boxes.
 */
export function ShippingRates({ compact = false, accentColor }: ShippingRatesProps) {
  const holiday = isHolidayPromoActive()
  const tiers = holiday ? HOLIDAY_TIERS : TIERS
  const freeNote = holiday
    ? `Holiday Blast: free shipping on $${HOLIDAY_PROMO.freeShippingThreshold}+ (${FREE_AT}+ boxes), auto-applied in cart`
    : 'Free shipping on 13+'

  if (compact) {
    return (
      <div className="rounded-xl border border-card-border bg-untamed-black-card/50 p-4 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="w-4 h-4 text-untamed-white-muted" />
          <span className="text-xs uppercase tracking-wider font-medium text-untamed-white-muted">
            Shipping &bull; 42 states + DC
          </span>
        </div>
        <div className={`grid grid-cols-1 gap-3 text-sm ${holiday ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {tiers.map((tier) => (
            <div key={tier.range} className="flex flex-col">
              <span className="text-untamed-white font-medium">{tier.range}</span>
              <span className="text-untamed-white-muted text-xs">
                {tier.perBox ? `${tier.price} shipping` : 'Free shipping'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-untamed-white-muted/60 text-xs mt-2">
          Minimum order: 2 boxes &bull; {freeNote}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-card-border bg-untamed-black-card overflow-hidden">
      <div className="px-6 py-4 border-b border-card-border flex items-center gap-3">
        <Truck className="w-5 h-5" style={{ color: accentColor || '#C68BFF' }} />
        <div>
          <h3 className="text-untamed-white font-bold text-base">Shipping Rates</h3>
          <p className="text-untamed-white-muted text-xs">42 states + DC &bull; Minimum order: 2 boxes</p>
        </div>
      </div>

      <div className="divide-y divide-card-border">
        {tiers.map((tier) => (
          <div key={tier.range} className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-untamed-white-muted" />
              <div>
                <p className="text-untamed-white font-medium">{tier.range}</p>
                {tier.perBox && (
                  <p className="text-untamed-white-muted text-xs">{tier.perBox} per box</p>
                )}
              </div>
            </div>
            <p className="text-untamed-white font-bold text-lg">{tier.price}</p>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 bg-untamed-black-light/30">
        <p className="text-untamed-white-muted text-xs text-center">
          {holiday ? `${freeNote}, no code needed.` : 'Free shipping on 13+ boxes.'} Each box contains 4 cans (8 cocktails).
        </p>
      </div>
    </div>
  )
}
