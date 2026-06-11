'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronDown,
  Menu,
  X,
  Trophy,
  Share2,
  User,
} from 'lucide-react'
import { drinks } from '@/lib/drinks'
import { createClient } from '@/lib/supabase/client'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { PresaleBanner } from '@/components/PresaleBanner'
import { NavCartButton } from '@/components/NavCartButton'

type DropdownId = 'drinks' | null

// Single shared style so every primary nav link reads as one consistent system
// instead of the previous rainbow. White at rest, slightly dimmed on hover --
// the hover affordance comes from the dim, not a color shift.
const NAV_LINK_CLASSES =
  'text-sm font-medium tracking-wider uppercase text-untamed-white transition-colors duration-300 hover:text-untamed-white/70'

const MOBILE_LINK_CLASSES =
  'text-xl font-bold tracking-wider uppercase text-untamed-white transition-colors duration-300 hover:text-untamed-white/70'

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null)
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)

  // Auth state for the Sign In / My Portal toggle
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setIsAuthed(!!data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const portalHref = isAuthed ? '/portal' : '/portal/login'
  const portalLabel = isAuthed ? 'My Portal' : 'Sign In'

  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-50">
        <nav>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/images/logo-mark.png"
                alt="Untamed Beverages"
                width={36}
                height={36}
                className="w-8 h-8 md:w-9 md:h-9 group-hover:opacity-80 transition-opacity duration-300"
              />
              <Image
                src="/images/logo-text.png"
                alt="Untamed Beverages"
                width={140}
                height={28}
                className="h-5 md:h-6 w-auto group-hover:opacity-80 transition-opacity duration-300"
              />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6 lg:gap-8">
              {/* Drinks dropdown */}
              <NavDropdown
                id="drinks"
                label="Drinks"
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                widthClass="w-[680px]"
              >
                <DrinksDropdownContent />
              </NavDropdown>

              <a href="/shop" className={NAV_LINK_CLASSES}>
                Shop
              </a>

              <Link href="/about" className={NAV_LINK_CLASSES}>
                About
              </Link>

              <Link href="/retail" className={NAV_LINK_CLASSES}>
                Retail
              </Link>

              <Link href="/rewards" className={NAV_LINK_CLASSES}>
                Rewards
              </Link>

              <Link href="/referral" className={NAV_LINK_CLASSES}>
                Refer
              </Link>

              {/* Right cluster: account + cart */}
              <div className="flex items-center gap-4 pl-2 border-l border-untamed-white/10">
                <Link
                  href={portalHref}
                  className={
                    isAuthed
                      ? 'inline-flex items-center gap-1.5 rounded-full border border-[#9B30FF]/40 bg-[#9B30FF]/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-untamed-white transition-colors duration-300 hover:bg-[#9B30FF]/20'
                      : 'inline-flex items-center gap-1.5 text-untamed-white-muted hover:text-untamed-white transition-colors duration-300'
                  }
                  title={portalLabel}
                  aria-label={portalLabel}
                >
                  <User className="w-4 h-4" />
                  <span className={isAuthed ? '' : 'sr-only md:not-sr-only'}>
                    {portalLabel}
                  </span>
                </Link>
                <NavCartButton
                  className="relative text-untamed-white-muted hover:text-untamed-white transition-colors duration-300 cursor-pointer"
                  badgeClassName="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-panther-light text-[10px] font-bold text-white"
                />
              </div>
            </div>

            {/* Mobile Hamburger */}
            <div className="flex md:hidden items-center gap-3">
              <Link
                href={portalHref}
                className="text-untamed-white p-2"
                aria-label={portalLabel}
              >
                <User className="w-5 h-5" />
              </Link>
              <NavCartButton
                className="relative text-untamed-white p-2 cursor-pointer"
                badgeClassName="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-panther-light text-[10px] font-bold text-white"
              />
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="text-untamed-white p-2"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
        </nav>
        <PresaleBanner />
      </header>

      {/* Reserve space for the absolute header (nav + banner) so content isn't covered */}
      <div className="h-[var(--site-header-offset)] shrink-0" aria-hidden="true" />

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-untamed-black/98 pt-[var(--site-header-offset)] px-6 overflow-y-auto">
          <div className="flex flex-col items-center gap-7 pt-12 pb-12">
            {drinks.map((drink) => (
              <a
                key={drink.slug}
                href={`/drinks/${drink.slug}`}
                onClick={() => setMobileOpen(false)}
                className="font-wild cyber-brush-fix text-3xl tracking-wider transition-colors duration-300"
                style={{ color: drink.color }}
              >
                {drink.name}
              </a>
            ))}
            <a
              href="/shop"
              onClick={() => setMobileOpen(false)}
              className={MOBILE_LINK_CLASSES}
            >
              Shop All
            </a>
            <div className="w-16 h-px bg-card-border my-2" />
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              className={MOBILE_LINK_CLASSES}
            >
              About
            </Link>
            <Link
              href="/retail"
              onClick={() => setMobileOpen(false)}
              className={MOBILE_LINK_CLASSES}
            >
              Retail
            </Link>
            <Link
              href="/rewards"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 ${MOBILE_LINK_CLASSES}`}
            >
              <Trophy className="w-5 h-5" />
              Rewards
            </Link>
            <Link
              href="/referral"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 ${MOBILE_LINK_CLASSES}`}
            >
              <Share2 className="w-5 h-5" />
              Refer
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className={MOBILE_LINK_CLASSES}
            >
              Contact
            </Link>
            <div className="w-16 h-px bg-card-border my-2" />
            <Link
              href={portalHref}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 ${MOBILE_LINK_CLASSES}`}
            >
              <User className="w-5 h-5" />
              {portalLabel}
            </Link>
            <a
              href="https://instagram.com/untamedbevs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-untamed-white-muted hover:text-untamed-white transition-colors duration-300 tracking-wider"
            >
              @untamedbevs
            </a>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Reusable hover dropdown
//
// Opens on hover (desktop) and on click (so it works for keyboard + touch
// folks too). A ~150ms close delay prevents the dropdown from snapping shut
// when the cursor crosses the gap between trigger and panel.
// ---------------------------------------------------------------------------
interface NavDropdownProps {
  id: 'drinks'
  label: string
  openDropdown: DropdownId
  setOpenDropdown: (id: DropdownId) => void
  widthClass: string
  children: React.ReactNode
}

function NavDropdown({
  id,
  label,
  openDropdown,
  setOpenDropdown,
  widthClass,
  children,
}: NavDropdownProps) {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOpen = openDropdown === id

  function open() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setOpenDropdown(id)
  }

  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setOpenDropdown(null), 150)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  return (
    <div
      className="relative"
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpenDropdown(isOpen ? null : id)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-1 text-sm font-medium tracking-wider uppercase text-untamed-white transition-colors duration-300 hover:text-untamed-white/70"
      >
        {label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Hover bridge so the cursor can travel from trigger to panel without leaving the hoverable region */}
          <div className="absolute left-0 right-0 top-full h-3" />
          <div
            className={`absolute left-1/2 -translate-x-1/2 top-full mt-3 ${widthClass} max-w-[calc(100vw-2rem)] rounded-2xl border border-untamed-white/10 bg-untamed-black/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden`}
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
          >
            {children}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drinks dropdown body -- visual mini-menu showing each can
// ---------------------------------------------------------------------------
function DrinksDropdownContent() {
  return (
    <div className="p-4">
      <div className="grid grid-cols-4 gap-2">
        {drinks.map((drink) => (
          <a
            key={drink.slug}
            href={`/drinks/${drink.slug}`}
            className="group relative flex flex-col items-center text-center p-3 rounded-xl border border-transparent hover:border-untamed-white/15 hover:bg-untamed-white/5 transition-colors"
          >
            <div className="relative w-14 h-24 mb-2 transition-transform duration-300 group-hover:scale-105">
              <Image
                src={siteAssetAbsoluteUrl(drink.canImage)}
                alt={drink.name}
                fill
                sizes="56px"
                className="object-contain drop-shadow-lg"
                unoptimized
              />
            </div>
            <span
              className="font-wild cyber-brush-fix text-base tracking-wider mb-0.5"
              style={{ color: drink.color }}
            >
              {drink.name}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-untamed-white-muted">
              {drink.flavor}
            </span>
          </a>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-untamed-white/10 flex items-center justify-between px-1">
        <a
          href="/shop"
          className="text-xs uppercase tracking-wider text-untamed-white hover:text-[#FFD700] transition-colors"
        >
          Shop all flavors →
        </a>
        <span className="text-[10px] uppercase tracking-wider text-untamed-white-muted">
          15% ABV · 12oz · 2 martinis per can
        </span>
      </div>
    </div>
  )
}

