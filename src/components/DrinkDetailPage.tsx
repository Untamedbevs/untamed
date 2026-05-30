'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Droplets, Martini, Flame } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { AddToCartButton } from '@/components/AddToCartButton'
import { ProductGallery } from '@/components/ProductGallery'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

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
              src={siteAssetAbsoluteUrl(drink.scratchBackground)}
              alt=""
              fill
              className="object-cover opacity-40"
              priority
              aria-hidden="true"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-b from-untamed-black/80 via-untamed-black/60 to-untamed-black" />
            <div className="absolute inset-0 bg-gradient-to-r from-untamed-black/70 to-transparent" />
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 md:pt-32 md:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
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
                  className="font-wild cyber-brush-fix text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-wider leading-none mb-3"
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
                    <Martini className="w-4 h-4" />
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

                {/* Add to Cart */}
                <div className="mt-8">
                  <p className="text-untamed-white text-2xl md:text-3xl font-bold mb-4">
                    $24.00 <span className="text-untamed-white-muted text-base font-normal">/ Pack</span>
                  </p>
                  <AddToCartButton
                    listingId={drink.bevCartListingId}
                    variantId={drink.bevCartVariantId}
                  />
                  <p className="text-untamed-white-muted text-sm mt-3">
                    2 martinis per can &bull; $3 per cocktail &bull; 4 cans per pack &bull; Ships direct
                  </p>
                  <p className="text-untamed-white-muted/60 text-xs mt-2">
                    Click the button to add to cart, then adjust quantity in cart.
                  </p>
                </div>
              </motion.div>

              {/* Right: Product Gallery */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                <ProductGallery drink={drink} />
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
                    src={siteAssetAbsoluteUrl(drink.animalImage)}
                    alt={drink.animal}
                    fill
                    className="object-contain"
                    unoptimized
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
                  className="text-2xl md:text-3xl lg:text-4xl font-bold uppercase tracking-wider mb-6"
                  style={{ color: drink.color }}
                >
                  Are You a <span className="font-wild cyber-brush-fix">{drink.name}</span>?
                </h2>
                <p className="text-untamed-white-muted text-base md:text-lg leading-relaxed mb-8">
                  {drink.personality}
                </p>
                <p className="text-untamed-white text-xl md:text-2xl font-light italic">
                  &ldquo;Chill it. Shake it. <span className="font-wild cyber-brush-fix not-italic text-2xl md:text-3xl">Unleash it!</span>&rdquo;
                </p>
              </motion.div>
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
            <div
              className="absolute top-1/2 left-0 w-72 h-72 rounded-full blur-[150px] opacity-10"
              style={{ backgroundColor: drink.color }}
            />
            <div
              className="absolute top-1/2 right-0 w-72 h-72 rounded-full blur-[150px] opacity-10"
              style={{ backgroundColor: drink.color }}
            />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p
                className="text-sm tracking-[0.3em] uppercase mb-3"
                style={{ color: drink.color }}
              >
                Our Story
              </p>
              <h2 className="font-condensed text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white mb-8">
                Born to Be{' '}
                <span className={`text-gradient-${drink.cssVar}`}>Wild</span>
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
                {drink.story}
              </p>
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed">
                Every one of us has a wild side &mdash; an untamed spirit that refuses to be boxed in.
                At <span className="font-headline text-2xl">Untamed</span> Beverages, we crafted four martinis with an attitude, each inspired by the world&apos;s most
                powerful big cats. The{' '}
                <span style={{ color: drink.color }} className="font-wild cyber-brush-fix text-2xl md:text-3xl">{drink.name}</span>{' '}
                is yours.
              </p>
              <p className="text-untamed-white text-xl md:text-2xl font-light italic mt-8">
                &ldquo;Chill it. Shake it. <span className="font-wild cyber-brush-fix not-italic text-2xl md:text-3xl">Unleash it!</span>&rdquo;
              </p>
            </motion.div>
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
              className="text-center"
            >
              <h2 className="font-condensed text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                What&apos;s Inside
              </h2>
              <p className="text-untamed-white-muted text-lg md:text-xl leading-relaxed">
                {drink.whatsInside}
              </p>
            </motion.div>

            {/* ABV Warning */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-10 flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-3" style={{ color: drink.color }}>
                <Martini className="w-10 h-10 md:w-12 md:h-12" />
                <Martini className="w-10 h-10 md:w-12 md:h-12" />
              </div>
              <p
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border text-sm"
                style={{ borderColor: `${drink.color}30`, color: drink.color }}
              >
                Contains the equivalent of (2) 6 oz vodka martinis in a single 12 fl oz can.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            THE VALUE CONTAINER
            ============================================ */}
        <section className="relative py-20 md:py-28">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white mb-10">
                The <span style={{ color: drink.color }}>Value</span>
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="rounded-2xl border p-8 md:p-10"
              style={{ borderColor: `${drink.color}30` }}
            >
              <p className="font-[var(--font-oswald)] text-6xl md:text-7xl font-bold text-untamed-white mb-2">$24</p>
              <p className="text-untamed-white-muted text-lg mb-8">for a four-pack</p>

              <div className="flex justify-center gap-12 mb-8">
                <div>
                  <p className="font-[var(--font-oswald)] text-4xl md:text-5xl font-bold" style={{ color: drink.color }}>8</p>
                  <p className="text-untamed-white-muted text-sm mt-1">Cocktails</p>
                </div>
                <div>
                  <p className="font-[var(--font-oswald)] text-4xl md:text-5xl font-bold" style={{ color: drink.color }}>$3</p>
                  <p className="text-untamed-white-muted text-sm mt-1">Per Cocktail</p>
                </div>
              </div>

              <p className="text-untamed-white-muted text-base max-w-lg mx-auto">
                That is not just pricing. That is premium value, stated with clarity.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            THE 1-2-3 ADVANTAGE SECTION
            ============================================ */}
        <section className="relative py-20 md:py-28">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white mb-4">
                The <span style={{ color: drink.color }}>1-2-3</span> Advantage
              </h2>
              <p className="text-untamed-white-muted text-lg mb-12 max-w-xl mx-auto">
                Martinis with an attitude — at a price that makes sense.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center"
              >
                <p className="font-[var(--font-oswald)] text-6xl md:text-7xl font-bold" style={{ color: drink.color }}>1</p>
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
                <p className="font-[var(--font-oswald)] text-6xl md:text-7xl font-bold" style={{ color: drink.color }}>2</p>
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
                <p className="font-[var(--font-oswald)] text-6xl md:text-7xl font-bold" style={{ color: drink.color }}>$3</p>
                <p className="text-untamed-white text-xl font-medium mt-2">Per Cocktail</p>
                <p className="text-untamed-white-muted text-sm">Luxury meets logic</p>
              </motion.div>
            </div>
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
              src={siteAssetAbsoluteUrl(drink.scratchBackground)}
              alt=""
              fill
              className="object-cover"
              aria-hidden="true"
              unoptimized
            />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-condensed text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white mb-12">
                The Ritual
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {[
                { step: '01', title: 'Chill It', desc: 'Best served ice cold. Refrigerate or keep on ice until ready.' },
                { step: '02', title: 'Shake It', desc: 'Give it a good shake to blend everything perfectly.' },
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
                    className="font-condensed text-5xl md:text-6xl font-bold mb-3 opacity-30"
                    style={{ color: drink.color }}
                  >
                    {item.step}
                  </p>
                  <h3
                    className={`${item.title.includes('Unleash') ? 'font-wild cyber-brush-fix text-2xl md:text-3xl' : 'font-condensed text-xl md:text-2xl font-bold uppercase'} tracking-wider mb-3`}
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
              <h2 className="font-condensed text-3xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white">
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
                  <a
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
                        src={siteAssetAbsoluteUrl(otherDrink.canImage)}
                        alt={otherDrink.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <div>
                      <h3
                        className="font-wild cyber-brush-fix text-2xl tracking-wider"
                        style={{ color: otherDrink.color }}
                      >
                        {otherDrink.name}
                      </h3>
                      <p className="text-untamed-white-muted text-sm">
                        {otherDrink.flavor}
                      </p>
                    </div>
                  </a>
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
