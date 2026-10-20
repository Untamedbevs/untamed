'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { HOLIDAY_MOMENTS, HOLIDAY_PROMO } from '@/lib/promo/holiday'
import { BoxMath } from '@/components/holiday/BoxMath'
import { SHIP_CHECK_HREF } from '@/components/ShippingStates'

interface HolidayHeroProps {
  /** Where the primary CTA goes — "#products" on the shop page, "/shop" elsewhere. */
  ctaHref?: string
}

const CAN_FAN = [
  { rotate: -16, x: '-7.5rem', y: '1.5rem', z: 1 },
  { rotate: -6, x: '-2.6rem', y: '0rem', z: 2 },
  { rotate: 6, x: '2.6rem', y: '0rem', z: 2 },
  { rotate: 16, x: '7.5rem', y: '1.5rem', z: 1 },
]

export function HolidayHero({ ctaHref = '/shop' }: HolidayHeroProps) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const moment = HOLIDAY_MOMENTS[index]

  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => setIndex((i) => (i + 1) % HOLIDAY_MOMENTS.length), 4200)
    return () => clearInterval(id)
  }, [reduceMotion])

  return (
    <section className="relative overflow-hidden border-y border-[#FFD700]/25 bg-untamed-black">
      {/* Texture + glow */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image src="/images/scratch-lioness.png" alt="" fill className="object-cover opacity-[0.12]" />
        <div className="absolute inset-0 bg-gradient-to-br from-untamed-black via-untamed-black/85 to-untamed-black" />
        <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full blur-[160px] opacity-25 bg-[#FFD700]" />
        <div
          className="absolute -bottom-32 right-0 w-[30rem] h-[30rem] rounded-full blur-[160px] opacity-25 transition-colors duration-1000"
          style={{ backgroundColor: moment.color }}
        />
      </div>
      <div className="holiday-flavor-rule absolute inset-x-0 top-0 h-1" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-10 items-center">
          {/* Copy */}
          <div>
            <p className="font-wild cyber-brush-fix text-holiday-foil text-5xl sm:text-6xl md:text-7xl leading-none mb-4">
              Holiday Blast
            </p>

            <div className="min-h-[6.5rem] sm:min-h-[8rem] md:min-h-[9.25rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={moment.key}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -18 }}
                  transition={{ duration: 0.35 }}
                >
                  <p
                    className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] mb-2"
                    style={{ color: moment.color }}
                  >
                    {moment.eyebrow}
                  </p>
                  <h2
                    className={`font-condensed font-bold uppercase text-untamed-white leading-[0.95] tracking-wide ${
                      // Long lines (host gifts) drop a size so every headline stays at two lines
                      moment.headline.length > 36
                        ? 'text-[1.65rem] sm:text-4xl md:text-[2.75rem]'
                        : 'text-4xl sm:text-5xl md:text-6xl'
                    }`}
                  >
                    {moment.headline}
                  </h2>
                </motion.div>
              </AnimatePresence>
            </div>

            <p className="text-untamed-white-muted text-base md:text-lg leading-relaxed max-w-xl mt-4 mb-3">
              Award-winning craft martinis in Espresso, Lemon Drop, Classic Dirty, and Peach &amp; Rosemary.
              Ready to serve. Made with vodka &amp; natural flavors.
            </p>
            <p className="text-untamed-white text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-8">
              15% ABV &bull; 2 Martinis Per Can &bull; 4 Flavors
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10">
              <a
                href={ctaHref}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#FFD700] text-untamed-black font-condensed font-bold uppercase tracking-[0.15em] text-base
                  hover:bg-white hover:shadow-[0_0_40px_rgba(255,215,0,0.45)] transition-all duration-300 active:scale-95"
              >
                {moment.cta} &rarr;
              </a>
              <span className="text-untamed-white-muted text-sm text-center sm:text-left">
                Free shipping on ${HOLIDAY_PROMO.freeShippingThreshold}+ &bull; <a href={SHIP_CHECK_HREF} className="underline decoration-dotted underline-offset-4 hover:text-untamed-white transition-colors">Ships to {HOLIDAY_PROMO.shippingRegion}</a>
                <br />
                <span className="text-[#FFD700]/90 font-medium">{HOLIDAY_PROMO.autoApplyNote}</span>
              </span>
            </div>

            <div className="max-w-md">
              <BoxMath />
            </div>
          </div>

          {/* Stamp + cans */}
          <div className="relative flex flex-col items-center">
            <div className="relative h-80 sm:h-[26rem] w-full max-w-md">
              {drinks.map((drink, i) => {
                const pos = CAN_FAN[i % CAN_FAN.length]
                return (
                  <motion.div
                    key={drink.slug}
                    className="absolute left-1/2 bottom-0 w-24 h-64 sm:w-32 sm:h-80 -ml-12 sm:-ml-16"
                    style={{ zIndex: pos.z }}
                    initial={{ opacity: 0, y: 40, rotate: 0, x: 0 }}
                    whileInView={{ opacity: 1, y: pos.y, rotate: pos.rotate, x: pos.x }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: 0.1 * i, type: 'spring', bounce: 0.3 }}
                  >
                    <Image
                      src={siteAssetAbsoluteUrl(drink.canImage)}
                      alt={`${drink.name} ${drink.flavor}`}
                      fill
                      className="object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.7)]"
                      unoptimized
                    />
                  </motion.div>
                )
              })}

              {/* Free-shipping stamp */}
              <motion.div
                className="absolute -top-2 right-0 sm:right-2 z-10 flex h-32 w-32 sm:h-36 sm:w-36 flex-col items-center justify-center rounded-full bg-[#FFD700] text-untamed-black shadow-[0_0_50px_rgba(255,215,0,0.4)] ring-4 ring-untamed-black ring-offset-2 ring-offset-[#FFD700]"
                initial={{ scale: 0, rotate: -40 }}
                whileInView={{ scale: 1, rotate: 12 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.5 }}
              >
                <span className="font-condensed font-bold uppercase text-xs tracking-[0.2em]">Free Shipping</span>
                <span className="font-headline text-5xl sm:text-6xl leading-none">
                  ${HOLIDAY_PROMO.freeShippingThreshold}+
                </span>
                <span className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em]">
                  {HOLIDAY_PROMO.freeShippingBoxes}+ Boxes
                </span>
              </motion.div>
            </div>

            {/* Moment pager */}
            <div className="mt-8 flex gap-2" role="tablist" aria-label="Holiday moments">
              {HOLIDAY_MOMENTS.map((m, i) => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={m.eyebrow}
                  onClick={() => setIndex(i)}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? '2.5rem' : '0.75rem',
                    backgroundColor: i === index ? m.color : 'rgba(250,250,250,0.2)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-untamed-white-muted/60 text-xs">
          Free shipping on orders ${HOLIDAY_PROMO.freeShippingThreshold}+ shipped to {HOLIDAY_PROMO.shippingRegion}, through Dec 31. Auto-applied in cart; no code needed.
          21+ &bull; Enjoy responsibly.
        </p>
      </div>
    </section>
  )
}
