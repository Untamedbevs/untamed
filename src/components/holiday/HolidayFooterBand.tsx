import Image from 'next/image'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { HOLIDAY_PROMO, isHolidayPromoActive } from '@/lib/promo/holiday'

/** Last-call promo band rendered at the top of the footer on every page. */
export function HolidayFooterBand() {
  if (!isHolidayPromoActive()) return null

  return (
    <div className="relative overflow-hidden border-b border-card-border bg-[#FFD700] text-untamed-black">
      <div className="holiday-flavor-rule absolute inset-x-0 bottom-0 h-1" aria-hidden="true" />
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-12 py-10 md:py-12 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-8 items-center">
        <div className="hidden md:flex -space-x-5">
          {drinks.map((drink, i) => (
            <div
              key={drink.slug}
              className="relative w-14 h-32"
              style={{ transform: `rotate(${(i - 1.5) * 7}deg)` }}
            >
              <Image
                src={siteAssetAbsoluteUrl(drink.canImage)}
                alt=""
                fill
                className="object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]"
                unoptimized
              />
            </div>
          ))}
        </div>

        <div className="text-center md:text-left">
          <p className="font-headline text-xl tracking-wider mb-1">Holiday Blast</p>
          <p className="font-condensed font-bold uppercase text-3xl sm:text-4xl md:text-5xl leading-[0.95] tracking-wide">
            Wrap up something wild.
          </p>
          <p className="mt-2 text-sm sm:text-base font-medium text-untamed-black/75">
            Free shipping on ${HOLIDAY_PROMO.freeShippingThreshold}+ &mdash; that&apos;s {HOLIDAY_PROMO.freeShippingBoxes} boxes, any flavors.
          </p>
        </div>

        <div className="flex flex-col items-center md:items-end gap-3">
          <a
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-untamed-black px-8 py-3.5 font-condensed font-bold uppercase tracking-[0.15em] text-[#FFD700] transition-all duration-300 hover:bg-untamed-black-light hover:scale-[1.03] active:scale-95"
          >
            Shop Now &rarr;
          </a>
          <a
            href="/retail"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-untamed-black/70 underline underline-offset-4 decoration-untamed-black/30 hover:text-untamed-black"
          >
            Seeking retail partners &rarr;
          </a>
        </div>
      </div>
      <p className="pb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-untamed-black/60">
        21+ &bull; Enjoy responsibly
      </p>
    </div>
  )
}
