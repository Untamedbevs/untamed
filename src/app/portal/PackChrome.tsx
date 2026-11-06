'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Camera,
  Crosshair,
  Eye,
  Home,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { WELCOMED_COOKIE } from '@/lib/rewards/welcome'
import '@/components/rewards/portal.css'

type NavItem = { href: string; label: string; icon: LucideIcon; external?: boolean; reload?: boolean }

const TABS: NavItem[] = [
  // Switching to the dashboard in-app can stall the router, so Home always loads the page fresh.
  { href: '/portal', label: 'Home', icon: Home, reload: true },
  { href: '/portal/hunts', label: 'Hunts', icon: Crosshair },
  { href: '/portal/rewards', label: 'Rewards', icon: Trophy },
  { href: '/portal/orders', label: 'Orders', icon: Package },
  { href: '/portal/referrals', label: 'Pack', icon: Users },
]

const MORE: NavItem[] = [
  { href: '/portal/ugc', label: 'My moments', icon: Camera },
  { href: '/portal/receipts', label: 'Receipts', icon: Receipt },
  { href: '/portal/account', label: 'Account', icon: Settings },
  // Full page load so the AccelPay buy buttons attach.
  { href: '/shop', label: 'Shop Untamed', icon: ShoppingBag, external: true },
]

/** A tab: an in-app link, or a full page load for tabs marked `reload`. */
function TabLink({ item, ...props }: { item: NavItem } & Omit<React.ComponentProps<'a'>, 'href'>) {
  return item.reload ? <a href={item.href} {...props} /> : <Link href={item.href} {...props} />
}

/** Pages that bring their own full-screen design. */
const BARE_PATHS = ['/portal/login', '/portal/auth', '/portal/welcome']


/**
 * The Pack Rewards portal chrome: a floating glass bar on desktop, a bottom
 * tab bar on phones, and an aurora backdrop tinted by the member's spirit
 * animal.
 */
export function PackChrome({
  children,
  firstName,
  email,
  spirit,
  viewAs,
}: {
  children: React.ReactNode
  firstName: string | null
  email: string
  spirit: { name: string; color: string; art: string; habitat: string } | null
  viewAs: { mode: string; adminEmail: string } | null
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const accent = spirit?.color ?? '#9B30FF'

  useEffect(() => setMenuOpen(false), [pathname])

  if (BARE_PATHS.some((p) => pathname.startsWith(p))) return <>{children}</>

  const isActive = (href: string) => (href === '/portal' ? pathname === '/portal' : pathname.startsWith(href))

  async function signOut() {
    document.cookie = `${WELCOMED_COOKIE}=; path=/; max-age=0`
    await createClient().auth.signOut()
    window.location.href = '/portal/login'
  }

  async function exitViewAs() {
    const res = await fetch('/api/admin/view-as', { method: 'DELETE' }).catch(() => null)
    const data = await res?.json().catch(() => null)
    window.location.href = data?.redirectTo || '/admin/view-as'
  }

  const bare = pathname.startsWith('/portal/setup-password')

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#050507] text-white" style={{ ['--pk-accent' as string]: accent }}>
      <div className="pk-aurora" />
      {spirit && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[70vh] overflow-hidden">
          <Image src={spirit.habitat} alt="" fill sizes="100vw" priority className="object-cover object-top opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050507]/30 via-[#050507]/70 to-[#050507]" />
        </div>
      )}
      <div className="pk-grain" />

      {viewAs && (
        <div className="relative z-50 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#FFD700]/30 bg-[#2A2410]/90 px-4 py-2 text-sm text-[#FFE680] backdrop-blur lg:px-6">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="min-w-0">
            Viewing as <strong className="text-white">{firstName || email}</strong>
            <span className="text-[#FFE680]/70"> ({email})</span> · Pack Rewards preview · read-only
          </span>
          <button onClick={exitViewAs} className="ml-auto rounded-full border border-[#FFD700]/40 px-3 py-1 text-xs font-semibold text-white hover:bg-[#FFD700]/10">
            Exit View As
          </button>
        </div>
      )}

      {!bare && (
        <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
          {menuOpen && (
            <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
          )}
          <div className="pk-glass relative z-50 mx-auto flex h-16 max-w-6xl items-center gap-3 rounded-full px-3 sm:px-4">
            <a href="/portal" className="flex shrink-0 items-center gap-2">
              <span className="relative flex h-10 w-10 items-center justify-center">
                <span className="pk-ring absolute inset-0 rounded-full opacity-70 blur-[6px]" />
                <span className="absolute inset-[2px] rounded-full bg-black" />
                <Image src="/images/logo-mark.png" alt="Untamed" width={26} height={26} className="relative object-contain" />
              </span>
              <span className="hidden font-headline text-lg uppercase tracking-wider sm:inline">Untamed</span>
            </a>

            <nav className="mx-auto hidden items-center gap-1 lg:flex">
              {TABS.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <TabLink
                    key={item.href}
                    item={item}
                    className={cn(
                      'relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300',
                      active ? 'text-black' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    )}
                    style={active ? { background: `linear-gradient(100deg, ${accent}, #FFD700)`, boxShadow: `0 8px 30px -8px ${accent}` } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </TabLink>
                )
              })}
            </nav>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="ml-auto flex items-center gap-2 rounded-full py-1 pl-3 pr-1 transition-colors hover:bg-white/5 lg:ml-0"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <span className="hidden max-w-[9rem] truncate text-sm font-medium text-white/80 sm:inline">{firstName || email.split('@')[0]}</span>
              <span className="relative flex h-10 w-10 items-center justify-center">
                <span className="pk-ring absolute inset-0 rounded-full" />
                <span className="absolute inset-[2px] overflow-hidden rounded-full bg-black">
                  {spirit ? (
                    <Image src={spirit.art} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-headline text-lg">
                      {(firstName || email)[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
            </button>
            {menuOpen && (
                  <div className="pk-glass pk-solid rw-rise absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden p-2">
                    <div className="flex items-center justify-between px-3 pb-2 pt-1">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{firstName || 'Pack member'}</div>
                        <div className="truncate text-xs text-white/50">{spirit ? `${spirit.name} pack` : email}</div>
                      </div>
                      <button onClick={() => setMenuOpen(false)} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {MORE.map((item) => {
                      const Icon = item.icon
                      const cls = 'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white'
                      return item.external ? (
                        <a key={item.href} href={item.href} className={cls}>
                          <Icon className="h-4 w-4" style={{ color: accent }} />
                          {item.label}
                        </a>
                      ) : (
                        <Link key={item.href} href={item.href} className={cls}>
                          <Icon className="h-4 w-4" style={{ color: accent }} />
                          {item.label}
                        </Link>
                      )
                    })}
                    <div className="my-1 h-px bg-white/10" />
                    {viewAs ? (
                      <button onClick={exitViewAs} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-[#FFD700] hover:bg-white/10">
                        <Eye className="h-4 w-4" /> Exit View As
                      </button>
                    ) : (
                      <button onClick={signOut} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-red-300">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    )}
                  </div>
            )}
          </div>

        </header>
      )}

      <main className={cn('pk-skin relative z-10 mx-auto max-w-6xl px-4 sm:px-6', bare ? 'flex min-h-[100dvh] items-center justify-center py-10' : 'pb-32 pt-6 lg:pb-16')}>
        {viewAs && pathname.startsWith('/portal/account') ? (
          <div className="pk-glass max-w-xl p-6 text-sm text-white/70">
            Account settings are hidden in View As. This member signs in as <span className="text-white">{email}</span>.
          </div>
        ) : (
          children
        )}
      </main>

      {!bare && (
        <nav className="pk-tabbar fixed inset-x-0 bottom-0 z-40 px-3 lg:hidden">
          <div className="pk-glass mx-auto flex max-w-md items-stretch justify-between rounded-[26px] bg-black/60 px-1.5 py-1.5">
            {TABS.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <TabLink
                  key={item.href}
                  item={item}
                  className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors"
                  style={active ? { color: '#fff', background: `${accent}2E` } : { color: 'rgba(255,255,255,0.55)' }}
                >
                  <Icon className={cn('h-5 w-5 transition-transform duration-300', active && '-translate-y-0.5 scale-110')} style={active ? { color: accent, filter: `drop-shadow(0 0 8px ${accent})` } : undefined} />
                  {item.label}
                </TabLink>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
