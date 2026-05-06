'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { drinks } from '@/lib/drinks'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

const flavorDescriptions: Record<string, string> = {
  'black-panther': 'Espresso Vodka Martini with Vanilla-Caramel. It\u2019s midnight in a can.',
  cheetah: 'Lemon Drop Martini. Zero hesitation. Just go.',
  cougar: 'Classic Dirty Martini. Iconic by nature.',
  lioness: 'Peach & Rosemary Martini. Simply unforgettable.',
}

export default function AboutPage() {
  return (
    <>
      <Navigation />

      <main>
      {/* The letter */}
      <section className="relative pt-36 md:pt-44 pb-20 md:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-0 w-64 h-64 rounded-full blur-[150px] opacity-8 bg-cougar" />
          <div className="absolute bottom-1/3 left-0 w-64 h-64 rounded-full blur-[150px] opacity-8 bg-cheetah" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16 md:mb-20"
          >
            <h1 className="font-[var(--font-oswald)] text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white">
              Our Story
            </h1>
            <div className="mt-4 w-16 h-px mx-auto bg-gradient-to-r from-transparent via-lioness to-transparent" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8 text-untamed-white-muted text-lg md:text-xl leading-relaxed"
          >
            <p className="text-untamed-white text-xl md:text-2xl leading-relaxed font-light italic">
              Big-cat energy. Two-martini value. One seriously untamed pour.
            </p>

            <p>
              Untamed Beverages offers premium, ready-to-drink martinis for people who don&apos;t do ordinary.
              Born from a backyard fire pit and built for bold nights out (or in), our cocktails are crafted
              to taste like the real thing&mdash;because they are.
            </p>

            <p>
              It started with three couples&mdash;Bruce &amp; Cindy Carr, Joe &amp; Sheila Colella, and
              Lee &amp; Carol Thaxton&mdash;sharing cocktails around a backyard fire pit as friends and neighbors.
            </p>

            <p>
              Carol, affectionately known as &ldquo;<span className="text-lioness font-medium font-wild cyber-brush-fix text-2xl md:text-3xl">The Lioness</span>,&rdquo;
              helped spark a simple question that wouldn&apos;t go away:{' '}
              <span className="text-untamed-white font-medium italic">
                What if a martini could come ready to drink, taste premium, and feel empowering?
              </span>
            </p>

            <p>
              We weren&apos;t looking to start a &ldquo;Second Act,&rdquo; but the idea was too good&mdash;and
              too fun&mdash;to ignore.
            </p>

            <p>
              That night, after plenty of laughs, drinks, and name ideas, Joe finally said it:{' '}
              <span className="font-wild cyber-brush-fix text-2xl md:text-3xl text-untamed-white">Untamed Beverages</span>.
              We all immediately said yes&mdash;it captured our vision.
            </p>

            <p>
              Inspired by the world&apos;s biggest cats, we&apos;re built for presence, power, and that unmistakable
              don&apos;t-mess-with-me energy. We built a brand around confidence, and every can is designed to deliver
              a martini moment that&apos;s as fierce as its namesake.
            </p>

            <p>
              What followed was 12+ months of dialing in formulas, building standout packaging, and partnering
              with the right people to bring truly great canned cocktails to market.
            </p>
          </motion.div>

          {/* What's inside */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-16 pt-16 border-t border-card-border"
          >
            <h2 className="font-[var(--font-condensed)] text-2xl md:text-3xl font-bold uppercase tracking-wider text-untamed-white mb-6 text-center">
              What&apos;s Inside
            </h2>
            <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed text-center mb-10">
              Each 12 oz can is 15% ABV and delivers two full premium vodka martinis&mdash;double the pour,
              double the value. Share one, save one for later, or keep both for a longer martini moment.
            </p>

            <div className="space-y-4">
              {drinks.map((drink, index) => (
                <motion.div
                  key={drink.slug}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  <Link
                    href={`/drinks/${drink.slug}`}
                    className="flex items-baseline gap-3 group py-3 px-4 -mx-4 rounded-xl
                      hover:bg-untamed-black-card transition-colors duration-300"
                  >
                    <span
                      className="font-wild cyber-brush-fix text-xl md:text-2xl shrink-0"
                      style={{ color: drink.color }}
                    >
                      {drink.name}
                    </span>
                    <span className="text-card-border hidden sm:block">&mdash;</span>
                    <span className="text-untamed-white-muted text-base leading-relaxed">
                      {flavorDescriptions[drink.slug]}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Closing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-16 pt-16 border-t border-card-border space-y-8 text-lg md:text-xl leading-relaxed"
          >
            <p className="text-untamed-white font-medium italic text-xl md:text-2xl">
              &ldquo;At Untamed Beverages, we craft premium ready-to-drink martinis that don&apos;t compromise on
              flavor or attitude. These aren&apos;t just cocktails&mdash;they&apos;re an identity.&rdquo;
            </p>

            <p className="text-untamed-white-muted">
              From our cul-de-sac to your glass&mdash;thank you for being part of the Untamed story.
            </p>

            <div className="pt-4">
              <p className="text-untamed-white-muted italic mb-2">With gratitude,</p>
              <p className="text-untamed-white font-medium">
                Bruce &amp; Cindy Carr, Joe &amp; Sheila Colella, and Lee &amp; Carol Thaxton
              </p>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-20 pt-16 border-t border-card-border text-center"
          >
            <p className="text-untamed-white-muted text-lg md:text-xl mb-2">
              Ready to go{' '}
              <span className="font-wild cyber-brush-fix text-2xl text-gradient-wild">Untamed</span>?
            </p>
            <p className="text-untamed-white-muted mb-8">
              Choose your cat, crack a can, and pour your next martini moment&mdash;two cocktails at a time.
            </p>
            <Link
              href="/#drinks"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-lioness to-cheetah
                text-untamed-black font-bold uppercase tracking-wider text-sm
                hover:shadow-[0_0_30px_rgba(232,117,17,0.4)] transition-all duration-300"
            >
              Shop Now
            </Link>
          </motion.div>
        </div>
      </section>
    </main>

      <Footer />
    </>
  )
}
