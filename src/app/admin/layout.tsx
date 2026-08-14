'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  CalendarClock,
  Camera,
  LayoutDashboard,
  Lightbulb,
  Image,
  Layers,
  Megaphone,
  Wand2,
  Trophy,
  DollarSign,
  Calculator,
  ClipboardList,
  Target,
  Type,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Users,
  Share2,
  Building2,
  MessageSquare,
  Send,
  Palette,
  BookOpen,
  Link2,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  children?: { href: string; label: string; icon: LucideIcon }[]
}

const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/admin/media', label: 'Media', icon: Image },
  { href: '/admin/flows', label: 'Flows', icon: Layers },
  { href: '/admin/studio', label: 'Studio', icon: Wand2 },
  { href: '/admin/schedule', label: 'Schedule', icon: CalendarClock },
  { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/admin/loyalty', label: 'Loyalty', icon: Trophy },
  { href: '/admin/ugc', label: 'UGC', icon: Camera },
  { href: '/admin/referrals', label: 'Referrals', icon: Share2 },
  {
    href: '/admin/retail',
    label: 'Retail Leads',
    icon: Building2,
    children: [
      { href: '/admin/retail', label: 'Workbench', icon: Building2 },
      { href: '/admin/retail/performance', label: 'Performance', icon: BarChart3 },
      { href: '/admin/retail/utm-builder', label: 'UTM Builder', icon: Link2 },
    ],
  },
  {
    href: '/admin/crm',
    label: 'CRM',
    icon: MessageSquare,
    children: [
      { href: '/admin/crm/blast', label: 'Email Blast', icon: Send },
    ],
  },
  {
    href: '/admin/financial',
    label: 'Financial',
    icon: DollarSign,
    children: [
      { href: '/admin/financial/beverage-estimator', label: 'Cost Estimator', icon: Calculator },
      { href: '/admin/financial/product-procurement', label: 'Procurement', icon: ClipboardList },
      { href: '/admin/financial/competitive-pricing', label: 'Competitive Pricing', icon: Target },
    ],
  },
  { href: '/brand-kit', label: 'Brand Kit', icon: Palette },
  { href: '/admin/handbook', label: 'Handbook', icon: BookOpen },
]

const SUPER_ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/staff', label: 'Staff', icon: Users },
  { href: '/admin/fonts', label: 'Fonts', icon: Type },
]

const RESTRICTED_PATHS = ['/admin/loyalty', '/admin/ugc', '/admin/financial']

function getNavItems(role: string | undefined): NavItem[] {
  let items = ALL_NAV_ITEMS
  if (role === 'contractor_limited') {
    items = items.filter(
      (item) => !RESTRICTED_PATHS.some((p) => item.href.startsWith(p))
    )
  }
  if (role === 'super_admin') {
    items = [...items, ...SUPER_ADMIN_ITEMS]
  }
  return items
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [staff, setStaff] = useState<{ full_name: string; role: string } | null>(null)

  useEffect(() => {
    async function loadStaff() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('staff')
          .select('full_name, role')
          .eq('auth_user_id', user.id)
          .single()
        if (data) setStaff(data)
      }
    }
    loadStaff()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    contractor: 'Contractor',
    contractor_full: 'Contractor',
    contractor_limited: 'Contractor (Limited)',
  }

  const NAV_ITEMS = getNavItems(staff?.role)

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
        <div className={cn(
          'flex items-center border-b border-[#2A2A2A] h-16 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <Link href="/admin" className="font-headline text-lg font-bold uppercase tracking-wider text-white">
              Untamed
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-[#A0A0A0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const hasChildren = item.children && item.children.length > 0
            const childrenExpanded = active && hasChildren

            if (hasChildren && !collapsed) {
              return (
                <div key={item.href}>
                  <Link
                    href={item.children![0].href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full',
                      active
                        ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                        : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
                        !childrenExpanded && '-rotate-90'
                      )}
                    />
                  </Link>
                  {childrenExpanded && (
                    <div className="mt-1 ml-3 pl-4 border-l border-[#2A2A2A] space-y-0.5">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon
                        const childActive = pathname === child.href
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                              childActive
                                ? 'text-[#9B30FF] bg-[#9B30FF]/10'
                                : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
                            )}
                          >
                            <ChildIcon className="w-4 h-4 shrink-0" />
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={hasChildren ? item.children![0].href : item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        <div className={cn(
          'border-t border-[#2A2A2A] p-4',
          collapsed && 'flex flex-col items-center px-2'
        )}>
          {staff && !collapsed && (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#A0A0A0]" />
                <span className="text-sm text-white truncate">{staff.full_name}</span>
              </div>
              <span className="text-xs text-[#666] ml-6">
                {roleLabel[staff.role] || staff.role}
              </span>
            </div>
          )}
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
        </div>
      </aside>

      <div className={cn(
        'flex-1 min-w-0',
        collapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
      )}>
        <header className="sticky top-0 z-30 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#2A2A2A] h-16 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden mr-4 text-[#A0A0A0] hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold uppercase tracking-wider text-white">
            {ALL_NAV_ITEMS.find((item) => isActive(item.href))?.label || 'Admin'}
          </h2>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
