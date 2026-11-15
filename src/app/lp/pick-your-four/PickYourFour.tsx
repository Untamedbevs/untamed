'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Info, Lock, Minus, Plus, Truck, X } from 'lucide-react'
import { Footer } from '@/components/Footer'
import { Navigation } from '@/components/Navigation'
import { NavCartButton } from '@/components/NavCartButton'
import { ShippingRates } from '@/components/ShippingRates'
import { ShippingStates, SHIP_CHECK_ID } from '@/components/ShippingStates'
import { drinks, getDrinkBySlug, type Drink } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { HOLIDAY_PROMO, isHolidayPromoActive } from '@/lib/promo/holiday'
import {
  addItemsToCart,
  buildItemsCartUrl,
  isCartBlockedOnLocalhost,
  openSideCart,
  parseItemsParam,
  type CartLine,
} from '@/lib/shop/accelpay'
import {
  MAX_BOXES,
  MIN_BOXES,
  MIXED_PACKS,
  PACK_SIZE,
  getPackBySlug,
  matchPack,
  type PackPreset,
} from '@/lib/shop/packs'
import { trackLinkAddToCart } from '@/lib/tracking/meta-pixel'

const cartKey = (d: Drink) => `${d.bevCartListingId}.${d.bevCartVariantId}`
const martinisPerBox = (d: Drink) => Math.round(d.priceCents / d.pricePerCocktailCents)
/** Every box is a 4-pack of cans. */
const CANS_PER_BOX = 4
const shortFlavor = (d: Drink) => d.flavor.replace(/ Martini$/, '')
/** Hides the scrollbar on the swipeable rows. */
const NO_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

function countBySlug(boxes: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const slug of boxes) counts[slug] = (counts[slug] ?? 0) + 1
  return counts
}

/**
 * "Pick Your Four": the conversion-focused shop landing page, built phone
 * first. One screen holds the whole purchase: the four flavors side by side,
 * a live "1 2 3 4 = free shipping" meter (the working version of BoxMath on
 * /shop), and one button pinned to the bottom that adds everything to the
 * AccelPay side cart. Shopper copy never calls the set a "pack", because a
 * box is already a 4-pack of cans.
 * Deep link: ?mix=<preset slug> opens with that mix already picked.
 *
 * Also the /shop page: there `siteNav` swaps the slim landing header for the
 * full site navigation and lets the About sheet link out to each drink's page.
 */
export function PickYourFour({ siteNav = false }: { siteNav?: boolean }) {
  const [boxes, setBoxes] = useState<string[]>([])
  /** What is being sent to the cart right now: 'builder' or a ready-made four's slug. */
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const adding = addingKey === 'builder'
  /** The ready-made four last added straight to the cart. */
  const [addedPack, setAddedPack] = useState<string | null>(null)
  /** Dev only: set when a cart add is attempted on localhost, where the cart cannot load. */
  const [localCartUrl, setLocalCartUrl] = useState<string | null>(null)
  /** Flavor whose "About" sheet is open. */
  const [aboutSlug, setAboutSlug] = useState<string | null>(null)
  const closeAbout = useCallback(() => setAboutSlug(null), [])
  const aboutDrink = aboutSlug ? getDrinkBySlug(aboutSlug) : undefined
  const ctaRef = useRef<HTMLButtonElement>(null)
  const [ctaInView, setCtaInView] = useState(true)
  /** Boxes just sent to the cart; drives the "in your cart" state. */
  const [justAdded, setJustAdded] = useState(0)
  const builderRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const promo = isHolidayPromoActive()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const preset = getPackBySlug(params.get('mix'))
    if (preset) {
      setBoxes(preset.boxes)
      return
    }
    // Arrived through the cart-link fallback: those boxes are already in the
    // cart, so show the confirmation instead of refilling the slots.
    const inCart = Object.values(parseItemsParam(params.get('items'))).reduce((a, b) => a + b, 0)
    if (inCart) setJustAdded(inCart)
  }, [])

  // The pinned bar only steps in once the main button has scrolled away.
  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setCtaInView(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const counts = useMemo(() => countBySlug(boxes), [boxes])
  const count = boxes.length
  const totalCents = boxes.reduce((sum, slug) => sum + (getDrinkBySlug(slug)?.priceCents ?? 0), 0)
  const total = totalCents / 100
  const martinis = boxes.reduce((sum, slug) => {
    const d = getDrinkBySlug(slug)
    return sum + (d ? martinisPerBox(d) : 0)
  }, 0)
  const matched = matchPack(boxes)
  const remaining = Math.max(0, PACK_SIZE - count)
  const canOrder = count >= MIN_BOXES
  const full = count >= MAX_BOXES
  const freeShipping = promo && count >= HOLIDAY_PROMO.freeShippingBoxes
  const showAdded = justAdded > 0 && count === 0
  /** The cap after the slots: gold once free shipping (or, off-promo, the minimum order) is reached. */
  const capOn = promo ? freeShipping : canOrder
  const capRemaining = promo ? Math.max(0, HOLIDAY_PROMO.freeShippingBoxes - count) : Math.max(0, MIN_BOXES - count)
  const box = drinks[0]

  function add(slug: string) {
    setJustAdded(0)
    setBoxes((prev) => (prev.length >= MAX_BOXES ? prev : [...prev, slug]))
  }

  function removeOne(slug: string) {
    setBoxes((prev) => {
      const i = prev.lastIndexOf(slug)
      return i < 0 ? prev : prev.filter((_, idx) => idx !== i)
    })
  }

  function removeAt(index: number) {
    setBoxes((prev) => prev.filter((_, idx) => idx !== index))
  }

  function applyPreset(preset: PackPreset) {
    setJustAdded(0)
    setBoxes(preset.boxes)
  }

  /** Sends boxes to the side cart. Resolves true once the cart confirms them. */
  async function sendToCart(list: string[], key: string): Promise<boolean> {
    if (list.length < MIN_BOXES || addingKey) return false
    if (isCartBlockedOnLocalhost()) {
      const { port, pathname, search } = window.location
      setLocalCartUrl(`http://127.0.0.1${port ? `:${port}` : ''}${pathname}${search}`)
      return false
    }
    const qtyBySlug = countBySlug(list)
    const lines: CartLine[] = []
    const linkItems: Record<string, number> = {}
    let cents = 0
    for (const drink of drinks) {
      const qty = qtyBySlug[drink.slug]
      if (!qty) continue
      lines.push({ listingId: drink.bevCartListingId, variantId: drink.bevCartVariantId, qty })
      linkItems[cartKey(drink)] = qty
      cents += qty * drink.priceCents
    }

    setAddingKey(key)
    trackLinkAddToCart({ value: cents / 100, contentIds: lines.map((l) => l.variantId) })
    const pending = addItemsToCart(lines)
    openSideCart()
    const confirmed = await pending
    if (!confirmed) {
      // Side cart didn't take the boxes: load them through a cart link instead.
      window.location.href = buildItemsCartUrl(linkItems)
      return false
    }
    setAddingKey(null)
    return true
  }

  async function addToCart() {
    if (await sendToCart(boxes, 'builder')) {
      setJustAdded(count)
      setBoxes([])
    }
  }

  async function addPack(pack: PackPreset) {
    if (await sendToCart(pack.boxes, pack.slug)) setAddedPack(pack.slug)
  }

  const statusLine = (() => {
    if (showAdded) return `${justAdded} boxes are in your cart.`
    if (count === 0) return promo ? `Pick any ${PACK_SIZE} boxes and shipping is free.` : `Pick any ${PACK_SIZE} boxes to start.`
    if (!promo) return count < MIN_BOXES ? `Minimum order is ${MIN_BOXES} boxes.` : 'Shipping is calculated at checkout.'
    if (freeShipping) return matched ? `${matched.name}. Free shipping unlocked.` : 'Free shipping unlocked.'
    return `${remaining} more ${remaining === 1 ? 'box' : 'boxes'} and shipping is free.`
  })()

  const ctaLabel = (() => {
    if (adding) return 'Adding to cart'
    if (showAdded) return 'View cart'
    if (count === 0) return 'Start with one of each'
    if (!canOrder) return `Add ${MIN_BOXES - count} more to order`
    return `Add ${count} boxes to cart · $${total.toFixed(0)}`
  })()

  // Never a dead button on arrival: with nothing picked, the button fills the four.
  const ctaEnabled = !addingKey && (count === 0 || canOrder)
  const onCta = showAdded ? () => void openSideCart() : count === 0 ? () => applyPreset(MIXED_PACKS[0]) : addToCart
  const ctaClass = ctaEnabled
    ? 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-untamed-black hover:brightness-110 active:scale-[0.98]'
    : 'bg-white/10 text-white/40 cursor-not-allowed'

  const showBar = !ctaInView && (count > 0 || showAdded)
  const packPrice = (PACK_SIZE * box.priceCents) / 100

  const status = (
    <p
      className={`flex items-center justify-center gap-1.5 text-center text-xs font-medium ${
        freeShipping || showAdded ? 'text-[#FFD700]' : 'text-untamed-white'
      }`}
      aria-live="polite"
    >
      {showAdded ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        promo && <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      {statusLine}
    </p>
  )

  return (
    <div className={`flex min-h-screen flex-col overflow-x-clip bg-untamed-black ${showBar ? 'pb-[7.5rem]' : ''}`}>
      {siteNav ? (
        <Navigation />
      ) : (
        <>
          {promo && (
            <p className="bg-[#FFD700] px-3 py-1.5 text-center font-condensed text-xs font-bold uppercase tracking-[0.12em] text-untamed-black sm:text-sm">
              Holiday Blast: free shipping on {HOLIDAY_PROMO.freeShippingBoxes}+ boxes
              <span className="hidden sm:inline">. No code needed.</span>
            </p>
          )}

          {/* Slim header: logo and cart only, nothing to wander off to */}
          <header className="border-b border-white/10">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-16 lg:px-8">
              <Link href="/" className="flex items-center gap-2.5" aria-label="Untamed Beverages home">
                <Image src="/images/logo-mark.png" alt="" width={30} height={30} />
                <Image src="/images/logo-text.png" alt="Untamed Beverages" width={120} height={28} className="h-5 w-auto" />
              </Link>
              <NavCartButton
                className="relative text-untamed-white p-2 cursor-pointer"
                badgeClassName="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-panther-light text-[10px] font-bold text-white"
              />
            </div>
          </header>
        </>
      )}

      <main className="flex-1">
        {/* ============ Builder (the hero) ============ */}
        <section ref={builderRef} className="scroll-mt-2 px-4 pt-6 pb-10 sm:px-6 sm:pt-10 lg:px-8 lg:py-14">
          <div className="mx-auto max-w-3xl lg:max-w-7xl">
            <h1 className="text-center font-condensed text-[2.6rem] font-bold uppercase leading-[0.92] text-white sm:text-6xl lg:text-7xl">
              Pick any four.
              <span className="block whitespace-nowrap font-headline text-[2.1rem] text-holiday-foil sm:text-6xl">
                {promo ? 'We ship them free.' : 'Mix them your way.'}
              </span>
            </h1>
            <p className="mt-3 text-center text-sm text-untamed-white-muted sm:text-base">
              Award-winning vodka martinis, ready to pour.
              <span className="block font-medium text-untamed-white">
                ${(box.priceCents / 100).toFixed(0)} / {CANS_PER_BOX}-pack &bull; {martinisPerBox(box)} martinis, {martinisPerBox(box) / CANS_PER_BOX} per can
              </span>
            </p>

            {/* Phones: one column. Desktop: one panel, flavors on the left, the four and the button on the right. */}
            <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_27rem] lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-white/10 lg:bg-white/[0.03]">
            <div className="lg:px-10 lg:py-10">
            {/* The picker: all four flavors side by side */}
            <div className="grid grid-cols-4 gap-2 sm:gap-5">
              {drinks.map((drink) => {
                const qty = counts[drink.slug] ?? 0
                return (
                  <div key={drink.slug} className="flex min-w-0 flex-col items-center text-center">
                    <button
                      type="button"
                      onClick={() => add(drink.slug)}
                      disabled={full}
                      className="group relative block w-full"
                      aria-label={`Add a box of ${drink.name}, ${drink.flavor}`}
                    >
                      <span
                        className="absolute inset-x-0 bottom-0 top-1/4 rounded-full blur-2xl transition-opacity duration-300"
                        style={{ backgroundColor: drink.colorLight, opacity: qty ? 0.45 : 0.14 }}
                        aria-hidden="true"
                      />
                      <span className="relative mx-auto block aspect-[2/5] w-[62%] max-w-[4.75rem] lg:max-w-[7rem]">
                        <Image
                          src={siteAssetAbsoluteUrl(drink.canImage)}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 96px, 15vw"
                          className="object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.7)] transition-transform duration-200 group-hover:scale-105 group-active:scale-90"
                          unoptimized
                        />
                      </span>
                      {qty > 0 && (
                        <motion.span
                          key={qty}
                          initial={reduceMotion ? false : { scale: 0.4 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                          className="absolute right-0 top-0 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-condensed text-base font-bold text-untamed-black sm:right-3"
                          style={{ backgroundColor: drink.colorLight }}
                          aria-hidden="true"
                        >
                          {qty}
                        </motion.span>
                      )}
                    </button>

                    <span
                      className="mt-2 flex min-h-[2.1em] items-center font-condensed text-[15px] font-bold uppercase leading-[1.05] tracking-wide sm:text-xl"
                      style={{ color: drink.colorLight }}
                    >
                      {drink.name}
                    </span>
                    <span className="flex min-h-[2.4em] items-start text-[11px] leading-tight text-untamed-white-muted sm:text-sm">
                      {shortFlavor(drink)}
                    </span>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => add(drink.slug)}
                        disabled={full}
                        className="mt-1.5 flex h-10 w-full max-w-[8rem] items-center justify-center gap-1 rounded-full border font-condensed text-sm font-bold uppercase tracking-wider transition-colors hover:bg-white/10 disabled:opacity-30"
                        style={{ borderColor: drink.colorLight, color: drink.colorLight }}
                        aria-label={`Add a box of ${drink.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Add
                      </button>
                    ) : (
                      <div
                        className="mt-1.5 flex h-10 w-full max-w-[8rem] items-stretch overflow-hidden rounded-full text-untamed-black"
                        style={{ backgroundColor: drink.colorLight }}
                      >
                        <button
                          type="button"
                          onClick={() => removeOne(drink.slug)}
                          className="flex flex-1 items-center justify-center active:bg-black/15"
                          aria-label={`Remove a box of ${drink.name}`}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="flex w-5 items-center justify-center font-condensed text-lg font-bold tabular-nums" aria-live="polite">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => add(drink.slug)}
                          disabled={full}
                          className="flex flex-1 items-center justify-center active:bg-black/15 disabled:opacity-30"
                          aria-label={`Add a box of ${drink.name}`}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAboutSlug(drink.slug)}
                      className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-full border bg-white/[0.04] font-condensed text-xs font-bold uppercase tracking-wider transition hover:bg-white/10 sm:h-9 sm:w-auto sm:px-4 sm:text-sm"
                      style={{ borderColor: `${drink.colorLight}80`, color: drink.colorLight }}
                      aria-label={`About ${drink.name}`}
                    >
                      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      About
                    </button>
                  </div>
                )
              })}
            </div>

            </div>

            <div className="lg:flex lg:flex-col lg:justify-center lg:border-l lg:border-white/10 lg:bg-black/30 lg:p-8">
            <p className="hidden font-condensed text-2xl font-bold uppercase text-white lg:block">Your four</p>
            {/* Live box math: 1 2 3 4 = free shipping */}
            <div className="mt-6 flex gap-1.5 lg:mt-4 lg:flex-col lg:gap-2.5">
            <div
              className={`grid min-w-0 flex-1 grid-cols-4 gap-1.5 lg:gap-2.5 ${
                count <= PACK_SIZE ? 'lg:grid-cols-2' : count <= 6 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
              }`}
            >
              {/* One slot per box: four to fill, then one more for every box past the four */}
              {Array.from({ length: Math.max(PACK_SIZE, count) }, (_, i) => {
                const drink = boxes[i] ? getDrinkBySlug(boxes[i]) : undefined
                if (!drink) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="flex h-16 items-center justify-center rounded-lg border border-dashed border-white/20 font-condensed text-xl font-bold text-white/25 sm:aspect-[13/12] sm:h-auto sm:text-3xl lg:aspect-[3/2]"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </div>
                  )
                }
                return (
                  <motion.button
                    key={`${drink.slug}-${i}`}
                    type="button"
                    onClick={() => removeAt(i)}
                    initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                    className="relative h-16 rounded-lg border sm:aspect-[13/12] sm:h-auto lg:aspect-[3/2]"
                    style={{ borderColor: drink.colorLight, backgroundColor: `${drink.colorLight}26` }}
                    aria-label={`Remove ${drink.name} box`}
                  >
                    <Image
                      src={siteAssetAbsoluteUrl(drink.boxImageFront)}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 170px, 80px"
                      className="object-contain p-1 drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] lg:p-2"
                      unoptimized
                    />
                  </motion.button>
                )
              })}
            </div>
              {/* Locked and grey until the fourth box, then it pops gold */}
              <motion.div
                key={capOn ? 'on' : 'locked'}
                initial={reduceMotion || !capOn ? false : { scale: 0.4, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 11 }}
                className={`relative flex min-h-16 w-[4.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-center font-condensed font-bold uppercase leading-none tracking-wider sm:w-24 lg:min-h-0 lg:h-14 lg:w-auto lg:flex-row lg:gap-2.5 ${
                  capOn
                    ? 'bg-[#FFD700] text-untamed-black shadow-[0_0_32px_rgba(255,215,0,0.6)]'
                    : 'border border-dashed border-white/15 bg-white/[0.03] text-white/40'
                }`}
                aria-live="polite"
              >
                {capOn && !reduceMotion && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-lg"
                    // A spreading shadow, not a scaled box: shadows never widen the page.
                    initial={{ boxShadow: '0 0 0 0px rgba(255,215,0,0.9)' }}
                    animate={{ boxShadow: '0 0 0 14px rgba(255,215,0,0)' }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    aria-hidden="true"
                  />
                )}
                {capOn ? (
                  <>
                    <Truck className="h-5 w-5 lg:h-6 lg:w-6" aria-hidden="true" />
                    <span className="text-base sm:text-lg lg:hidden">{promo ? 'Free' : 'Ships'}</span>
                    <span className="hidden text-xl lg:inline">{promo ? 'Free shipping unlocked' : 'Ready to ship'}</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    <span className="text-[11px] sm:text-sm lg:hidden">
                      {capRemaining} more
                    </span>
                    <span className="hidden text-base lg:inline">
                      {promo ? 'Free shipping locked' : 'Not enough yet'} &bull; {capRemaining} more{' '}
                      {capRemaining === 1 ? 'box' : 'boxes'}
                    </span>
                  </>
                )}
              </motion.div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-untamed-white-muted">
              <p>
                {count > 0 ? (
                  <>
                    <span className="font-semibold text-untamed-white">
                      {count} {count === 1 ? 'box' : 'boxes'} &bull; {count * CANS_PER_BOX} cans &bull; {martinis} martinis &bull; $
                      {total.toFixed(0)}
                    </span>
                    {count > PACK_SIZE ? ` (+${count - PACK_SIZE} past the four)` : ''}
                  </>
                ) : promo ? (
                  <>
                    <span className="font-semibold text-untamed-white">
                      {PACK_SIZE} boxes = ${(PACK_SIZE * box.priceCents) / 100}
                    </span>
                    , which clears the ${HOLIDAY_PROMO.freeShippingThreshold} free shipping mark.{' '}
                    <a href={`#${SHIP_CHECK_ID}`} className="underline decoration-dotted underline-offset-4 hover:text-white">
                      Ships to {HOLIDAY_PROMO.shippingRegion}
                    </a>
                    . {HOLIDAY_PROMO.autoApplyNote}
                  </>
                ) : (
                  'Tap a flavor to add a box.'
                )}
              </p>
              <span className="flex shrink-0 items-center gap-3">
                {count > 0 && (
                  <button type="button" onClick={() => setBoxes([])} className="underline decoration-dotted underline-offset-4 hover:text-white">
                    Clear
                  </button>
                )}
              </span>
            </div>

            {/* The button, right under what they just picked */}
            <button
              ref={ctaRef}
              type="button"
              onClick={onCta}
              disabled={!ctaEnabled}
              className={`mt-4 mb-2 w-full rounded-full px-6 py-3.5 font-condensed text-lg font-bold uppercase tracking-wider transition ${ctaClass}`}
            >
              {ctaLabel}
            </button>
            {status}
            </div>
            </div>
          </div>
        </section>

        {/* ============ Ready-made fours: one tap straight to the cart ============ */}
        <section className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14" aria-labelledby="mixes-heading">
          <div className="mx-auto max-w-7xl">
            <h2 id="mixes-heading" className="font-condensed text-3xl font-bold uppercase text-white sm:text-4xl">
              Or grab a ready-made four.
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-untamed-white-muted">
              Each one is {PACK_SIZE} boxes, already picked for you. Every box is a {CANS_PER_BOX}-pack of cans, so
              you get {PACK_SIZE * CANS_PER_BOX} cans for ${packPrice}
              {promo ? ', shipped free' : ''}. One tap puts all {PACK_SIZE} boxes in your cart.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {MIXED_PACKS.map((pack, index) => {
                const packDrinks = pack.boxes.map((slug) => getDrinkBySlug(slug)).filter((d): d is Drink => !!d)
                const first = packDrinks[0]
                const last = packDrinks[packDrinks.length - 1]
                const featured = index === 0
                const busy = addingKey === pack.slug
                const added = addedPack === pack.slug
                // One line per flavor: which box, and how many of it.
                const contents: { drink: Drink; qty: number }[] = []
                for (const d of packDrinks) {
                  const line = contents.find((c) => c.drink.slug === d.slug)
                  if (line) line.qty += 1
                  else contents.push({ drink: d, qty: 1 })
                }
                const packMartinis = packDrinks.reduce((sum, d) => sum + martinisPerBox(d), 0)
                return (
                  <div
                    key={pack.slug}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 ${
                      featured ? 'sm:col-span-2' : ''
                    }`}
                    style={{
                      background: `radial-gradient(120% 60% at 0% 0%, ${first.colorLight}55, transparent 60%), radial-gradient(120% 60% at 100% 0%, ${last.colorLight}55, transparent 60%), #141414`,
                    }}
                  >
                    <div className="flex items-end justify-center -space-x-2 px-3 pt-4" aria-hidden="true">
                      {packDrinks.map((d, i) => (
                        <span
                          key={i}
                          className="relative block aspect-[2/5] w-[13%] max-w-[3.75rem] transition-transform duration-300 group-hover:-translate-y-1"
                          style={{ rotate: `${(i - (packDrinks.length - 1) / 2) * 5}deg`, marginBottom: `${-Math.abs(i - 1.5) * 3}px` }}
                        >
                          <Image
                            src={siteAssetAbsoluteUrl(d.canImage)}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.7)]"
                            unoptimized
                          />
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                      <h3 className="font-condensed text-2xl font-bold uppercase leading-none text-white">{pack.name}</h3>
                      <p className="mt-1 text-sm leading-snug text-untamed-white-muted">{pack.pitch}</p>

                      <p className="mt-4 font-condensed text-xs font-bold uppercase tracking-widest text-white/50">
                        What&rsquo;s in the pack
                      </p>
                      <ul className={`mt-2 grid flex-1 content-start gap-2 ${featured ? 'sm:grid-cols-2' : ''}`}>
                        {contents.map(({ drink: d, qty }) => (
                          <li
                            key={d.slug}
                            className="flex items-center gap-3 rounded-xl border bg-black/40 p-2"
                            style={{ borderColor: `${d.colorLight}55` }}
                          >
                            <span
                              className="relative block h-16 w-20 shrink-0 rounded-lg"
                              style={{ backgroundColor: `${d.colorLight}26` }}
                            >
                              <Image
                                src={siteAssetAbsoluteUrl(d.boxImageFront)}
                                alt={`${d.name} box`}
                                fill
                                sizes="80px"
                                className="object-contain p-1 drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
                                unoptimized
                              />
                              <span
                                className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-condensed text-sm font-bold text-untamed-black"
                                style={{ backgroundColor: d.colorLight }}
                                aria-hidden="true"
                              >
                                &times;{qty}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-condensed text-base font-bold uppercase leading-tight text-white">
                                {qty} {qty === 1 ? 'box' : 'boxes'} of <span style={{ color: d.colorLight }}>{d.name}</span>
                              </span>
                              <span className="block text-xs leading-snug text-untamed-white-muted">
                                {shortFlavor(d)} &bull; {qty * CANS_PER_BOX} cans
                              </span>
                              <button
                                type="button"
                                onClick={() => setAboutSlug(d.slug)}
                                className="mt-1.5 flex h-7 items-center gap-1 rounded-full border bg-white/[0.04] px-2.5 font-condensed text-xs font-bold uppercase tracking-wider transition hover:bg-white/10"
                                style={{ borderColor: `${d.colorLight}80`, color: d.colorLight }}
                                aria-label={`About ${d.name}`}
                              >
                                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                About this drink
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>

                      <p className="mt-3 text-xs text-untamed-white-muted">
                        <span className="font-semibold text-untamed-white">
                          {packDrinks.length} boxes &bull; {packDrinks.length * CANS_PER_BOX} cans &bull; {packMartinis} martinis
                        </span>
                        {promo ? ' • Ships free' : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => (added ? void openSideCart() : void addPack(pack))}
                        disabled={!!addingKey}
                        className={`mt-3 flex h-11 items-center justify-center gap-1.5 rounded-full font-condensed text-sm font-bold uppercase tracking-wider transition active:scale-[0.98] ${
                          added ? 'border border-[#FFD700] text-[#FFD700]' : 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-untamed-black'
                        }`}
                        aria-label={added ? `${pack.name} is in your cart. View cart` : `Add ${pack.name} to cart`}
                      >
                        {added ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            In cart
                          </>
                        ) : busy ? (
                          'Adding'
                        ) : (
                          <>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add all {packDrinks.length} boxes &bull; ${packPrice}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ============ New here: what Untamed is, and each flavor's story ============ */}
        <section className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14" aria-labelledby="about-heading">
          <div className="mx-auto max-w-7xl">
            <h2 id="about-heading" className="font-condensed text-3xl font-bold uppercase text-white sm:text-4xl">
              New to Untamed?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-untamed-white-muted sm:text-base">
              Untamed makes award-winning craft martinis in a can, made with vodka and natural flavors. Nothing to mix
              and nothing to measure. Four flavors, each named for the big cat it drinks like.
            </p>
            <dl className="mt-5 grid max-w-2xl grid-cols-3 divide-x divide-white/10 text-center">
              {[
                [String(martinisPerBox(box) / CANS_PER_BOX), 'martinis in every can'],
                [box.abv, 'alcohol by volume'],
                ['3', 'steps: chill, shake, pour'],
              ].map(([value, label]) => (
                <div key={label} className="px-2">
                  <dt className="font-headline text-3xl leading-none text-holiday-foil">{value}</dt>
                  <dd className="mt-1 text-xs leading-snug text-untamed-white-muted">{label}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-5">
              {drinks.map((drink) => (
                <button
                  key={drink.slug}
                  type="button"
                  onClick={() => setAboutSlug(drink.slug)}
                  className="group flex flex-col items-center rounded-2xl border border-white/10 px-3 pb-3 pt-4 text-center transition active:scale-[0.98]"
                  style={{ background: `radial-gradient(110% 80% at 50% 0%, ${drink.colorLight}40, transparent 65%), #141414` }}
                >
                  <span className="relative block h-28 w-full">
                    <Image
                      src={siteAssetAbsoluteUrl(drink.animalImage)}
                      alt={drink.animal}
                      fill
                      sizes="160px"
                      className="object-contain transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </span>
                  <span className="mt-2 font-condensed text-lg font-bold uppercase leading-none" style={{ color: drink.colorLight }}>
                    {drink.name}
                  </span>
                  <span className="mt-1 text-xs text-untamed-white-muted">{shortFlavor(drink)}</span>
                  <span className="mt-2 text-xs font-medium text-white underline decoration-dotted underline-offset-4">
                    Meet the {drink.name.split(' ').pop()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ============ Shipping ============ */}
        <section className="px-4 pb-12">
          <div className="mx-auto max-w-2xl space-y-6">
            <ShippingRates />
            <ShippingStates />
          </div>
        </section>
      </main>

      <Footer />

      <AnimatePresence>
        {aboutDrink && (
          <DrinkAbout
            key={aboutDrink.slug}
            drink={aboutDrink}
            qty={counts[aboutDrink.slug] ?? 0}
            full={full}
            pageHref={siteNav ? `/drinks/${aboutDrink.slug}` : undefined}
            onAdd={() => {
              add(aboutDrink.slug)
              closeAbout()
            }}
            onClose={closeAbout}
          />
        )}
      </AnimatePresence>

      {localCartUrl && (
        <p className="fixed inset-x-3 top-3 z-50 rounded-xl border border-[#FFD700]/50 bg-untamed-black px-4 py-3 text-sm text-untamed-white shadow-2xl">
          The cart can&apos;t load on &quot;localhost&quot; (AccelPay&apos;s script sends it to this site, which 404s).{' '}
          <a href={localCartUrl} className="font-semibold text-[#FFD700] underline">
            Open this page on 127.0.0.1
          </a>{' '}
          to test it.
        </p>
      )}

      {/* ============ Pinned order bar: only once the main button is off screen ============ */}
      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-untamed-black/95 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="mx-auto max-w-3xl">
            {status}
            <button
              type="button"
              onClick={onCta}
              disabled={!ctaEnabled}
              className={`mt-2 w-full rounded-full px-6 py-3.5 font-condensed text-lg font-bold uppercase tracking-wider transition ${ctaClass}`}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * "About" sheet for one flavor: slides up from the bottom on phones, sits
 * centered on larger screens. Closes on the X, the backdrop or Escape.
 */
function DrinkAbout({
  drink,
  qty,
  full,
  pageHref,
  onAdd,
  onClose,
}: {
  drink: Drink
  qty: number
  full: boolean
  /** Link to the drink's own page; left out on the landing page so nobody wanders off. */
  pageHref?: string
  onAdd: () => void
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const facts: [string, string][] = [
    [drink.abv, 'ABV'],
    [drink.size.split(' /')[0].toLowerCase(), 'per can'],
    [String(martinisPerBox(drink) / CANS_PER_BOX), 'martinis a can'],
    [String(CANS_PER_BOX), 'cans a box'],
  ]

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        onClick={onClose}
        tabIndex={-1}
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-drink-title"
        initial={reduceMotion ? false : { y: 48 }}
        animate={{ y: 0 }}
        exit={reduceMotion ? undefined : { y: 48 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141414] sm:rounded-3xl"
        style={{ boxShadow: `0 0 70px ${drink.colorGlow}` }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="overflow-y-auto overscroll-contain">
          <div
            className="flex items-end gap-3 px-5 pt-6"
            style={{ background: `radial-gradient(120% 100% at 20% 0%, ${drink.colorLight}55, transparent 70%)` }}
          >
            <span className="relative block h-32 w-40 shrink-0">
              <Image
                src={siteAssetAbsoluteUrl(drink.boxWithCanImage)}
                alt={`A box of ${drink.name} with one can`}
                fill
                sizes="160px"
                className="object-contain object-bottom drop-shadow-[0_10px_14px_rgba(0,0,0,0.7)]"
                unoptimized
              />
            </span>
            <div className="min-w-0 pb-1 pr-8">
              <h2
                id="about-drink-title"
                className="font-condensed text-3xl font-bold uppercase leading-[0.95]"
                style={{ color: drink.colorLight }}
              >
                {drink.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-white">{drink.flavor}</p>
              <p className="text-xs text-untamed-white-muted">{drink.subtitle}</p>
            </div>
          </div>

          <div className="px-5 pb-5 pt-4">
            <p className="text-sm font-medium italic text-white">{drink.tagline}</p>
            <p className="mt-3 text-sm leading-relaxed text-untamed-white-muted">{drink.story}</p>

            <h3 className="mt-5 font-condensed text-sm font-bold uppercase tracking-[0.18em] text-white">What&apos;s inside</h3>
            <p className="mt-1 text-sm leading-relaxed text-untamed-white-muted">{drink.whatsInside}</p>

            <dl className="mt-5 grid grid-cols-4 divide-x divide-white/10 rounded-xl border border-white/10 py-3 text-center">
              {facts.map(([value, label]) => (
                <div key={label} className="px-1">
                  <dt className="font-condensed text-lg font-bold leading-none text-white">{value}</dt>
                  <dd className="mt-1 text-[11px] leading-tight text-untamed-white-muted">{label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-untamed-white-muted">Made with vodka and natural flavors. Chill it, shake it, pour it.</p>
            {pageHref && (
              <Link
                href={pageHref}
                className="mt-3 inline-block text-sm font-medium underline decoration-dotted underline-offset-4"
                style={{ color: drink.colorLight }}
              >
                See the full {drink.name} page
              </Link>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onAdd}
            disabled={full}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full font-condensed text-base font-bold uppercase tracking-wider text-untamed-black transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: drink.colorLight }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a box &bull; ${(drink.priceCents / 100).toFixed(0)}
            {qty > 0 ? ` (${qty} picked)` : ''}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
