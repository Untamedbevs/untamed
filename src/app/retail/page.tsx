'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  Building2, TrendingUp, Sparkles, ShieldCheck, Package,
  DollarSign, Clock, Users, BarChart3, Store, Utensils,
  Truck, Zap, Target, Heart, Wine, ArrowRight, X, Send,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { DistributorLeadForm } from '@/components/referral/DistributorLeadForm'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

const ORANGE = '#FF8C2A'

function InquiryModal({
  open,
  onClose,
  referrerName,
}: {
  open: boolean
  onClose: () => void
  referrerName: string | null
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 bg-untamed-black-card"
            style={{ borderColor: '#FF8C2A33' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-8 pt-6 pb-4 bg-untamed-black-card border-b border-card-border">
              <div>
                <h2 className="font-condensed text-2xl font-bold text-white uppercase">
                  Start the Conversation
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Tell us about your business and we will reach out within 48 hours.
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-untamed-black-light transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-8 py-6">
              <Suspense fallback={null}>
                <DistributorLeadForm referrerName={referrerName} onSuccess={onClose} />
              </Suspense>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function InquiryCTA({
  label = 'Get Started',
  onClick,
}: {
  label?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3.5 rounded-full font-bold text-black uppercase tracking-wider text-sm sm:text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: ORANGE,
        boxShadow: '0 0 20px rgba(255, 140, 42, 0.3)',
      }}
    >
      <Send className="w-5 h-5 shrink-0" />
      {label}
    </button>
  )
}

const RETAILER_ADVANTAGES = [
  {
    icon: DollarSign,
    title: 'Premium Ring + Trade-Up',
    description: 'Spirit-forward vodka martinis give retailers a premium RTD option that lifts average ticket versus lighter, lower-ABV RTDs. The martini cue carries "night-out" equity that justifies a higher price point without extensive shopper education.',
  },
  {
    icon: ShieldCheck,
    title: 'Value Without Discounting',
    description: 'The "1-2-3 Advantage" makes the purchase feel smart (2 martinis in one can / $3 per cocktail) without relying on price promotions. It\'s simple math a shopper can do in seconds at shelf.',
  },
  {
    icon: TrendingUp,
    title: 'Multi-Serve Velocity',
    description: 'A 12 oz, two-pour can fits hosting and shareable occasions, encouraging stock-up purchases and faster depletion — supporting repeat trips and replenishment behavior.',
  },
  {
    icon: Package,
    title: 'Higher Basket + Repeat',
    description: 'The four "wild spirits" framework ("Pick Your Spirit") makes it easy to buy multiple SKUs at once and come back for the next archetype. A built-in antidote to one-and-done trial.',
  },
  {
    icon: Target,
    title: 'Clear Shelf Navigation',
    description: 'Big-cat naming and archetypes simplify decision-making, reducing shopper friction in a crowded set. Names are more memorable than generic flavor descriptors.',
  },
  {
    icon: Store,
    title: 'Merchandising Flexibility',
    description: 'Performs in cold box for immediate occasions and on shelf for stock-up. The on-pack serving ritual helps communicate quality at point of sale without external signage.',
  },
  {
    icon: BarChart3,
    title: 'Simpler Assortment',
    description: 'A tight, high-clarity four-SKU lineup supports strong blocking, easier replenishment, and cleaner planograms than sprawling flavor portfolios.',
  },
  {
    icon: Sparkles,
    title: 'Brand-Driven Demand',
    description: 'Untamed invests in DTC marketing, social content, and a loyalty program that drives brand-aware shoppers into retail. You benefit from built-in consumer pull without funding awareness yourself.',
  },
]

const ON_PREMISE_ADVANTAGES = [
  {
    icon: Zap,
    title: 'Speed of Service',
    description: 'Chill, shake, and pour — serve a martini quickly during rush periods, reducing ticket times and supporting more rounds per hour. Faster execution means more beverage revenue per shift.',
  },
  {
    icon: ShieldCheck,
    title: 'Consistent Quality',
    description: 'Each can delivers the same martini profile every time, helping maintain standards across shifts, locations, and varying bartender experience levels. Protects your reputation.',
  },
  {
    icon: Users,
    title: 'Lower Labor + Training',
    description: 'Offer martini-style cocktails without complex recipes, measuring, or extensive spirit-and-modifier training — ideal for high-turnover teams and seasonal staffing.',
  },
  {
    icon: Package,
    title: 'Inventory Control',
    description: 'A sealed, multi-serve can reduces over-pouring and spoilage from open bottles or perishable mixers, while making pour costs easier to forecast and manage.',
  },
  {
    icon: Wine,
    title: 'Menu Versatility',
    description: 'Maps to recognizable martini favorites (Espresso, Dirty, Lemon Drop, Peach & Rosemary) so you can build a premium "Martini Menu" with clear guest navigation.',
  },
  {
    icon: Clock,
    title: 'Event & Banquet Efficiency',
    description: 'For weddings, pool bars, rooftops, and VIP service — batching-like execution with consistent results. Serve premium cocktails quickly with minimal equipment.',
  },
  {
    icon: DollarSign,
    title: 'Premium Upsell + Margin',
    description: 'Premium positioning supports premium pricing while the two-pour format improves operational efficiency per served cocktail. Faster build time, predictable portioning, reduced waste.',
  },
  {
    icon: Heart,
    title: 'Built-In Guest Engagement',
    description: '"Pick Your Spirit" creates a conversation starter — guests can order by vibe, try a different spirit next round, and return to explore the lineup. Increases second-drink orders.',
  },
]

const DISTRIBUTOR_ADVANTAGES = [
  {
    icon: TrendingUp,
    title: 'Explosive Category Growth',
    description: 'Ready-to-drink cocktails are the #1 growth segment in beverage alcohol. Untamed sits at the premium end with a clear differentiation story.',
  },
  {
    icon: Sparkles,
    title: 'Brand That Earns Preference',
    description: '"Live Life Untamed" creates an emotional connection beyond taste. Identity-driven, not flavor-driven — turns purchase into a statement that builds loyalty.',
  },
  {
    icon: Package,
    title: '4-SKU Simplicity',
    description: 'Tight lineup is easy to stock, easy to explain, and easy to merchandise. Each SKU has a distinct personality that drives multi-unit baskets.',
  },
  {
    icon: Truck,
    title: 'Full Launch Support',
    description: 'Marketing materials, POS displays, staff training guides, and activation support for your accounts. We help you sell it in.',
  },
]

const ACTIVATION_IDEAS = [
  '"Pick Your Spirit Martini Night" — let guests order by personality',
  'Flight of mini pours — sample all four spirits',
  'Pair Espresso with dessert, Dirty with appetizers',
  'Seasonal spotlight (e.g., "Lioness Week") to drive repeat visits',
  'In-room celebration packages for hotels',
  'Pool and rooftop features with a "shake-and-pour" moment',
  'VIP add-on or fast-serve premium option for venues',
]

function DistributeContent() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

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

  return (
    <div className="min-h-screen bg-untamed-black">
      <Navigation />
      <InquiryModal open={modalOpen} onClose={closeModal} referrerName={referrerName} />

      <div className="pt-24 pb-16">
        {/* ============================================
            HERO
            ============================================ */}
        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
                style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}
              >
                <Building2 className="w-4 h-4" />
                Retail &amp; Distribution
              </div>

              <h1 className="font-condensed text-4xl sm:text-6xl lg:text-7xl font-bold text-white uppercase mb-6">
                Carry <span className="font-headline" style={{ color: ORANGE }}>Untamed</span><br />
                in Your Business
              </h1>
              <p className="text-lg sm:text-xl text-untamed-white-muted max-w-3xl mx-auto mb-10">
                Premium canned vodka martinis that customers remember, reorder, and recommend.
                Join the growing network of retailers, bars, restaurants, and distributors carrying Untamed.
              </p>

              {/* Hero CTA */}
              <div className="flex flex-col items-center gap-6 mb-12">
                <InquiryCTA label="Connect With Us" onClick={openModal} />
                <div className="flex flex-wrap justify-center gap-3">
                  <a href="#retailers" className="px-5 py-2.5 rounded-full border border-[#FF8C2A40] text-[#FF8C2A] text-sm font-medium hover:bg-[#FF8C2A1A] transition-colors">
                    For Retailers
                  </a>
                  <a href="#on-premise" className="px-5 py-2.5 rounded-full border border-[#FF8C2A40] text-[#FF8C2A] text-sm font-medium hover:bg-[#FF8C2A1A] transition-colors">
                    For Bars &amp; Restaurants
                  </a>
                  <a href="#distributors" className="px-5 py-2.5 rounded-full border border-[#FF8C2A40] text-[#FF8C2A] text-sm font-medium hover:bg-[#FF8C2A1A] transition-colors">
                    For Distributors
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Product showcase */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex justify-center gap-4 sm:gap-8"
            >
              {drinks.map((drink) => (
                <div key={drink.slug} className="text-center">
                  <div className="relative w-16 h-28 sm:w-24 sm:h-40 mx-auto mb-2">
                    <Image
                      src={siteAssetAbsoluteUrl(drink.canImage)}
                      alt={drink.name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-untamed-white-muted">{drink.flavor}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============================================
            THE 1-2-3 ADVANTAGE
            ============================================ */}
        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto"
          >
            <div className="rounded-3xl border-2 border-[#FF8C2A33] bg-gradient-to-b from-[#FF8C2A08] to-transparent p-8 sm:p-12 text-center">
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-8">
                The <span style={{ color: ORANGE }}>1-2-3</span> Advantage
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                <div>
                  <p className="font-condensed text-5xl sm:text-6xl font-bold" style={{ color: ORANGE }}>1</p>
                  <p className="text-white font-medium mt-2">Can</p>
                  <p className="text-untamed-white-muted text-sm">12 oz, 15% ABV</p>
                </div>
                <div>
                  <p className="font-condensed text-5xl sm:text-6xl font-bold" style={{ color: ORANGE }}>2</p>
                  <p className="text-white font-medium mt-2">Martinis</p>
                  <p className="text-untamed-white-muted text-sm">Full 6 oz pours</p>
                </div>
                <div>
                  <p className="font-condensed text-5xl sm:text-6xl font-bold" style={{ color: ORANGE }}>$3</p>
                  <p className="text-white font-medium mt-2">Per Cocktail</p>
                  <p className="text-untamed-white-muted text-sm">Luxury meets logic</p>
                </div>
              </div>
              <p className="text-untamed-white-muted mt-8 max-w-2xl mx-auto">
                Luxury meets logic. At just $0.50/oz, Untamed outperforms the market average by 45% on every pour.
                While others compromise on scale or strength, we lead the industry in delivering maximum impact and exceptional value in a single, superior package.
              </p>
            </div>
          </motion.div>
        </section>

        {/* ============================================
            OUR PROMISE TO PARTNERS
            ============================================ */}
        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}>
                <Heart className="w-4 h-4" />
                Our Promise
              </div>
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Our Promise to <span style={{ color: ORANGE }}>Partners</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-3xl mx-auto">
                We will build this company with discipline. We will honor the brand, but we will also honor the numbers.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="space-y-6 text-untamed-white-muted text-base leading-relaxed"
              >
                <p>
                  Great businesses are not built on excitement alone. They are built on repeat purchase, healthy margins, thoughtful distribution, and decisions that create lasting enterprise value.
                </p>
                <p>
                  At the shelf, clarity wins. A $24 four-pack price point, paired with the simple math of eight total cocktails at $3 per cocktail, gives <span className="font-headline text-white">Untamed</span> a message that is easy to merchandise, easy for consumers to understand, and easy for retail teams to repeat.
                </p>
                <p>
                  It shortens the decision. It strengthens perceived value. It helps the product do what great shelf brands do: stop people, make sense immediately, and earn the sale.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="space-y-4"
              >
                {[
                  { label: 'Shelf Clarity', desc: 'Premium packaging with a value story that communicates itself in seconds.' },
                  { label: 'Consumer Pull', desc: 'DTC marketing, social content, and a loyalty program that drives brand-aware shoppers into retail.' },
                  { label: 'Repeat Purchase', desc: 'Identity-driven lineup where each spirit gives consumers a reason to come back and explore.' },
                  { label: 'Sustainable Economics', desc: 'Pricing that protects margins while delivering unmistakable value at the shelf.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                    className="flex gap-4 p-5 rounded-xl border border-card-border bg-untamed-black-card"
                  >
                    <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: ORANGE }} />
                    <div>
                      <h3 className="font-bold text-white text-sm mb-1">{item.label}</h3>
                      <p className="text-xs text-untamed-white-muted leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            FOR RETAILERS
            ============================================ */}
        <section id="retailers" className="px-4 sm:px-6 lg:px-8 mb-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}>
                <Store className="w-4 h-4" />
                For Retailers
              </div>
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Why Retailers Win With <span className="font-headline">Untamed</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                Premium cocktail credentials with a clear value story and a culture-led lineup that supports repeat purchasing.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {RETAILER_ADVANTAGES.map((adv, i) => (
                <motion.div
                  key={adv.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6"
                >
                  <adv.icon className="w-8 h-8 mb-3" style={{ color: ORANGE }} />
                  <h3 className="font-bold text-white mb-2">{adv.title}</h3>
                  <p className="text-sm text-untamed-white-muted leading-relaxed">{adv.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <InquiryCTA label="Carry Untamed in Your Store" onClick={openModal} />
            </div>
          </div>
        </section>

        {/* ============================================
            FOR BARS & RESTAURANTS (ON-PREMISE)
            ============================================ */}
        <section id="on-premise" className="px-4 sm:px-6 lg:px-8 mb-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}>
                <Utensils className="w-4 h-4" />
                For Bars &amp; Restaurants
              </div>
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Premium Martinis, <span style={{ color: ORANGE }}>Simplified</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                Deliver a premium martini program with faster execution, tighter cost control, and consistent guest experience — without adding complexity behind the bar.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {ON_PREMISE_ADVANTAGES.map((adv, i) => (
                <motion.div
                  key={adv.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6"
                >
                  <adv.icon className="w-7 h-7 mb-3" style={{ color: ORANGE }} />
                  <h3 className="font-bold text-white mb-2 text-sm">{adv.title}</h3>
                  <p className="text-xs text-untamed-white-muted leading-relaxed">{adv.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Activation Ideas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl border border-card-border bg-untamed-black-card p-8 mb-10"
            >
              <h3 className="font-condensed text-xl font-bold text-white uppercase mb-4">
                Activation Ideas
              </h3>
              <ul className="grid sm:grid-cols-2 gap-3">
                {ACTIVATION_IDEAS.map((idea, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-untamed-white-muted">
                    <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ORANGE }} />
                    {idea}
                  </li>
                ))}
              </ul>
            </motion.div>

            <div className="text-center">
              <InquiryCTA label="Add Untamed to Your Menu" onClick={openModal} />
            </div>
          </div>
        </section>

        {/* ============================================
            FOR DISTRIBUTORS
            ============================================ */}
        <section id="distributors" className="px-4 sm:px-6 lg:px-8 mb-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: '#FF8C2A1A', color: ORANGE }}>
                <Truck className="w-4 h-4" />
                For Distributors
              </div>
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                A Brand That <span style={{ color: ORANGE }}>Sells Itself</span>
              </h2>
              <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto">
                Premium margins, explosive category growth, and a brand that retailers ask for by name.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-6 mb-10">
              {DISTRIBUTOR_ADVANTAGES.map((adv, i) => (
                <motion.div
                  key={adv.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6"
                >
                  <adv.icon className="w-8 h-8 mb-3" style={{ color: ORANGE }} />
                  <h3 className="font-bold text-white mb-2">{adv.title}</h3>
                  <p className="text-sm text-untamed-white-muted leading-relaxed">{adv.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <InquiryCTA label="Become a Distribution Partner" onClick={openModal} />
            </div>
          </div>
        </section>

        {/* ============================================
            WHY UNTAMED IS DIFFERENT (BRAND DIFFERENTIATORS)
            ============================================ */}
        <section className="px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Why <span className="font-headline">Untamed</span> Is Different
              </h2>
            </motion.div>

            <div className="space-y-6">
              {[
                {
                  title: 'Premium, Spirit-Forward Positioning',
                  desc: 'Untamed competes as a premium ready-to-drink vodka martini — clean vodka backbone, martini-style builds, and a bar-worthy serve. Not a "lite" RTD.',
                },
                {
                  title: 'Format Advantage: Bigger Can + True Multi-Serve',
                  desc: 'Each 12 fl oz can contains the equivalent of (2) 6 oz vodka martinis at 15% ALC/VOL. The "two pours" proposition drives value, shareability, and fewer units needed per occasion.',
                },
                {
                  title: 'Brand Differentiation That Earns Preference',
                  desc: '"Live Life Untamed" creates an emotional reason to choose: freedom, authenticity, and courage. In a crowded RTD set, Untamed competes on meaning — turning a purchase into a statement.',
                },
                {
                  title: 'Culture-Driven Lineup: Four Wild Spirits',
                  desc: 'Black Panther, Cheetah, Cougar, and Lioness are identity cues. Each represents an archetype, giving people a way to see themselves and signal their vibe — driving repeat purchase through self-identification.',
                },
                {
                  title: 'On-Pack Ritual That Upgrades the Occasion',
                  desc: '"Chill it. Shake it. Unleash it!" gives consumers a premium serving cue that bridges canned convenience and cocktail ceremony. Reduces RTD skepticism.',
                },
                {
                  title: 'Distinct, Bar-Relevant Flavor Builds',
                  desc: 'Espresso Martini (caramel & vanilla), Lemon Drop, Classic Dirty, and Peach & Rosemary — balancing "order-it-anywhere" classics with differentiated cues.',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="flex gap-4 p-6 rounded-2xl border border-card-border bg-untamed-black-card"
                >
                  <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: ORANGE }} />
                  <div>
                    <h3 className="font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-untamed-white-muted leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            FINAL CTA
            ============================================ */}
        <section className="px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="rounded-3xl border-2 bg-gradient-to-b from-[#FF8C2A08] to-transparent p-10 sm:p-14" style={{ borderColor: '#FF8C2A33' }}>
              <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-4">
                Ready to Bring <span className="font-headline" style={{ color: ORANGE }}>Untamed</span> to Your Business?
              </h2>
              <p className="text-untamed-white-muted text-lg mb-8 max-w-xl mx-auto">
                Whether you are a retailer, bar, restaurant, or distributor, we would love to start the conversation.
              </p>
              <InquiryCTA label="Connect With Us" onClick={openModal} />
            </div>
          </motion.div>
        </section>
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
