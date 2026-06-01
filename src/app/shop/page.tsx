'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { AddToCartButton } from '@/components/AddToCartButton'
import { ProductGallery } from '@/components/ProductGallery'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h1 className="font-condensed text-4xl sm:text-5xl lg:text-6xl font-bold text-white uppercase mb-4">
              Shop <span className="font-headline text-gradient-wild">Untamed</span>
            </h1>
            <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto mb-2">
              Martinis with an attitude. Mix and match your favorites — add any combination to your cart from right here.
            </p>
            <p className="text-untamed-white-muted/60 text-sm">
              $24 per pack &bull; 4 cans &bull; 8 cocktails &bull; Ships direct
            </p>
          </motion.div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {drinks.map((drink, index) => (
              <motion.div
                key={drink.slug}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative rounded-2xl overflow-hidden border border-card-border bg-untamed-black-card transition-all duration-500"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = drink.color
                  e.currentTarget.style.boxShadow = `0 0 30px ${drink.colorGlow}`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = ''
                  e.currentTarget.style.boxShadow = ''
                }}
              >
                {/* Scratch bg */}
                <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity duration-500">
                  <Image
                    src={siteAssetAbsoluteUrl(drink.scratchBackground)}
                    alt=""
                    fill
                    className="object-cover"
                    aria-hidden="true"
                    unoptimized
                  />
                </div>

                {/* Content */}
                <div className="relative z-10 p-6 md:p-8 flex flex-col items-center text-center">
                  {/* Can image — links to product page */}
                  <Link href={`/drinks/${drink.slug}`} className="block mb-5">
                    <div className="relative w-20 h-44 md:w-24 md:h-52 group-hover:scale-105 transition-transform duration-500">
                      <Image
                        src={siteAssetAbsoluteUrl(drink.canImage)}
                        alt={`${drink.name} — ${drink.flavor}`}
                        fill
                        className="object-contain drop-shadow-2xl"
                        unoptimized
                      />
                    </div>
                  </Link>

                  {/* Info */}
                  <Link href={`/drinks/${drink.slug}`}>
                    <h2
                      className="font-wild cyber-brush-fix text-3xl md:text-4xl tracking-wider mb-1 hover:opacity-80 transition-opacity"
                      style={{ color: drink.color }}
                    >
                      {drink.name}
                    </h2>
                  </Link>
                  <p className="text-untamed-white font-medium text-base mb-1">{drink.flavor}</p>
                  <p className="text-untamed-white-muted text-sm mb-1">{drink.subtitle}</p>
                  <p className="text-untamed-white font-bold text-lg mb-4">$24.00 <span className="text-untamed-white-muted text-sm font-normal">/ Pack</span></p>

                  {/* Add to Cart */}
                  <div className="w-full">
                    <AddToCartButton
                      listingId={drink.bevCartListingId}
                      variantId={drink.bevCartVariantId}
                    />
                  </div>

                  <p className="text-untamed-white-muted/50 text-xs mt-3">
                    4 cans &bull; 2 martinis each &bull; 15% ABV
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ============================================
              DETAILED SYNOPSIS SECTIONS
              ============================================ */}
          <div className="mt-20 space-y-16">
            {drinks.map((drink, index) => (
              <motion.div
                key={`synopsis-${drink.slug}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl border border-card-border bg-untamed-black-card overflow-hidden"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                  {/* Left: Product Gallery */}
                  <div className="p-6 md:p-10">
                    <ProductGallery drink={drink} />
                  </div>

                  {/* Right: Synopsis + actions */}
                  <div className="p-8 md:p-12 flex flex-col justify-center">
                    <h3
                      className="font-wild cyber-brush-fix text-4xl md:text-5xl tracking-wider mb-2"
                      style={{ color: drink.color }}
                    >
                      {drink.name}
                    </h3>
                    <p className="text-untamed-white text-xl font-medium mb-1">{drink.flavor}</p>
                    <p className="text-untamed-white-muted text-sm mb-4">{drink.subtitle} &bull; {drink.abv} ALC/VOL &bull; {drink.size.split(' /')[0]}</p>

                    <p className="text-untamed-white-muted text-base leading-relaxed mb-6">
                      {drink.story}
                    </p>

                    <p className="text-untamed-white font-bold text-xl mb-5">
                      $24.00 <span className="text-untamed-white-muted text-sm font-normal">/ Pack of 4</span>
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="w-full sm:w-auto">
                        <AddToCartButton
                          listingId={drink.bevCartListingId}
                          variantId={drink.bevCartVariantId}
                        />
                      </div>
                      <Link
                        href={`/drinks/${drink.slug}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-medium transition-all duration-300 hover:bg-opacity-10"
                        style={{
                          borderColor: `${drink.color}40`,
                          color: drink.color,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${drink.color}15`
                          e.currentTarget.style.borderColor = drink.color
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = ''
                          e.currentTarget.style.borderColor = `${drink.color}40`
                        }}
                      >
                        See Full Drink Page &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom helper text */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mt-16"
          >
            <p className="text-untamed-white-muted text-sm">
              Add multiple flavors to build your own mix. Adjust quantities in the cart sidebar.
            </p>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
