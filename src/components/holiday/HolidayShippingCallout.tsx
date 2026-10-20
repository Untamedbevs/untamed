import { Gift } from 'lucide-react'
import { HOLIDAY_PROMO, isHolidayPromoActive } from '@/lib/promo/holiday'
import { BoxMath } from '@/components/holiday/BoxMath'

/** Compact promo card for product pages — sits beside the add-to-cart. */
export function HolidayShippingCallout() {
  if (!isHolidayPromoActive()) return null

  return (
    <div className="relative mb-6 rounded-2xl border border-[#FFD700]/40 bg-gradient-to-br from-[#FFD700]/15 via-untamed-black-card to-untamed-black-card p-5 overflow-hidden">
      <div className="holiday-flavor-rule absolute inset-x-0 top-0 h-1" aria-hidden="true" />
      <div className="flex items-center gap-2 mb-1">
        <Gift className="w-4 h-4 text-[#FFD700]" aria-hidden="true" />
        <span className="font-headline text-[#FFD700] text-lg tracking-wider">Holiday Blast</span>
      </div>
      <p className="font-condensed font-bold uppercase text-untamed-white text-2xl tracking-wide leading-tight">
        Free shipping on ${HOLIDAY_PROMO.freeShippingThreshold}+
      </p>
      <p className="text-[#FFD700]/90 text-sm font-medium mt-1 mb-4">{HOLIDAY_PROMO.autoApplyNote}</p>
      <BoxMath size="sm" />
    </div>
  )
}
