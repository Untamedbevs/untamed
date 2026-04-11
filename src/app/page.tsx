'use client'

// Untamed Beverages
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDown, Instagram, Mail, Sparkles } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { ContactModal } from '@/components/ContactModal'
import { DrinkCard } from '@/components/DrinkCard'
import { drinks } from '@/lib/drinks'

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
                  Premium Vodka Martinis
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
                <span className="font-semibold not-italic text-gradient-wild">
                  Wild Side
                </span>
              </p>

              {/* Sub-tagline */}
              <p className="text-untamed-white-muted text-base md:text-lg tracking-wider mb-10">
                Chill it. Shake it.{' '}
                <span className="text-untamed-white font-medium">Unleash it!</span>
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="#drinks"
                  className="px-8 py-3 bg-untamed-white text-untamed-black font-semibold text-base rounded-full
                    hover:bg-panther-light hover:text-white transition-all duration-300
                    hover:shadow-[0_0_30px_rgba(155,48,255,0.4)] active:scale-95"
                >
                  Explore Our Drinks
                </a>
                <a
                  href="https://instagram.com/untamedbevs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 border border-untamed-white-muted/30 text-untamed-white-muted font-medium text-base rounded-full
                    hover:border-untamed-white hover:text-untamed-white transition-all duration-300 active:scale-95
                    inline-flex items-center gap-2"
                >
                  <Instagram className="w-4 h-4" />
                  @untamedbevs
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
              <h2 className="font-[var(--font-oswald)] text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-6">
                Live Life{' '}
                <span className="text-gradient-wild">Untamed</span>
              </h2>
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                &ldquo;Live Life Untamed&rdquo; means embracing freedom, authenticity, and courage. It&apos;s about rejecting limitations&mdash;whether they come from society, fear, or self-doubt&mdash;and living boldly on your own terms.
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
              <h2 className="font-[var(--font-oswald)] text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                Our Drinks
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                Four premium vodka martinis. Four wild spirits. Each can holds{' '}
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
            THE STORY SECTION
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
              <h2 className="font-[var(--font-oswald)] text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-8">
                Born to Be{' '}
                <span className="text-gradient-lioness">Wild</span>
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
                Every one of us has a wild side &mdash; an untamed spirit that refuses to be boxed in.
                At Untamed Beverages, we crafted four premium vodka martinis, each inspired by the world&apos;s most
                powerful big cats.
              </p>
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed">
                These aren&apos;t just cocktails. They&apos;re an identity. The{' '}
                <span className="text-panther font-medium">mystery of the Black Panther</span>, the{' '}
                <span className="text-cheetah font-medium">speed of the Cheetah</span>, the{' '}
                <span className="text-cougar font-medium">quiet power of the Cougar</span>, and the{' '}
                <span className="text-lioness font-medium">fierce loyalty of the Lioness</span>.
              </p>
              <p className="text-untamed-white text-xl md:text-2xl font-light italic mt-8">
                &ldquo;Chill it. Shake it. Unleash it!&rdquo;
              </p>
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
              <h2 className="font-[var(--font-oswald)] text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white">
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
                  <Link
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
                        src={drink.animalImage}
                        alt={drink.animal}
                        fill
                        className="object-contain object-bottom group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-[var(--font-oswald)] text-xl md:text-2xl font-bold uppercase tracking-wider mb-2"
                        style={{ color: drink.color }}
                      >
                        {drink.personalityQuestion}
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
                        src={drink.scratchBackground}
                        alt=""
                        fill
                        className="object-cover"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

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
              <h2 className="font-[var(--font-oswald)] text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-6">
                Unleash Your{' '}
                <span className="text-gradient-wild">Wild Side</span>
              </h2>
              <p className="text-untamed-white-muted text-lg md:text-xl mb-10 max-w-xl mx-auto">
                Follow us on Instagram to stay updated on where to find Untamed near you.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <a
                  href="https://instagram.com/untamedbevs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-untamed-white text-untamed-black font-semibold text-base rounded-full
                    hover:bg-panther-light hover:text-white transition-all duration-300
                    hover:shadow-[0_0_30px_rgba(155,48,255,0.4)] active:scale-95
                    inline-flex items-center gap-2"
                >
                  <Instagram className="w-5 h-5" />
                  Follow @untamedbevs
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
                  <p className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold text-untamed-white">4</p>
                  <p className="text-untamed-white-muted text-xs tracking-wider uppercase">Flavors</p>
                </div>
                <div>
                  <p className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold text-untamed-white">15%</p>
                  <p className="text-untamed-white-muted text-xs tracking-wider uppercase">ALC/VOL</p>
                </div>
                <div>
                  <p className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold text-untamed-white">2</p>
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
