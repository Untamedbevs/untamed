'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { drinks } from '@/lib/drinks'

export function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'glass shadow-lg shadow-black/20'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-1 group">
              <span className="font-[var(--font-oswald)] text-2xl md:text-3xl font-bold tracking-wider uppercase">
                <span className="text-untamed-white group-hover:text-panther-light transition-colors duration-300">
                  UNT
                </span>
                <span className="text-panther-light">/</span>
                <span className="text-untamed-white group-hover:text-panther-light transition-colors duration-300">
                  MED
                </span>
              </span>
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
      </motion.nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-0 z-40 bg-untamed-black/98 pt-20 px-6"
        >
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
        </motion.div>
      )}
    </>
  )
}
