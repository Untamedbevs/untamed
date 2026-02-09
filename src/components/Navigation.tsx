'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { drinks } from '@/lib/drinks'

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false)

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
                <Link
                  key={drink.slug}
                  href={`/drinks/${drink.slug}`}
                  className="text-sm font-medium tracking-wider uppercase transition-colors duration-300 hover:drop-shadow-lg"
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
                </Link>
              ))}
              <a
                href="https://instagram.com/untamedbevs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-untamed-white-muted hover:text-untamed-white transition-colors duration-300 tracking-wider uppercase"
              >
                @untamedbevs
              </a>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-untamed-white p-2"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-untamed-black/98 pt-20 px-6">
          <div className="flex flex-col items-center gap-8 pt-12">
            {drinks.map((drink) => (
              <Link
                key={drink.slug}
                href={`/drinks/${drink.slug}`}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-bold tracking-wider uppercase transition-colors duration-300"
                style={{ color: drink.color }}
              >
                {drink.name}
              </Link>
            ))}
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
