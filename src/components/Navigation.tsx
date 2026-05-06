'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Trophy, ShoppingCart, Share2 } from 'lucide-react'
import { drinks } from '@/lib/drinks'
import { useCartCount } from '@/lib/shop/accelpay'

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const cartCount = useCartCount()

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 z-50">
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
            <div className="hidden md:flex items-center gap-8">
              {drinks.map((drink) => (
                <a
                  key={drink.slug}
                  href={`/drinks/${drink.slug}`}
                  className="font-wild cyber-brush-fix text-base tracking-wider transition-colors duration-300 hover:drop-shadow-lg"
                  style={{ color: drink.color }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = drink.colorLight
                    e.currentTarget.style.textShadow = `0 0 20px ${drink.colorGlow}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = drink.color
                    e.currentTarget.style.textShadow = 'none'
                  }}
                >
                  {drink.name}
                </a>
              ))}
              <a
                href="/shop"
                className="text-sm font-medium tracking-wider uppercase text-untamed-white transition-colors duration-300 hover:text-[#FFD700]"
              >
                Shop All
              </a>
              <Link
                href="/about"
                className="text-sm font-medium tracking-wider uppercase text-untamed-white-muted transition-colors duration-300 hover:text-untamed-white"
              >
                About
              </Link>
              <Link
                href="/retail"
                className="text-sm font-medium tracking-wider uppercase text-[#FF8C2A] transition-colors duration-300 hover:text-[#FFa84d]"
              >
                Retail
              </Link>
              <Link
                href="/rewards"
                className="flex items-center gap-1.5 text-sm font-medium tracking-wider uppercase text-[#FFD700] transition-colors duration-300 hover:text-[#FFA500]"
              >
                <Trophy className="w-4 h-4" />
                Rewards
              </Link>
              <Link
                href="/referral"
                className="flex items-center gap-1.5 text-sm font-medium tracking-wider uppercase text-[#22c55e] transition-colors duration-300 hover:text-[#4ade80]"
              >
                <Share2 className="w-4 h-4" />
                Refer
              </Link>
              <a
                href="/shop"
                className="relative text-untamed-white-muted hover:text-untamed-white transition-colors duration-300"
                aria-label="Shop"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-panther-light text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </a>
            </div>

            {/* Mobile Hamburger */}
            <div className="flex md:hidden items-center gap-3">
              <a
                href="/shop"
                className="relative text-untamed-white p-2"
                aria-label="Shop"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-panther-light text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </a>
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

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-untamed-black/98 pt-20 px-6">
          <div className="flex flex-col items-center gap-8 pt-12">
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
              className="text-xl font-bold tracking-wider uppercase text-untamed-white hover:text-[#FFD700] transition-colors duration-300"
            >
              Shop All
            </a>
            <div className="w-16 h-px bg-card-border my-4" />
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              className="text-xl font-bold tracking-wider uppercase text-untamed-white-muted hover:text-untamed-white transition-colors duration-300"
            >
              About
            </Link>
            <Link
              href="/retail"
              onClick={() => setMobileOpen(false)}
              className="text-xl font-bold tracking-wider uppercase text-[#FF8C2A] transition-colors duration-300"
            >
              Retail
            </Link>
            <Link
              href="/rewards"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 text-xl font-bold tracking-wider uppercase text-[#FFD700] transition-colors duration-300"
            >
              <Trophy className="w-5 h-5" />
              Rewards
            </Link>
            <Link
              href="/referral"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 text-xl font-bold tracking-wider uppercase text-[#22c55e] transition-colors duration-300"
            >
              <Share2 className="w-5 h-5" />
              Refer
            </Link>
            <div className="w-16 h-px bg-card-border my-4" />
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
