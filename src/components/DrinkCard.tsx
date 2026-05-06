'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { AddToCartButton } from '@/components/AddToCartButton'

interface DrinkCardProps {
  drink: Drink
  index: number
}

export function DrinkCard({ drink, index }: DrinkCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.15 }}
      className="h-full"
    >
      <a
        href={`/drinks/${drink.slug}`}
        className="group block relative rounded-2xl overflow-hidden border border-card-border
          bg-untamed-black-card transition-all duration-500
          hover:border-opacity-60 hover:scale-[1.02] hover:-translate-y-1 h-full"
        style={{
          '--hover-color': drink.color,
          '--hover-glow': drink.colorGlow,
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = drink.color
          e.currentTarget.style.boxShadow = `0 0 40px ${drink.colorGlow}, 0 20px 60px rgba(0,0,0,0.5)`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = ''
          e.currentTarget.style.boxShadow = ''
        }}
      >
        {/* Scratch Background */}
        <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-500">
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
          {/* Can Image */}
          <div className="relative w-24 h-48 md:w-28 md:h-56 mb-6 group-hover:scale-105 transition-transform duration-500">
            <Image
              src={siteAssetAbsoluteUrl(drink.canImage)}
              alt={`${drink.name} ${drink.flavor}`}
              fill
              className="object-contain drop-shadow-2xl"
              unoptimized
            />
          </div>

          {/* Drink Info */}
          <h3
            className="font-wild cyber-brush-fix text-3xl md:text-4xl tracking-wider mb-1"
            style={{ color: drink.color }}
          >
            {drink.name}
          </h3>
          <p className="text-untamed-white font-medium text-base mb-1">
            {drink.flavor}
          </p>
          <p className="text-untamed-white-muted text-sm mb-4">
            {drink.subtitle}
          </p>

          {/* CTA */}
          <div className="flex items-center gap-3 mt-auto">
            <div
              className="flex items-center gap-2 text-sm font-medium tracking-wider uppercase
                group-hover:gap-3 transition-all duration-300"
              style={{ color: drink.color }}
            >
              Explore
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </div>

          {/* Add to Cart */}
          <div className="mt-4">
            <AddToCartButton
              listingId={drink.bevCartListingId}
              variantId={drink.bevCartVariantId}
              compact
            />
          </div>
        </div>
      </a>
    </motion.div>
  )
}
