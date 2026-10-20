import { HOLIDAY_PROMO } from '@/lib/promo/holiday'

const TICKER = [
  'Holiday Blast',
  `Free shipping on $${HOLIDAY_PROMO.freeShippingThreshold}+`,
  `That’s just ${HOLIDAY_PROMO.freeShippingBoxes} boxes`,
  'Holiday season is martini season',
  'Mix any flavors',
  'Wrap up something wild',
  'Make midnight a martini moment',
]

const DOT_COLORS = ['#9B30FF', '#E6D800', '#8DB33A', '#FF8C2A']

/**
 * Scrolling ticker that sits above the main nav on every page while the
 * holiday promo is live. Fixed height (h-9) — Navigation reserves it.
 */
export function HolidayPromoBar() {
  // Two identical runs so the -50% translate loops seamlessly.
  const run = [...TICKER, ...TICKER]

  return (
    <a
      href="/shop"
      className="group relative block h-9 overflow-hidden bg-[#FFD700] text-untamed-black"
      aria-label={`Holiday Blast: free shipping on orders of $${HOLIDAY_PROMO.freeShippingThreshold} or more. Shop now.`}
    >
      <div className="holiday-flavor-rule absolute inset-x-0 bottom-0 h-[3px]" aria-hidden="true" />
      <div className="flex h-full w-max items-center animate-holiday-marquee group-hover:[animation-play-state:paused]" aria-hidden="true">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center">
            {run.map((item, i) => (
              <span key={`${copy}-${i}`} className="flex items-center">
                <span
                  className={
                    i % TICKER.length === 0
                      ? 'font-headline text-base tracking-wider px-5'
                      : 'font-condensed font-bold uppercase text-sm tracking-[0.18em] px-5'
                  }
                >
                  {item}
                </span>
                <span
                  className="h-2 w-2 rotate-45 shrink-0"
                  style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
      <span className="absolute right-0 top-0 bottom-[3px] hidden sm:flex items-center gap-1 bg-untamed-black px-4 font-condensed font-bold uppercase text-xs tracking-[0.2em] text-[#FFD700] group-hover:text-white transition-colors">
        Shop Now →
      </span>
    </a>
  )
}
