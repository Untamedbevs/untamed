'use client'

// Untamed Beverages
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDown, Mail, Sparkles, Building2 } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { ContactModal } from '@/components/ContactModal'
import { DrinkCard } from '@/components/DrinkCard'
import { HomeCommunityStrip } from '@/components/community/HomeCommunityStrip'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

export default function HomePage() {
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <>
      <Navigation />

      <main>
        {/* ============================================
            HERO SECTION
            ============================================ */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          {/* Background layers */}
          <div className="absolute inset-0">
            {/* Dark gradient base */}
            <div className="absolute inset-0 bg-gradient-to-b from-untamed-black via-untamed-black to-untamed-black-light" />

            {/* Scratch texture overlay */}
            <div className="absolute inset-0 opacity-15">
              <Image
                src="/images/scratch-panther.png"
                alt=""
                fill
                className="object-cover"
                priority
                aria-hidden="true"
              />
            </div>

            {/* Animated glow orbs */}
            <div className="absolute top-1/3 left-1/6 w-96 h-96 rounded-full blur-[150px] opacity-20 bg-panther animate-pulse-glow" />
            <div className="absolute bottom-1/3 right-1/6 w-96 h-96 rounded-full blur-[150px] opacity-15 bg-lioness animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
            <div className="absolute top-2/3 left-1/2 w-64 h-64 rounded-full blur-[120px] opacity-10 bg-cheetah animate-pulse-glow" style={{ animationDelay: '3s' }} />
          </div>

          <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto pt-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Tagline badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-untamed-white-muted/20 bg-untamed-white/5 mb-8"
              >
                <Sparkles className="w-4 h-4 text-panther-light" />
                <span className="text-untamed-white-muted text-sm tracking-[0.2em] uppercase">
                  Martinis With an <span className="font-wild cyber-brush-fix text-gradient-wild text-base">Attitude</span>
                </span>
              </motion.div>

              {/* Brand Logo */}
              <div className="flex flex-col items-center mb-6">
                <Image
                  src="/images/logo-mark.png"
                  alt="Untamed Beverages"
                  width={160}
                  height={160}
                  className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-48 lg:h-48 mb-4"
                  priority
                />
                <Image
                  src="/images/logo-text.png"
                  alt="Untamed Beverages"
                  width={500}
                  height={80}
                  className="h-10 sm:h-12 md:h-16 lg:h-20 w-auto"
                  priority
                />
              </div>

              {/* Tagline */}
              <p className="text-2xl md:text-3xl lg:text-4xl font-light text-untamed-white mb-4 italic">
                Get In Touch With Your{' '}
                <span className="font-wild cyber-brush-fix not-italic text-gradient-wild text-3xl md:text-4xl lg:text-5xl">
                  Wild Side
                </span>
              </p>

              {/* Sub-tagline */}
              <p className="text-untamed-white-muted text-base md:text-lg tracking-wider mb-10">
                Chill it. Shake it.{' '}
                <span className="font-wild cyber-brush-fix text-untamed-white text-xl md:text-2xl">Unleash it!</span>
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="#drinks"
                  className="px-8 py-3 bg-untamed-white text-untamed-black font-semibold text-base rounded-full
                    hover:bg-panther-light hover:text-white transition-all duration-300
                    hover:shadow-[0_0_30px_rgba(155,48,255,0.4)] active:scale-95"
                >
                  Shop Now
                </a>
                <a
                  href="/retail"
                  className="px-8 py-3 border border-[#FF8C2A50] text-[#FF8C2A] font-medium text-base rounded-full
                    hover:border-[#FF8C2A] hover:bg-[#FF8C2A10] transition-all duration-300 active:scale-95
                    inline-flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  Carry <span className="font-headline">Untamed</span>
                </a>
              </div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-16 md:mt-24"
            >
              <a href="#drinks" className="inline-flex flex-col items-center gap-2 text-untamed-white-muted/40 hover:text-untamed-white-muted transition-colors duration-300">
                <span className="text-xs tracking-[0.3em] uppercase">Scroll</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </a>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            LIVE LIFE UNTAMED SECTION
            ============================================ */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          {/* Background accents */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute top-1/4 left-0 w-96 h-96 rounded-full blur-[180px] opacity-10 bg-panther" />
            <div className="absolute bottom-1/4 right-0 w-96 h-96 rounded-full blur-[180px] opacity-10 bg-lioness" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <p className="text-panther-light text-sm tracking-[0.3em] uppercase mb-3">
                The Untamed Way
              </p>
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-6">
                Live Life{' '}
                <span className="font-headline text-gradient-wild">Untamed</span>
              </h2>
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                &ldquo;Live Life <span className="font-headline">Untamed</span>&rdquo; means embracing freedom, authenticity, and courage. It&apos;s about rejecting limitations&mdash;whether they come from society, fear, or self-doubt&mdash;and living boldly on your own terms.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-12"
            >
              <p className="text-untamed-white-muted text-base md:text-lg leading-relaxed text-center mb-10">
                To Live Life Untamed is to let go of what holds you back and fully experience all that life offers.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { text: 'Being fearless in pursuing your dreams', dot: 'var(--panther-light)' },
                  { text: 'Staying true to you, even when it\'s not easy', dot: 'var(--cheetah)' },
                  { text: 'Saying yes to adventure and growth', dot: 'var(--cougar-light)' },
                  { text: 'Refusing to conform to others\' expectations', dot: 'var(--lioness-light)' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 + idx * 0.08 }}
                    className="flex items-center gap-3 px-5 py-4 rounded-xl border border-card-border bg-untamed-black-card hover:border-panther-light/30 transition-colors duration-300"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.dot }} />
                    <span className="text-untamed-white text-sm md:text-base font-medium">
                      {item.text}
                    </span>
                  </motion.div>
                ))}
              </div>
              <p className="text-untamed-white-muted text-base md:text-lg leading-relaxed text-center mt-10">
                It&apos;s a mindset&mdash;one that values passion over comfort, authenticity over approval, and soul over routine.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative text-center px-6 py-8 rounded-2xl border border-panther-light/20 overflow-hidden"
            >
              {/* Cheetah scratch background - only behind this quote */}
              <div className="absolute inset-0">
                <Image
                  src="/images/scratch-cheetah.png"
                  alt=""
                  fill
                  className="object-cover opacity-40"
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-untamed-black/80 via-untamed-black/60 to-untamed-black" />
                <div className="absolute inset-0 bg-gradient-to-r from-untamed-black/70 to-transparent" />
              </div>
              <p className="relative z-10 text-untamed-white text-xl md:text-2xl font-light leading-relaxed italic max-w-3xl mx-auto">
                &ldquo;Live Life Untamed&rdquo; means choosing freedom over fear, passion over predictability, and authenticity over acceptance. It&apos;s about running wild in your truth&mdash;unapologetic, alive, and unstoppable.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            THE DRINKS SECTION
            ============================================ */}
        <section id="drinks" className="relative py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-panther-light text-sm tracking-[0.3em] uppercase mb-3">
                The Collection
              </p>
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                Our Drinks
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                Four martinis with an attitude. Four wild spirits. Each can holds{' '}
                <span className="text-untamed-white font-medium">2 full martinis</span> at{' '}
                <span className="text-untamed-white font-medium">15% ALC/VOL</span>.
              </p>
            </motion.div>

            {/* Drink Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {drinks.map((drink, index) => (
                <DrinkCard key={drink.slug} drink={drink} index={index} />
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            THE 1-2-3 ADVANTAGE SECTION
            ============================================ */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-panther-light text-sm tracking-[0.3em] uppercase mb-3">
                The Value
              </p>
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                The <span className="text-gradient-wild">1-2-3</span> Advantage
              </h2>
              <p className="text-untamed-white-muted text-lg mb-12 max-w-xl mx-auto">
                Martinis with an attitude — at a price that makes sense.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0 }}
                className="flex flex-col items-center"
              >
                <p className="font-condensed text-6xl md:text-7xl font-bold text-panther-light">1</p>
                <p className="text-untamed-white text-xl font-medium mt-2">Can</p>
                <p className="text-untamed-white-muted text-sm">12 oz &bull; 15% ABV</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex flex-col items-center"
              >
                <p className="font-condensed text-6xl md:text-7xl font-bold text-cheetah">2</p>
                <p className="text-untamed-white text-xl font-medium mt-2">Martinis</p>
                <p className="text-untamed-white-muted text-sm">Full 6 oz pours</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col items-center"
              >
                <p className="font-condensed text-6xl md:text-7xl font-bold text-lioness">$3</p>
                <p className="text-untamed-white text-xl font-medium mt-2">Per Cocktail</p>
                <p className="text-untamed-white-muted text-sm">Luxury meets logic</p>
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-untamed-white-muted text-base max-w-2xl mx-auto"
            >
              Luxury meets logic. At just $0.50/oz, <span className="font-headline">Untamed</span> outperforms the market average by 45% on every pour.
              While others compromise on scale or strength, we lead the industry in delivering maximum impact and exceptional value in a single, superior package.
            </motion.p>
          </div>
        </section>

        {/* ============================================
            OUR STORY TEASER
            ============================================ */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          {/* Background accents */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute top-1/2 left-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-cougar" />
            <div className="absolute top-1/2 right-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-cheetah" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-lioness text-sm tracking-[0.3em] uppercase mb-3">
                Our Story
              </p>
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-8">
                From a Fire Pit{' '}
                <span className="text-gradient-lioness">to Your Glass</span>
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed">
                It started with three couples sharing cocktails around a backyard fire pit.
                Carol, affectionately known as &ldquo;<span className="text-lioness font-medium font-wild cyber-brush-fix text-2xl">The Lioness</span>,&rdquo;
                sparked a simple question: What if a martini could come ready to drink, taste premium, and feel empowering?
              </p>
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed">
                That night, after plenty of laughs and drinks, the name came:{' '}
                <span className="font-headline text-2xl md:text-3xl text-untamed-white">Untamed Beverages</span>.
                Inspired by the world&apos;s biggest cats, we built a brand around confidence&mdash;and every can
                delivers a martini moment as fierce as its namesake.
              </p>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-full border border-lioness/40
                  text-lioness font-medium uppercase tracking-wider text-sm
                  hover:bg-lioness/10 hover:border-lioness/60 transition-all duration-300"
              >
                Read Our Full Story
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            WHICH CAT ARE YOU? SECTION
            ============================================ */}
        <section className="relative py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-cougar text-sm tracking-[0.3em] uppercase mb-3">
                Spirit Animals
              </p>
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white">
                Which Cat Are You?
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {drinks.map((drink, index) => (
                <motion.div
                  key={drink.slug}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <a
                    href={`/drinks/${drink.slug}`}
                    className="group relative flex gap-5 md:gap-6 p-5 md:p-6 rounded-2xl border border-card-border
                      bg-untamed-black-card overflow-hidden transition-all duration-500 hover:border-opacity-60"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = drink.color
                      e.currentTarget.style.boxShadow = `0 0 30px ${drink.colorGlow}`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = ''
                      e.currentTarget.style.boxShadow = ''
                    }}
                  >
                    {/* Animal Image */}
                    <div className="relative w-20 h-28 md:w-24 md:h-32 shrink-0">
                      <Image
                        src={siteAssetAbsoluteUrl(drink.animalImage)}
                        alt={drink.animal}
                        fill
                        className="object-contain object-bottom group-hover:scale-110 transition-transform duration-500"
                        unoptimized
                      />
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-xl md:text-2xl font-bold uppercase tracking-wider mb-2"
                        style={{ color: drink.color }}
                      >
                        Are You a <span className="font-wild cyber-brush-fix text-2xl md:text-3xl">{drink.name}</span>?
                      </h3>
                      <p className="text-untamed-white-muted text-sm md:text-base leading-relaxed line-clamp-3">
                        {drink.personality}
                      </p>
                      <p
                        className="text-sm font-medium tracking-wider uppercase mt-3
                          group-hover:translate-x-1 transition-transform duration-300 inline-flex items-center gap-1"
                        style={{ color: drink.color }}
                      >
                        Discover &rarr;
                      </p>
                    </div>

                    {/* Subtle scratch overlay */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
                      <Image
                        src={siteAssetAbsoluteUrl(drink.scratchBackground)}
                        alt=""
                        fill
                        className="object-cover"
                        aria-hidden="true"
                        unoptimized
                      />
                    </div>
                  </a>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            WHY BUY DIRECT SECTION
            ============================================ */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <div className="absolute top-1/3 right-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-panther" />
            <div className="absolute bottom-1/3 left-0 w-72 h-72 rounded-full blur-[150px] opacity-10 bg-lioness" />
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
                Direct to You
              </p>
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                Why Buy <span className="text-gradient-lioness">Direct</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                Skip the search. Get the full lineup delivered to your door.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Convenience',
                  desc: 'Stock the fridge for weekends, hosting, and last-minute plans without a store run.',
                },
                {
                  title: 'Full Lineup Access',
                  desc: 'All four wild spirits, always in stock. Explore, compare, and find your favorite.',
                },
                {
                  title: 'Smart Bundles',
                  desc: 'Curated packs for hosting, gifting, and discovering — buy with confidence.',
                },
                {
                  title: 'Gifting Made Easy',
                  desc: 'Send premium cocktails for birthdays, celebrations, and "new chapter" moments.',
                },
                {
                  title: 'Earn Rewards',
                  desc: 'Join the loyalty program. Every purchase earns points toward exclusive merch and packs.',
                },
                {
                  title: 'Limited Drops',
                  desc: 'First access to seasonal releases and limited-time bundles — before they sell out.',
                },
              ].map((item, idx) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="p-6 rounded-2xl border border-card-border bg-untamed-black-card hover:border-lioness/30 transition-colors duration-300"
                >
                  <h3 className="text-untamed-white font-bold text-base mb-2">{item.title}</h3>
                  <p className="text-untamed-white-muted text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            COMMUNITY STRIP (renders only when content exists)
            ============================================ */}
        <HomeCommunityStrip />

        {/* ============================================
            CTA / FIND US SECTION
            ============================================ */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-panther-dark/30 via-untamed-black to-lioness-dark/20" />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-panther/30 to-transparent" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-6">
                <span className="font-wild cyber-brush-fix">Unleash</span> Your{' '}
                <span className="font-wild cyber-brush-fix text-gradient-wild">Wild Side</span>
              </h2>
              <p className="text-untamed-white-muted text-lg md:text-xl mb-10 max-w-xl mx-auto">
                Order direct, join the rewards program, or carry <span className="font-headline">Untamed</span> in your business.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <a
                  href="#drinks"
                  className="px-8 py-3 bg-untamed-white text-untamed-black font-semibold text-base rounded-full
                    hover:bg-panther-light hover:text-white transition-all duration-300
                    hover:shadow-[0_0_30px_rgba(155,48,255,0.4)] active:scale-95
                    inline-flex items-center gap-2"
                >
                  Shop Now
                </a>
                <a
                  href="/retail"
                  className="px-8 py-3 border border-[#FF8C2A50] text-[#FF8C2A] font-medium text-base rounded-full
                    hover:border-[#FF8C2A] hover:bg-[#FF8C2A10] transition-all duration-300 active:scale-95
                    inline-flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  Carry <span className="font-headline">Untamed</span>
                </a>
                <button
                  onClick={() => setContactOpen(true)}
                  className="px-8 py-3 border border-untamed-white-muted/30 text-untamed-white-muted font-medium text-base rounded-full
                    hover:border-untamed-white hover:text-untamed-white transition-all duration-300 active:scale-95
                    inline-flex items-center gap-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  Contact Us
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
                <div>
                  <p className="font-condensed text-3xl md:text-4xl font-bold text-untamed-white">4</p>
                  <p className="text-untamed-white-muted text-xs tracking-wider uppercase">Flavors</p>
                </div>
                <div>
                  <p className="font-condensed text-3xl md:text-4xl font-bold text-untamed-white">15%</p>
                  <p className="text-untamed-white-muted text-xs tracking-wider uppercase">ALC/VOL</p>
                </div>
                <div>
                  <p className="font-condensed text-3xl md:text-4xl font-bold text-untamed-white">2</p>
                  <p className="text-untamed-white-muted text-xs tracking-wider uppercase">Martinis/Can</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  )
}
