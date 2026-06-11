'use client'

import { Truck, Package } from 'lucide-react'

interface ShippingRatesProps {
  compact?: boolean
  accentColor?: string
}

const TIERS = [
  { range: '2–3 boxes', price: '$21.99', perBox: '$7.33–$11.00' },
  { range: '4–7 boxes', price: '$43.99', perBox: '$6.28–$11.00' },
]

/**
 * Displays shipping rate tiers to help customers make informed
 * decisions about order quantity. Minimum order is 2 boxes.
 */
export function ShippingRates({ compact = false, accentColor }: ShippingRatesProps) {
  if (compact) {
    return (
      <div className="rounded-xl border border-card-border bg-untamed-black-card/50 p-4 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="w-4 h-4 text-untamed-white-muted" />
          <span className="text-xs uppercase tracking-wider font-medium text-untamed-white-muted">
            Shipping &bull; Continental US
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {TIERS.map((tier) => (
            <div key={tier.range} className="flex flex-col">
              <span className="text-untamed-white font-medium">{tier.range}</span>
              <span className="text-untamed-white-muted text-xs">{tier.price} shipping</span>
            </div>
          ))}
        </div>
        <p className="text-untamed-white-muted/60 text-xs mt-2">
          Minimum order: 2 boxes &bull; Save per box by ordering more
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
          <p className="text-untamed-white-muted text-xs">Continental US &bull; Minimum order: 2 boxes</p>
        </div>
      </div>

      <div className="divide-y divide-card-border">
        {TIERS.map((tier) => (
          <div key={tier.range} className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-untamed-white-muted" />
              <div>
                <p className="text-untamed-white font-medium">{tier.range}</p>
                <p className="text-untamed-white-muted text-xs">{tier.perBox} per box</p>
              </div>
            </div>
            <p className="text-untamed-white font-bold text-lg">{tier.price}</p>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 bg-untamed-black-light/30">
        <p className="text-untamed-white-muted text-xs text-center">
          Order more boxes to lower your per-box shipping cost. Each box contains 4 cans (8 cocktails).
        </p>
      </div>
    </div>
  )
}
