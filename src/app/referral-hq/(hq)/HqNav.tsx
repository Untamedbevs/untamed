'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/referral-hq', label: 'My Territory' },
  { href: '/referral-hq/blueprint', label: 'Program Blueprint' },
]

export function HqNav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
              active
                ? 'bg-[#9B30FF]/15 text-[#C89BFF] border border-[#9B30FF]/40'
                : 'text-[#A0A0A0] hover:text-white border border-transparent'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
