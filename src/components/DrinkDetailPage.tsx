'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Droplets, Wine, Flame } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { drinks } from '@/lib/drinks'

interface DrinkDetailPageProps {
  drink: Drink
}

export function DrinkDetailPage({ drink }: DrinkDetailPageProps) {
  const otherDrinks = drinks.filter((d) => d.slug !== drink.slug)

  return (
    <>
      <Navigation />

      <main>
        {/* ============================================
            HERO SECTION
            ============================================ */}
        <section className="relative min-h-screen flex items-center overflow-hidden">
          {/* Full-bleed scratch background */}
          <div className="absolute inset-0">
            <Image
              src={drink.scratchBackground}
              alt=""
              fill
              className="object-cover opacity-40"
              priority
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-untamed-black/80 via-untamed-black/60 to-untamed-black" />
            <div className="absolute inset-0 bg-gradient-to-r from-untamed-black/70 to-transparent" />
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 md:pt-32 md:pb-20">
            {/* Back link */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link
                href="/#drinks"
                className="inline-flex items-center gap-2 text-untamed-white-muted hover:text-untamed-white transition-colors duration-300 mb-8 md:mb-12 text-sm tracking-wider uppercase"
              >
                <ArrowLeft className="w-4 h-4" />
                All Drinks
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Text Content */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                <p
                  className="text-sm tracking-[0.3em] uppercase mb-3 font-medium"
                  style={{ color: drink.color }}
                >
                  {drink.servings} &bull; {drink.abv} ALC/VOL
                </p>

                <h1
                  className="font-[var(--font-oswald)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold uppercase tracking-wider leading-none mb-3"
                  style={{ color: drink.color }}
                >
                  {drink.name}
                </h1>

                <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-untamed-white mb-2">
                  {drink.flavor}
                </h2>

                <p className="text-untamed-white-muted text-lg mb-8">
                  {drink.subtitle}
                </p>

                <p className="text-untamed-white-muted text-base md:text-lg leading-relaxed italic max-w-xl mb-8">
                  &ldquo;{drink.tagline}&rdquo;
                </p>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4 mb-8">
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${drink.color}40`, color: drink.color }}
                  >
                    <Wine className="w-4 h-4" />
                    {drink.abv} ALC/VOL
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${drink.color}40`, color: drink.color }}
                  >
                    <Droplets className="w-4 h-4" />
                    {drink.size}
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
                    style={{ borderColor: `${drink.color}40`, color: drink.color }}
                  >
                    <Flame className="w-4 h-4" />
                    2 Martinis Per Can
                  </div>
                </div>
              </motion.div>

              {/* Right: Can + Animal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="relative flex items-center justify-center"
              >
                {/* Glow behind can */}
                <div
                  className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full blur-[100px] opacity-30"
                  style={{ backgroundColor: drink.color }}
                />

                {/* Animal behind */}
                <div className="absolute -bottom-8 -right-4 md:-right-8 w-40 h-56 md:w-56 md:h-72 opacity-30">
                  <Image
                    src={drink.animalImage}
                    alt={drink.animal}
                    fill
                    className="object-contain object-bottom"
                  />
                </div>

                {/* Can render */}
                <div className="relative w-48 h-[380px] md:w-56 md:h-[440px] lg:w-64 lg:h-[500px] animate-float">
                  <Image
                    src={drink.canImage}
                    alt={`${drink.name} ${drink.flavor} Can`}
                    fill
                    className="object-contain drop-shadow-[0_0_40px_rgba(0,0,0,0.5)]"
                    priority
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            PERSONALITY / SPIRIT ANIMAL SECTION
            ============================================ */}
        <section className="relative py-20 md:py-28">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-center">
              {/* Animal Illustration */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="lg:col-span-2 flex justify-center"
              >
                <div className="relative w-48 h-64 md:w-64 md:h-80">
                  <Image
                    src={drink.animalImage}
                    alt={drink.animal}
                    fill
                    className="object-contain"
                  />
                </div>
              </motion.div>

              {/* Personality Text */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="lg:col-span-3"
              >
                <h2
                  className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider mb-6"
                  style={{ color: drink.color }}
                >
                  {drink.personalityQuestion}
                </h2>
                <p className="text-untamed-white-muted text-base md:text-lg leading-relaxed mb-8">
                  {drink.personality}
                </p>
                <p className="text-untamed-white text-xl md:text-2xl font-light italic">
                  &ldquo;Chill it. Shake it. Unleash it!&rdquo;
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            INGREDIENTS SECTION
            ============================================ */}
        <section className="relative py-20 md:py-28">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                What&apos;s Inside
              </h2>
              <p className="text-untamed-white-muted text-lg">
                Premium ingredients, expertly crafted.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {drink.ingredients.map((ingredient, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-5 py-4 rounded-xl border border-card-border bg-untamed-black-card"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: drink.color }}
                  />
                  <span className="text-untamed-white text-sm md:text-base">
                    {ingredient}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* ABV Warning */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8 text-center"
            >
              <p
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border text-sm"
                style={{ borderColor: `${drink.color}30`, color: drink.color }}
              >
                <Wine className="w-4 h-4" />
                Contains the equivalent of (2) 6 oz vodka martinis in a single 12 fl oz can.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            THE RITUAL SECTION
            ============================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          {/* Subtle scratch background */}
          <div className="absolute inset-0 opacity-5">
            <Image
              src={drink.scratchBackground}
              alt=""
              fill
              className="object-cover"
              aria-hidden="true"
            />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-12">
                The Ritual
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {[
                { step: '01', title: 'Chill It', desc: 'Best served ice cold. Refrigerate or keep on ice until ready.' },
                { step: '02', title: 'Shake It', desc: 'Give it a good shake to blend the premium ingredients perfectly.' },
                { step: '03', title: 'Unleash It!', desc: 'Crack it open and pour into your favorite glass, or drink straight from the can.' },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.15 }}
                  className="text-center"
                >
                  <p
                    className="font-[var(--font-oswald)] text-5xl md:text-6xl font-bold mb-3 opacity-30"
                    style={{ color: drink.color }}
                  >
                    {item.step}
                  </p>
                  <h3
                    className="font-[var(--font-oswald)] text-xl md:text-2xl font-bold uppercase tracking-wider mb-3"
                    style={{ color: drink.color }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-untamed-white-muted text-sm md:text-base">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            OTHER DRINKS SECTION
            ============================================ */}
        <section className="relative py-20 md:py-28">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white">
                Explore More
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {otherDrinks.map((otherDrink) => (
                <motion.div
                  key={otherDrink.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <Link
                    href={`/drinks/${otherDrink.slug}`}
                    className="group flex items-center gap-4 p-4 rounded-xl border border-card-border bg-untamed-black-card
                      transition-all duration-500"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = otherDrink.color
                      e.currentTarget.style.boxShadow = `0 0 20px ${otherDrink.colorGlow}`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = ''
                      e.currentTarget.style.boxShadow = ''
                    }}
                  >
                    <div className="relative w-12 h-24 shrink-0">
                      <Image
                        src={otherDrink.canImage}
                        alt={otherDrink.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <h3
                        className="font-[var(--font-oswald)] text-lg font-bold uppercase tracking-wider"
                        style={{ color: otherDrink.color }}
                      >
                        {otherDrink.name}
                      </h3>
                      <p className="text-untamed-white-muted text-sm">
                        {otherDrink.flavor}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
