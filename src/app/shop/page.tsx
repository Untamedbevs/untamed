'use client'

import { motion } from 'framer-motion'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { DrinkCard } from '@/components/DrinkCard'
import { drinks } from '@/lib/drinks'

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="font-condensed text-4xl sm:text-5xl font-bold text-white uppercase mb-4">
              Shop <span className="font-wild cyber-brush-fix text-5xl sm:text-6xl text-[#FFD700]">Untamed</span>
            </h1>
            <p className="text-untamed-white-muted text-lg max-w-xl mx-auto">
              Martinis with an attitude. 1 can. 2 martinis. $3 per cocktail. 4 cans per pack. Ships direct to your door.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {drinks.map((drink, i) => (
              <DrinkCard key={drink.slug} drink={drink} index={i} />
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="text-center text-untamed-white-muted/60 text-sm mt-8"
          >
            Click a product to add to cart, then adjust quantity in the cart sidebar.
          </motion.p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
