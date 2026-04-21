'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  Building2, TrendingUp, Sparkles, ShieldCheck,
  Package, DollarSign,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { DistributorLeadForm } from '@/components/referral/DistributorLeadForm'
import { drinks } from '@/lib/drinks'

const ORANGE = '#FF8C2A'

function DistributeContent() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const [referrerName, setReferrerName] = useState<string | null>(null)

  useEffect(() => {
    if (!ref) return
    fetch('/api/referral/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: ref, type: 'distributor' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.referrerName) setReferrerName(data.referrerName)
      })
      .catch(() => {})
  }, [ref])

  const valueProps = [
    {
      icon: DollarSign,
      title: 'Premium Margins',
      description: 'High-margin RTD cocktails in the fastest-growing spirits category.',
    },
    {
      icon: TrendingUp,
      title: 'Explosive Category',
      description: 'Ready-to-drink cocktails are the #1 growth segment in beverage alcohol.',
    },
    {
      icon: Sparkles,
      title: 'Stand-Out Branding',
      description: 'Bold, animal-powered brand identity that stops people in the aisle.',
    },
    {
      icon: ShieldCheck,
      title: 'Premium Quality',
      description: '15% ABV, real vodka, 2 martinis per can. No malt, no wine base.',
    },
    {
      icon: Package,
      title: 'Four Unique Flavors',
      description: 'Espresso, Lemon Drop, Dirty Martini, and Peach Rosemary -- something for everyone.',
    },
    {
      icon: Building2,
      title: 'Full Support',
      description: 'Marketing materials, POS displays, and launch support for your business.',
    },
  ]

  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}
            >
              <Building2 className="w-4 h-4" />
              Distributor Inquiry
            </div>

            <h1 className="font-oswald text-4xl sm:text-6xl font-bold text-white uppercase mb-4">
              Bring <span style={{ color: ORANGE }}>Untamed</span><br />
              to Your Business
            </h1>
            <p className="text-lg sm:text-xl text-untamed-white-muted max-w-2xl mx-auto">
              Premium canned vodka martinis that customers remember.
              Join the growing network of bars, restaurants, and retailers carrying Untamed.
            </p>
          </motion.div>

          {/* Product showcase */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex justify-center gap-4 sm:gap-8 mb-16"
          >
            {drinks.map((drink) => (
              <div key={drink.slug} className="text-center">
                <div className="relative w-16 h-28 sm:w-24 sm:h-40 mx-auto mb-2">
                  <Image
                    src={drink.canImage}
                    alt={drink.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">{drink.flavor}</p>
              </div>
            ))}
          </motion.div>

          {/* Value propositions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16"
          >
            {valueProps.map((prop) => (
              <div
                key={prop.title}
                className="rounded-2xl border border-card-border bg-untamed-black-card p-6"
              >
                <prop.icon className="w-8 h-8 mb-3" style={{ color: ORANGE }} />
                <h3 className="font-bold text-white mb-2">{prop.title}</h3>
                <p className="text-sm text-muted-foreground">{prop.description}</p>
              </div>
            ))}
          </motion.div>

          {/* Lead form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-2xl mx-auto"
            id="inquiry-form"
          >
            <div className="rounded-2xl border-2 bg-untamed-black-card p-8" style={{ borderColor: '#FF8C2A33' }}>
              <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-2 text-center">
                Start the Conversation
              </h2>
              <p className="text-muted-foreground text-center mb-8">
                Fill out the form below and our team will reach out to discuss partnership opportunities.
              </p>

              <Suspense fallback={null}>
                <DistributorLeadForm referrerName={referrerName} />
              </Suspense>
            </div>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default function DistributePage() {
  return (
    <Suspense fallback={null}>
      <DistributeContent />
    </Suspense>
  )
}
