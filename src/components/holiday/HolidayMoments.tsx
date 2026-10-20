'use client'

import { motion } from 'framer-motion'
import { HOLIDAY_MOMENTS, HOLIDAY_PROMO } from '@/lib/promo/holiday'

interface HolidayMomentsProps {
  ctaHref?: string
}

/** Five campaign moments — parties through New Year's Eve — as a card grid. */
export function HolidayMoments({ ctaHref = '/shop' }: HolidayMomentsProps) {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/40 to-transparent" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-[#FFD700] text-sm tracking-[0.3em] uppercase mb-3">Holiday Blast</p>
          <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-4">
            A Martini For{' '}
            <span className="font-headline text-holiday-foil">Every Moment</span>
          </h2>
          <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
            Parties, gifts, hosting, midnight. Stack {HOLIDAY_PROMO.freeShippingBoxes} boxes and shipping&apos;s free.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 md:gap-5">
          {HOLIDAY_MOMENTS.map((m, i) => (
            <motion.a
              key={m.key}
              href={ctaHref}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              // 3 cards on the first row, 2 wider ones on the second (lg)
              className={`group relative flex flex-col rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-7 overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                i < 3 ? 'lg:col-span-2' : 'lg:col-span-3'
              } ${i === 4 ? 'sm:col-span-2' : ''}`}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: m.color }} aria-hidden="true" />
              <div
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                style={{ backgroundColor: m.color }}
                aria-hidden="true"
              />
              <p className="relative text-xs font-semibold uppercase tracking-[0.25em] mb-3" style={{ color: m.color }}>
                {m.eyebrow}
              </p>
              <h3 className="relative font-condensed font-bold uppercase text-untamed-white text-2xl md:text-3xl leading-[1.05] tracking-wide mb-3">
                {m.headline}
              </h3>
              <p className="relative text-untamed-white-muted text-sm leading-relaxed mb-6 flex-1">{m.body}</p>
              <span
                className="relative inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors duration-300 group-hover:text-untamed-black"
                style={{ borderColor: m.color, color: m.color }}
              >
                <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: m.color }} aria-hidden="true" />
                <span className="relative">{m.cta} &rarr;</span>
              </span>
            </motion.a>
          ))}
        </div>

        <p className="mt-8 text-center text-untamed-white-muted/60 text-xs">
          15% ABV &bull; 2 Martinis Per Can &bull; Made with Vodka &amp; Natural Flavors &bull; 21+ &bull; Enjoy responsibly.
        </p>
      </div>
    </section>
  )
}
