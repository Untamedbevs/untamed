'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Archive,
  CalendarClock,
  Camera,
  LayoutDashboard,
  Library,
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
  Map,
  MapPin,
  Sparkles,
  Compass,
  Eye,
  FileText,
  ListChecks,
  Gem,
  Crosshair,
  ClipboardCheck,
  Workflow,
  LayoutTemplate,
  Mail,
  Settings,
  Contact,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import './admin.css'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  children?: { href: string; label: string; icon: LucideIcon }[]
}

const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/loyalty', label: 'Loyalty', icon: Trophy },
  { href: '/admin/ugc', label: 'UGC', icon: Camera },
  { href: '/admin/referrals', label: 'Referrals', icon: Share2 },
  { href: '/referral-hq', label: 'Referral HQ', icon: Compass },
  { href: '/admin/view-as', label: 'View As', icon: Eye },
  {
    href: '/admin/rewards',
    label: 'Rewards Program',
    icon: Gem,
    children: [
      { href: '/admin/rewards', label: 'Trail & Rewards', icon: Gem },
      { href: '/admin/promotions', label: 'Hunts', icon: Crosshair },
      { href: '/admin/promotions/review', label: 'Review queue', icon: ClipboardCheck },
    ],
  },
  {
    href: '/admin/retail',
    label: 'Retail Leads',
    icon: Building2,
    children: [
      { href: '/admin/retail', label: 'Workbench', icon: Building2 },
      { href: '/admin/retail/locations', label: 'Locations', icon: MapPin },
      { href: '/admin/retail/performance', label: 'Performance', icon: BarChart3 },
      { href: '/admin/retail/ads', label: 'Meta Ads', icon: Megaphone },
      { href: '/admin/retail/utm-builder', label: 'UTM Builder', icon: Link2 },
    ],
  },
  { href: '/admin/influencers', label: 'Creators', icon: Sparkles },
  {
    href: '/admin/crm',
    label: 'CRM',
    icon: MessageSquare,
    children: [
      { href: '/admin/crm/blast', label: 'Email Blast', icon: Send },
      { href: '/admin/crm/campaigns', label: 'Campaigns', icon: ListChecks },
      { href: '/admin/crm/templates', label: 'Templates', icon: FileText },
      { href: '/admin/crm/segments', label: 'Segments', icon: Users },
      { href: '/admin/crm/email', label: 'Email Dashboard', icon: BarChart3 },
      { href: '/admin/crm/contacts', label: 'Contacts', icon: Contact },
      { href: '/admin/crm/email/flows', label: 'Automated Flows', icon: Workflow },
      { href: '/admin/crm/email/templates', label: 'Flow Designs', icon: LayoutTemplate },
      { href: '/admin/crm/outreach', label: 'Outreach', icon: Mail },
      { href: '/admin/crm/email/settings', label: 'Email Settings', icon: Settings },
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
]

const SUPER_ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/staff', label: 'Staff', icon: Users },
]

/** Reference material and brand assets, grouped so they stay out of the day-to-day tabs. Fonts is for super admins. */
function libraryItem(role: string | undefined): NavItem {
  return {
    href: '/admin/library',
    label: 'Library',
    icon: Library,
    children: [
      { href: '/admin/media', label: 'Media', icon: Image },
      { href: '/brand-kit', label: 'Brand Kit', icon: Palette },
      { href: '/admin/owners', label: 'Owner Guide', icon: Map },
      { href: '/admin/handbook', label: 'Handbook', icon: BookOpen },
      ...(role === 'super_admin' ? [{ href: '/admin/fonts', label: 'Fonts', icon: Type }] : []),
    ],
  }
}

/** Tabs set aside to keep the sidebar short. Their pages still work; this group always sits last. */
const ARCHIVE_ITEM: NavItem = {
  href: '/admin/archive',
  label: 'Archive',
  icon: Archive,
  children: [
    { href: '/admin/ideas', label: 'Ideas', icon: Lightbulb },
    { href: '/admin/flows', label: 'Flows', icon: Layers },
    { href: '/admin/studio', label: 'Studio', icon: Wand2 },
    { href: '/admin/schedule', label: 'Schedule', icon: CalendarClock },
    { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  ],
}

const RESTRICTED_PATHS = ['/admin/loyalty', '/admin/ugc', '/admin/financial', '/admin/crm/contacts', '/admin/crm/outreach', '/admin/crm/email/settings']

/** Admins and super admins only (not contractors). */
const ADMIN_ONLY_PATHS = ['/admin/view-as', '/admin/rewards']

function getNavItems(role: string | undefined): NavItem[] {
  let items = ALL_NAV_ITEMS
  if (role !== 'admin' && role !== 'super_admin') {
    items = items.filter((item) => !ADMIN_ONLY_PATHS.includes(item.href))
  }
  if (role === 'contractor_limited') {
    const allowed = (href: string) => !RESTRICTED_PATHS.some((p) => href.startsWith(p))
    items = items
      .filter((item) => allowed(item.href))
      .map((item) =>
        item.children ? { ...item, children: item.children.filter((c) => allowed(c.href)) } : item
      )
  }
  if (role === 'super_admin') {
    items = [...items, ...SUPER_ADMIN_ITEMS]
  }
  return [...items, libraryItem(role), ARCHIVE_ITEM]
}

/** Whether a path is this href or a page under it (so /admin/crm/blast/123 is under /admin/crm/blast, but /admin/referral-hq is not under /admin/referrals). */
function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** A tab is current on its own page; a group is current on any of its pages, even ones outside its own path (Hunts, Library, Archive). */
function isCurrent(item: NavItem, pathname: string): boolean {
  if (item.href === '/admin') return pathname === '/admin'
  return isUnder(pathname, item.href) || (item.children ?? []).some((child) => isUnder(pathname, child.href))
}

/** The group's page that's open: the most specific match, so Review queue wins over Hunts on /admin/promotions/review. */
function currentChild(item: NavItem, pathname: string): string | null {
  const matches = (item.children ?? []).filter((child) => isUnder(pathname, child.href))
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
}

const COLLAPSED_KEY = 'ut-admin-sidebar-collapsed'
const TAB_CLASS = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200'
const IDLE_CLASS = 'text-[#A0A0A0] hover:text-white hover:bg-white/5'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Groups the user has opened. The group holding the current page opens on arrival, and any group can be closed.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  const [staff, setStaff] = useState<{ full_name: string; role: string } | null>(null)
  // Until the role is known, the nav shows placeholders rather than a list missing the admin-only tabs.
  const [staffLoaded, setStaffLoaded] = useState(false)
  const onLogin = pathname === '/admin/login'
  const role = staff?.role

  // This layout stays mounted from the login page into the admin, so the role is
  // loaded again whenever the session changes, not just once on mount.
  useEffect(() => {
    const supabase = createClient()
    let current = true
    async function loadStaff() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = user
        ? await supabase.from('staff').select('full_name, role').eq('auth_user_id', user.id).maybeSingle()
        : { data: null }
      if (!current) return
      setStaff(data ?? null)
      setStaffLoaded(true)
    }
    if (!onLogin) loadStaff()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Supabase calls made inside this callback can deadlock, so load on the next tick.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(loadStaff, 0)
    })
    return () => {
      current = false
      subscription.unsubscribe()
    }
  }, [onLogin])

  // Remember the collapsed sidebar between visits (read after mount so server and client render the same).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1')
    } catch {}
  }, [])

  // Arriving on a page opens its group and closes the phone drawer.
  useEffect(() => {
    setMobileOpen(false)
    const group = getNavItems(role).find((item) => item.children && isCurrent(item, pathname))
    if (group) setOpenGroups((open) => (open.has(group.href) ? open : new Set(open).add(group.href)))
  }, [pathname, role])

  // Escape closes the phone drawer.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function setCollapsedSaved(next: boolean) {
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {}
  }

  function toggleGroup(href: string) {
    setOpenGroups((open) => {
      const next = new Set(open)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  if (onLogin) {
    return <>{children}</>
  }

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    contractor: 'Contractor',
    contractor_full: 'Contractor',
    contractor_limited: 'Contractor (Limited)',
  }

  const NAV_ITEMS = getNavItems(role)
  const archived = ARCHIVE_ITEM.children!.some((child) => isUnder(pathname, child.href))
  // The phone drawer always opens full width, even if the desktop sidebar is collapsed.
  const compact = collapsed && !mobileOpen

  return (
    <div className="isolate min-h-screen bg-[#0A0A0A] flex overflow-x-hidden">
      <div aria-hidden className="ad-aurora" />
      <div aria-hidden className="ad-grain" />
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'ad-sidebar fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300',
          compact ? 'w-[68px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn(
          'ad-divider flex items-center border-b h-16 px-4',
          compact ? 'justify-center' : 'justify-between'
        )}>
          {!compact && (
            <Link href="/admin" className="ad-title font-headline text-lg font-bold uppercase tracking-wider">
              Untamed
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsedSaved(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-white/5 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="lg:hidden text-[#A0A0A0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto py-4 space-y-1 px-2">
          {!staffLoaded && Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
          {staffLoaded && NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isCurrent(item, pathname)

            if (item.children?.length) {
              const open = openGroups.has(item.href)
              const panelId = `nav-group-${item.label.toLowerCase().replace(/\W+/g, '-')}`

              // Collapsed sidebar: the group icon widens the sidebar with that group open.
              if (compact) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      setCollapsedSaved(false)
                      setOpenGroups((groups) => new Set(groups).add(item.href))
                    }}
                    title={item.label}
                    aria-label={`Open ${item.label}`}
                    className={cn(TAB_CLASS, 'w-full justify-center px-0', active ? 'ad-nav-active' : IDLE_CLASS)}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                  </button>
                )
              }

              const childHref = currentChild(item, pathname)
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.href)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className={cn(TAB_CLASS, 'w-full text-left', active ? 'ad-nav-active' : IDLE_CLASS)}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronDown
                      className={cn('w-3.5 h-3.5 shrink-0 transition-transform duration-200', !open && '-rotate-90')}
                    />
                  </button>
                  {open && (
                    <div id={panelId} className="ad-divider mt-1 ml-3 pl-4 border-l space-y-0.5">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            aria-current={child.href === childHref ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                              child.href === childHref ? 'ad-nav-child-active' : IDLE_CLASS
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
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(TAB_CLASS, active ? 'ad-nav-active' : IDLE_CLASS, compact && 'justify-center px-0')}
                title={compact ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!compact && item.label}
              </Link>
            )
          })}
        </nav>

        <div className={cn(
          'ad-divider border-t p-4',
          compact && 'flex flex-col items-center px-2'
        )}>
          {staff && !compact && (
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
            type="button"
            onClick={handleSignOut}
            className={cn(
              'flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-red-400 transition-colors',
              compact && 'justify-center'
            )}
            title={compact ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4" />
            {!compact && 'Sign Out'}
          </button>
        </div>
      </aside>

      <div className={cn(
        'flex-1 min-w-0',
        collapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
      )}>
        <header className="ad-header sticky top-0 z-30 h-16 flex items-center px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="lg:hidden mr-4 text-[#A0A0A0] hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="ad-title text-lg font-semibold uppercase tracking-wider">
            {[...ALL_NAV_ITEMS, ...SUPER_ADMIN_ITEMS, libraryItem('super_admin'), ARCHIVE_ITEM].find((item) => isCurrent(item, pathname))?.label || 'Admin'}
          </h2>
        </header>
        {/* Archived tabs keep their original look. */}
        <main className={cn('p-4 lg:p-6', !archived && 'ad-skin')}>{children}</main>
      </div>
    </div>
  )
}
