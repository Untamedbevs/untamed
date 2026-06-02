'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { drinks } from '@/lib/drinks'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

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
        {/* ============================================
            HERO
            ============================================ */}
        <section className="relative pt-10 md:pt-14 pb-20 md:pb-28 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-1/4 right-0 w-96 h-96 rounded-full blur-[180px] opacity-8 bg-cougar" />
            <div className="absolute bottom-1/3 left-0 w-96 h-96 rounded-full blur-[180px] opacity-8 bg-cheetah" />
            <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full blur-[150px] opacity-10 bg-panther" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-lioness/30 bg-lioness/10 text-sm font-medium mb-6 text-lioness">
                <Sparkles className="w-4 h-4" />
                The Founders
              </div>

              <h1 className="font-condensed text-4xl sm:text-6xl lg:text-7xl font-bold text-white uppercase mb-6">
                Built by <span className="font-headline text-gradient-wild">Passion</span>,<br />
                Driven by <span className="font-headline text-gradient-lioness">Purpose</span>
              </h1>

              <p className="text-lg sm:text-xl text-untamed-white-muted max-w-3xl mx-auto mb-10">
                We did not start <span className="font-headline text-untamed-white">Untamed</span> Beverages because the world needed another drink.
                We started it because this category had learned to settle.
              </p>

              {/* Section anchors */}
              <div className="flex flex-wrap justify-center gap-3 mb-14">
                <a href="#origin" className="px-5 py-2.5 rounded-full border border-lioness/30 text-lioness text-sm font-medium hover:bg-lioness/10 transition-colors">
                  Where It Began
                </a>
                <a href="#believe" className="px-5 py-2.5 rounded-full border border-panther-light/30 text-panther-light text-sm font-medium hover:bg-panther-light/10 transition-colors">
                  What We Believe
                </a>
                <a href="#promise" className="px-5 py-2.5 rounded-full border border-cheetah/30 text-cheetah text-sm font-medium hover:bg-cheetah/10 transition-colors">
                  Our Promise
                </a>
                <a href="#standards" className="px-5 py-2.5 rounded-full border border-cougar-light/30 text-cougar-light text-sm font-medium hover:bg-cougar-light/10 transition-colors">
                  How We Build
                </a>
              </div>
            </motion.div>

            {/* Product can showcase */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex justify-center gap-4 sm:gap-8"
            >
              {drinks.map((drink) => (
                <Link key={drink.slug} href={`/drinks/${drink.slug}`} className="text-center group">
                  <div className="relative w-16 h-28 sm:w-24 sm:h-40 mx-auto mb-2 group-hover:scale-105 transition-transform duration-300">
                    <Image
                      src={siteAssetAbsoluteUrl(drink.canImage)}
                      alt={drink.name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <p
                    className="font-wild cyber-brush-fix text-xs sm:text-sm transition-colors duration-300"
                    style={{ color: drink.color }}
                  >
                    {drink.name}
                  </p>
                </Link>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============================================
            WHERE IT BEGAN — ORIGIN STORY
            ============================================ */}
        <section id="origin" className="relative py-20 md:py-28 overflow-hidden scroll-mt-24">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <p className="text-lioness text-sm tracking-[0.3em] uppercase mb-3">
                The Beginning
              </p>
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white">
                Where It Began
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Story text */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="space-y-6 text-untamed-white-muted text-lg leading-relaxed"
              >
                <p>
                  It started with three couples&mdash;Bruce &amp; Cindy Carr, Joe &amp; Sheila Colella, and
                  Lee &amp; Carol Thaxton&mdash;sharing cocktails around a backyard fire pit as friends and neighbors.
                </p>

                <p>
                  Carol, affectionately known as &ldquo;<span className="text-lioness font-medium font-wild cyber-brush-fix text-2xl">The Lioness</span>,&rdquo;
                  helped spark a simple question that wouldn&apos;t go away:{' '}
                  <span className="text-untamed-white font-medium italic">
                    What if a martini could come ready to drink, taste premium, and feel empowering?
                  </span>
                </p>

                <p>
                  That night, after plenty of laughs, drinks, and name ideas, Joe finally said it:{' '}
                  <span className="font-wild cyber-brush-fix text-2xl text-untamed-white">Untamed Beverages</span>.
                  We all immediately said yes&mdash;it captured our vision.
                </p>

                <p>
                  Inspired by the world&apos;s biggest cats, we built a brand around confidence, presence, and that unmistakable
                  don&apos;t-mess-with-me energy. Every can is designed to deliver
                  a martini moment that&apos;s as fierce as its namesake.
                </p>
              </motion.div>

              {/* Right: Founders photo */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="rounded-2xl overflow-hidden border border-card-border">
                  <Image
                    src="https://media.untamedbeverages.com/media/Photography/1778853206490-Team_Untamed.png"
                    alt="The Untamed Founders — Bruce & Cindy Carr, Joe & Sheila Colella, Lee & Carol Thaxton"
                    width={800}
                    height={600}
                    className="w-full h-auto object-cover"
                    unoptimized
                  />
                </div>
                <p className="text-untamed-white-muted text-sm text-center mt-3 italic">
                  The founding team &mdash; where it all started, around the fire pit.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            WHAT WE BELIEVE
            ============================================ */}
        <section id="believe" className="relative py-20 md:py-28 overflow-hidden scroll-mt-24">
          <div className="absolute inset-0">
            <div className="absolute top-1/3 left-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-panther" />
            <div className="absolute bottom-1/3 right-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-lioness" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <p className="text-panther-light text-sm tracking-[0.3em] uppercase mb-3">
                Our Beliefs
              </p>
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white">
                What We Believe
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="space-y-6 text-untamed-white-muted text-lg leading-relaxed"
              >
                <p>
                  We believe consumers are ready for better. Better taste. Better design. Better standards. Better rituals.
                </p>

                <p>
                  People are no longer looking for a shortcut dressed up as innovation. They are looking for something they can bring to a table, pour at home, or open on impulse and still feel proud to serve.
                </p>

                <p>
                  That is why <span className="font-headline text-untamed-white">Untamed</span> matters. Our premium RTD martini line is not just convenient. It is deliberate. It is expressive. And it is backed by a value proposition that makes sense the moment someone sees it.
                </p>
              </motion.div>

              {/* Value callout card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="p-8 md:p-10 rounded-2xl border border-panther-light/20 bg-untamed-black-card text-center"
              >
                <p className="font-[var(--font-oswald)] text-5xl md:text-6xl font-bold text-untamed-white mb-2">$24</p>
                <p className="text-untamed-white-muted text-base mb-6">for a four-pack</p>
                <div className="flex justify-center gap-8 mb-6">
                  <div>
                    <p className="font-[var(--font-oswald)] text-3xl font-bold text-panther-light">8</p>
                    <p className="text-untamed-white-muted text-sm">Cocktails</p>
                  </div>
                  <div>
                    <p className="font-[var(--font-oswald)] text-3xl font-bold text-cheetah">$3</p>
                    <p className="text-untamed-white-muted text-sm">Per Cocktail</p>
                  </div>
                </div>
                <p className="text-untamed-white-muted text-sm">
                  That is not just pricing. That is premium value, stated with clarity.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            OUR PROMISE TO YOU
            ============================================ */}
        <section id="promise" className="relative py-20 md:py-28 overflow-hidden scroll-mt-24">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute top-1/2 left-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-cheetah" />
            <div className="absolute top-1/2 right-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-cougar" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <p className="text-lioness text-sm tracking-[0.3em] uppercase mb-3">
                Our Commitment
              </p>
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white">
                Our Promise to You
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="max-w-3xl mx-auto space-y-6 text-untamed-white-muted text-lg md:text-xl leading-relaxed mb-14"
            >
              <p>
                When you choose <span className="font-headline text-untamed-white">Untamed</span>, you should feel the difference immediately. You should feel that this was made with taste. With care. With standards. You should feel that you are not compromising because it came from a can&mdash;you are upgrading because it did.
              </p>

              <p>
                We want to give people a martini experience without the friction, without the pretension, and without the disappointment that has defined too much of this category for too long.
              </p>
            </motion.div>

            {/* Spirit animals grid */}
            <div className="mb-14">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-untamed-white-muted text-lg leading-relaxed text-center mb-8"
              >
                In each cat, there is a different energy to connect with:
              </motion.p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {drinks.map((drink, idx) => (
                  <motion.a
                    key={drink.slug}
                    href={`/drinks/${drink.slug}`}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="group flex flex-col items-center gap-3 p-5 rounded-xl border border-card-border bg-untamed-black-card hover:border-opacity-60 transition-all duration-300"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = drink.color
                      e.currentTarget.style.boxShadow = `0 0 20px ${drink.colorGlow}`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = ''
                      e.currentTarget.style.boxShadow = ''
                    }}
                  >
                    <div className="relative w-12 h-20">
                      <Image
                        src={siteAssetAbsoluteUrl(drink.animalImage)}
                        alt={drink.animal}
                        fill
                        className="object-contain group-hover:scale-110 transition-transform duration-500"
                        unoptimized
                      />
                    </div>
                    <div className="text-center">
                      <span className="font-wild cyber-brush-fix text-lg" style={{ color: drink.color }}>{drink.name}</span>
                      <p className="text-untamed-white-muted text-sm">{drink.spiritEnergy}</p>
                    </div>
                  </motion.a>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="max-w-3xl mx-auto text-center"
            >
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed mb-8">
                With every sip, the drink should feel like more than refreshment. It should feel like permission&mdash;to step into your own power, your own style, and your own untamed spirit.
              </p>

              <p className="text-untamed-white text-xl md:text-2xl font-light italic">
                The decision should feel as good as the drink itself.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            HOW WE BUILD — PILLARS
            ============================================ */}
        <section id="standards" className="relative py-20 md:py-28 overflow-hidden scroll-mt-24">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-14"
            >
              <p className="text-cheetah text-sm tracking-[0.3em] uppercase mb-3">
                Our Standards
              </p>
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white">
                How We Build
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  number: '01',
                  title: 'Authentic Martini Quality',
                  desc: 'Our products taste like real cocktails\u2014not watered-down substitutes built for convenience alone.',
                  color: 'var(--panther-light)',
                },
                {
                  number: '02',
                  title: 'Format as Advantage',
                  desc: 'Two full martinis in every 12-ounce can at 15% ALC/VOL creates a stronger proposition than single-serve novelty formats.',
                  color: 'var(--cheetah)',
                },
                {
                  number: '03',
                  title: 'Identity in Every Expression',
                  desc: 'From the dark sophistication of the Black Panther Espresso Martini to the bright confidence of the Cheetah Lemon Drop, the commanding character of the Cougar Classic Dirty, and the elegant finish of the Lioness Peach & Rosemary.',
                  color: 'var(--cougar-light)',
                },
                {
                  number: '04',
                  title: 'The 1-2-3 Advantage',
                  desc: 'One can. Two full martinis. Three dollars per cocktail. At $24 for a four-pack, the math is effortless: four cans, eight total cocktails, premium quality, and a price consumers can justify instantly.',
                  color: 'var(--lioness)',
                },
              ].map((pillar, idx) => (
                <motion.div
                  key={pillar.number}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="flex gap-5 p-6 md:p-8 rounded-2xl border border-card-border bg-untamed-black-card"
                >
                  <p
                    className="font-[var(--font-condensed)] text-4xl md:text-5xl font-bold opacity-30 shrink-0"
                    style={{ color: pillar.color }}
                  >
                    {pillar.number}
                  </p>
                  <div>
                    <h3
                      className="text-lg md:text-xl font-bold uppercase tracking-wider mb-2"
                      style={{ color: pillar.color }}
                    >
                      {pillar.title}
                    </h3>
                    <p className="text-untamed-white-muted text-base leading-relaxed">
                      {pillar.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            WHAT'S INSIDE — FLAVORS
            ============================================ */}
        <section className="relative py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="font-[var(--font-condensed)] text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                What&apos;s Inside
              </h2>
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                Each 12 oz can is 15% ABV and delivers two full vodka martinis&mdash;double the pour,
                double the value.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {drinks.map((drink, index) => (
                <motion.div
                  key={drink.slug}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  <Link
                    href={`/drinks/${drink.slug}`}
                    className="flex items-center gap-4 group p-4 rounded-xl border border-card-border bg-untamed-black-card
                      hover:border-opacity-60 transition-all duration-300"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = drink.color
                      e.currentTarget.style.boxShadow = `0 0 20px ${drink.colorGlow}`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = ''
                      e.currentTarget.style.boxShadow = ''
                    }}
                  >
                    <div className="relative w-10 h-20 shrink-0">
                      <Image
                        src={siteAssetAbsoluteUrl(drink.canImage)}
                        alt={drink.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <div>
                      <span
                        className="font-wild cyber-brush-fix text-xl md:text-2xl"
                        style={{ color: drink.color }}
                      >
                        {drink.name}
                      </span>
                      <p className="text-untamed-white-muted text-sm leading-relaxed">
                        {flavorDescriptions[drink.slug]}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            CLOSING DECLARATION
            ============================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute top-1/3 left-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-panther" />
            <div className="absolute bottom-1/3 right-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-lioness" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-8 text-untamed-white-muted text-lg md:text-xl leading-relaxed"
            >
              <p className="text-untamed-white text-2xl md:text-3xl font-light italic text-center">
                We are not here to fit into the future of ready-to-drink. We are here to define it.
              </p>

              <p className="text-center max-w-3xl mx-auto">
                We built a brand with a real point of view, a product line with real distinction, and a format that answers what modern consumers have been asking for all along. We are here to raise the standard and build one of the defining beverage companies of this generation.
              </p>

              <p className="text-untamed-white font-medium text-center text-xl md:text-2xl">
                $24 for a four-pack. Eight total cocktails. $3 per cocktail.
              </p>

              <p className="text-center max-w-3xl mx-auto">
                That is more than a line consumers remember. It is proof that premium can be magnetic, accessible, and impossible to ignore. And that is exactly how categories change.
              </p>
            </motion.div>

            {/* Founders sign-off */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-16 pt-16 border-t border-card-border"
            >
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed text-center mb-8">
                From our cul-de-sac to your glass&mdash;thank you for being part of the <span className="font-headline text-untamed-white">Untamed</span> story.
              </p>
              <div className="text-center">
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
