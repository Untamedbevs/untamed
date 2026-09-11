'use client'

import { Truck, Package } from 'lucide-react'

interface ShippingRatesProps {
  compact?: boolean
  accentColor?: string
}

const TIERS: { range: string; price: string; perBox: string | null }[] = [
  { range: '2–6 boxes', price: '$19.95', perBox: '$3.33–$9.98' },
  { range: '7–12 boxes', price: '$39.95', perBox: '$3.33–$5.71' },
  { range: '13+ boxes', price: 'Free', perBox: null },
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          {TIERS.map((tier) => (
            <div key={tier.range} className="flex flex-col">
              <span className="text-untamed-white font-medium">{tier.range}</span>
              <span className="text-untamed-white-muted text-xs">
                {tier.perBox ? `${tier.price} shipping` : 'Free shipping'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-untamed-white-muted/60 text-xs mt-2">
          Minimum order: 2 boxes &bull; Free shipping on 13+
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
          Free shipping on 13+ boxes. Each box contains 4 cans (8 cocktails).
        </p>
      </div>
    </div>
  )
}
