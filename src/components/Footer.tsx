'use client'

import Link from 'next/link'
import { Instagram } from 'lucide-react'
import { drinks } from '@/lib/drinks'

export function Footer() {
  return (
    <footer className="bg-untamed-black border-t border-card-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <span className="font-[var(--font-oswald)] text-3xl font-bold tracking-wider uppercase">
                <span className="text-untamed-white">UNT</span>
                <span className="text-panther-light">/</span>
                <span className="text-untamed-white">MED</span>
              </span>
            </Link>
            <p className="text-untamed-white-muted text-sm leading-relaxed mb-4">
              Premium ready-to-drink vodka martinis. Get in touch with your wild side.
            </p>
            <a
              href="https://instagram.com/untamedbevs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-untamed-white-muted hover:text-untamed-white transition-colors duration-300"
            >
              <Instagram className="w-5 h-5" />
              <span className="text-sm">@untamedbevs</span>
            </a>
          </div>

          {/* Drinks */}
          <div>
            <h3 className="text-untamed-white font-semibold uppercase tracking-wider text-sm mb-4">
              Our Drinks
            </h3>
            <div className="flex flex-col gap-3">
              {drinks.map((drink) => (
                <Link
                  key={drink.slug}
                  href={`/drinks/${drink.slug}`}
                  className="text-sm transition-colors duration-300"
                  style={{ color: drink.color }}
                >
                  {drink.name} &mdash; {drink.flavor}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-untamed-white font-semibold uppercase tracking-wider text-sm mb-4">
              Legal
            </h3>
            <div className="flex flex-col gap-3 text-sm text-untamed-white-muted">
              <p>Must be 21+ to purchase.</p>
              <p>15% ALC./VOL.</p>
              <p>Always drink responsibly.</p>
              <a
                href="https://www.responsibility.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-untamed-white transition-colors duration-300 underline underline-offset-2"
              >
                Responsibility.org
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-card-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-untamed-white-muted/60 text-xs text-center md:text-left">
              &copy; {new Date().getFullYear()} Untamed Beverages, LLC &bull; Parrish, FL 34219 &bull; USA
            </p>
            <p className="text-untamed-white-muted/40 text-xs text-center max-w-lg">
              GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages
              during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs
              your ability to drive a car or operate machinery, and may cause health problems.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
