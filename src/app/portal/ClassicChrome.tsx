'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Share2,
  ShoppingBag,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** From /api/portal/view-as while an admin views the portal as a member. */
type ViewAsStatus = {
  active: true
  mode: 'current' | 'pack-rewards'
  adminEmail: string
  member: { email: string; firstName: string | null }
}

type PortalStatus = ViewAsStatus | { active: false; packRewards: boolean }

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Links out to the public storefront rather than a portal-chrome page. */
  external?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/shop', label: 'Shop', icon: ShoppingBag, external: true },
  { href: '/portal/ugc', label: 'My UGC', icon: Camera },
  { href: '/portal/receipts', label: 'Receipts', icon: Receipt },
  { href: '/portal/rewards', label: 'Rewards', icon: Trophy },
  { href: '/portal/referrals', label: 'Referrals', icon: Share2 },
  { href: '/portal/account', label: 'Account', icon: Settings },
]

/** Pack Rewards pages, shown while the program runs as a staff preview. */
const HUNTS_ITEM: NavItem = { href: '/portal/hunts', label: 'Hunts', icon: Crosshair }

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [viewAs, setViewAs] = useState<ViewAsStatus | null>(null)
  const [packRewards, setPackRewards] = useState(false)

  useEffect(() => {
    async function loadUser() {
      // An admin in View As sees the member's name, not their own.
      const status = (await fetch('/api/portal/view-as')
        .then((res) => res.json())
        .catch(() => null)) as PortalStatus | null
      setPackRewards(status?.active ? status.mode === 'pack-rewards' : !!status?.packRewards)
      if (status?.active) {
        setViewAs(status)
        setEmail(status.member.email)
        setFirstName(status.member.firstName)
        return
      }
      setViewAs(null)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || null)

      const { data } = await supabase
        .from('loyalty_members')
        .select('first_name')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (data?.first_name) setFirstName(data.first_name)
    }
    loadUser()
  }, [pathname])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/portal/login')
    router.refresh()
  }

  async function handleExitViewAs() {
    const res = await fetch('/api/admin/view-as', { method: 'DELETE' }).catch(() => null)
    const data = await res?.json().catch(() => null)
    window.location.href = data?.redirectTo || '/admin/view-as'
  }

  if (
    pathname === '/portal/login' ||
    pathname.startsWith('/portal/auth')
  ) {
    return <>{children}</>
  }

  function isActive(href: string) {
    if (href === '/portal') return pathname === '/portal'
    return pathname.startsWith(href)
  }

  // Hunts sits right after Rewards.
  const navItems = packRewards ? [...NAV_ITEMS.slice(0, 5), HUNTS_ITEM, ...NAV_ITEMS.slice(5)] : NAV_ITEMS

  const currentLabel =
    navItems.find((i) => isActive(i.href))?.label || 'Member Portal'

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex overflow-x-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full bg-[#111] border-r border-[#2A2A2A] z-50 flex flex-col transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-[#2A2A2A] h-16 px-4',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {!collapsed && (
            <Link
              href="/portal"
              className="font-headline text-lg font-bold uppercase tracking-wider text-white"
            >
              Untamed
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-[#A0A0A0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const className = cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              active
                ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]',
              collapsed && 'justify-center px-0'
            )
            const content = (
              <>
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && item.label}
              </>
            )

            // External items (e.g. the storefront) must do a full page load so
            // the AccelPay buy-button embeds attach — they only render on a
            // hard navigation, not Next.js client-side routing.
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={className}
                  title={collapsed ? item.label : undefined}
                >
                  {content}
                </a>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={className}
                title={collapsed ? item.label : undefined}
              >
                {content}
              </Link>
            )
          })}
        </nav>

        <div
          className={cn(
            'border-t border-[#2A2A2A] p-4',
            collapsed && 'flex flex-col items-center px-2'
          )}
        >
          {!collapsed && email && (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#A0A0A0]" />
                <span className="text-sm text-white truncate">
                  {firstName || email.split('@')[0]}
                </span>
              </div>
              <span className="text-xs text-[#666] ml-6 truncate block max-w-[180px]">
                {email}
              </span>
            </div>
          )}
          {viewAs ? (
            <button
              onClick={handleExitViewAs}
              className={cn(
                'flex items-center gap-2 text-sm text-[#FFD700] hover:text-white transition-colors',
                collapsed && 'justify-center'
              )}
              title={collapsed ? 'Exit View As' : undefined}
            >
              <Eye className="w-4 h-4" />
              {!collapsed && 'Exit View As'}
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className={cn(
                'flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-red-400 transition-colors',
                collapsed && 'justify-center'
              )}
              title={collapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && 'Sign Out'}
            </button>
          )}
        </div>
      </aside>

      <div
        className={cn(
          'flex-1 min-w-0',
          collapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
        )}
      >
        {viewAs && (
          <div className="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#FFD700]/30 bg-[#2A2410] px-4 py-2 text-sm text-[#FFE680] lg:px-6">
            <Eye className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              Viewing as <strong className="text-white">{viewAs.member.firstName || viewAs.member.email}</strong>
              <span className="text-[#FFE680]/70"> ({viewAs.member.email})</span>
              {' · '}
              {viewAs.mode === 'pack-rewards' ? 'Pack Rewards preview' : 'their current portal'} · read-only
            </span>
            <button
              onClick={handleExitViewAs}
              className="ml-auto rounded-full border border-[#FFD700]/40 px-3 py-1 text-xs font-semibold text-white hover:bg-[#FFD700]/10"
            >
              Exit View As
            </button>
          </div>
        )}
        <header className="sticky top-0 z-30 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#2A2A2A] h-16 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden mr-4 text-[#A0A0A0] hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold uppercase tracking-wider text-white">
            {currentLabel}
          </h2>
        </header>
        <main className="p-4 lg:p-6">
          {viewAs && pathname.startsWith('/portal/account') ? (
            // Password and sign-in settings belong to whoever is signed in (the admin), so they stay hidden.
            <div className="max-w-xl rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 text-sm text-[#A0A0A0]">
              Account settings are hidden in View As. This member signs in as{' '}
              <span className="text-white">{viewAs.member.email}</span>.
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
