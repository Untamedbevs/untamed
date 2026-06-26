'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Instagram } from 'lucide-react'
import { drinks } from '@/lib/drinks'

export function Footer() {
  return (
    <footer className="bg-untamed-black border-t border-card-border">
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-12 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <Image
                src="/images/logo-mark.png"
                alt="Untamed Beverages"
                width={40}
                height={40}
                className="w-10 h-10"
              />
              <Image
                src="/images/logo-text.png"
                alt="Untamed Beverages"
                width={140}
                height={28}
                className="h-6 w-auto"
              />
            </Link>
            <p className="text-untamed-white-muted text-sm leading-relaxed mb-4">
              Premium ready-to-drink vodka martinis. 1 can. 2 martinis. $3 per cocktail.
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

          {/* Shop */}
          <div>
            <h3 className="text-untamed-white font-semibold uppercase tracking-wider text-sm mb-4">
              Shop
            </h3>
            <div className="flex flex-col gap-3">
              <a
                href="/shop"
                className="text-sm text-untamed-white font-medium hover:text-panther-light transition-colors duration-300 uppercase tracking-wider"
              >
                Shop All Flavors
              </a>
              {drinks.map((drink) => (
                <a
                  key={drink.slug}
                  href={`/drinks/${drink.slug}`}
                  className="font-wild cyber-brush-fix text-lg transition-colors duration-300"
                  style={{ color: drink.color }}
                >
                  {drink.name}
                </a>
              ))}
            </div>
          </div>

          {/* For Business */}
          <div>
            <h3 className="text-untamed-white font-semibold uppercase tracking-wider text-sm mb-4">
              Retail
            </h3>
            <div className="flex flex-col gap-3 text-sm text-untamed-white-muted">
              <Link href="/retail" className="hover:text-untamed-white transition-colors duration-300">
                Carry <span className="font-headline">Untamed</span>
              </Link>
              <Link href="/retail#retailers" className="hover:text-untamed-white transition-colors duration-300">
                For Retailers
              </Link>
              <Link href="/retail#on-premise" className="hover:text-untamed-white transition-colors duration-300">
                For Bars &amp; Restaurants
              </Link>
              <Link href="/retail#distributors" className="hover:text-untamed-white transition-colors duration-300">
                For Distributors
              </Link>
              <Link href="/referral" className="hover:text-untamed-white transition-colors duration-300">
                Referral Program
              </Link>
            </div>
          </div>

          {/* Rewards & Legal */}
          <div>
            <h3 className="text-untamed-white font-semibold uppercase tracking-wider text-sm mb-4">
              More
            </h3>
            <div className="flex flex-col gap-3 text-sm text-untamed-white-muted">
              <Link href="/about" className="hover:text-untamed-white transition-colors duration-300">
                Our Story
              </Link>
              <Link href="/rewards" className="hover:text-untamed-white transition-colors duration-300">
                Rewards Program
              </Link>
              <Link href="/referral" className="hover:text-untamed-white transition-colors duration-300">
                Refer a Friend
              </Link>
              <Link href="/brand-kit" className="hover:text-untamed-white transition-colors duration-300">
                Brand Kit
              </Link>
              <Link href="/contact" className="hover:text-untamed-white transition-colors duration-300">
                Contact Us
              </Link>
              <p className="mt-4 text-untamed-white-muted/60">Must be 21+ to purchase.</p>
              <p className="text-untamed-white-muted/60">15% ALC./VOL.</p>
              <p className="text-untamed-white-muted/60">Always drink responsibly.</p>
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
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-2 mb-6 text-xs text-untamed-white-muted/70">
            <Link href="/privacy" className="hover:text-untamed-white transition-colors duration-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-untamed-white transition-colors duration-300">
              Terms of Service
            </Link>
            <Link href="/unsubscribe" className="hover:text-untamed-white transition-colors duration-300">
              Email Preferences
            </Link>
            <Link href="/contact" className="hover:text-untamed-white transition-colors duration-300">
              Contact
            </Link>
          </div>
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
