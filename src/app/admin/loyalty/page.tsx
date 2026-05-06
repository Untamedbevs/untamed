'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Receipt,
  BarChart3,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Trophy,
  Eye,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { drinks } from '@/lib/drinks'

type Tab = 'members' | 'receipts' | 'analytics'

interface Member {
  id: string
  email: string
  first_name: string | null
  favorite_drink_slug: string | null
  points_balance: number
  first_utm_source: string | null
  first_utm_campaign: string | null
  total_scans: number
  created_at: string
}

interface ReceiptWithMember {
  id: string
  member_id: string
  image_url: string
  status: string
  points_awarded: number
  drink_slug: string | null
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  member: {
    id: string
    email: string
    first_name: string | null
    points_balance: number
  } | null
}

interface Analytics {
  totals: {
    visitors: number
    sessions: number
    members: number
    receipts: number
    pendingReceipts: number
    totalPointsIssued: number
  }
  sessionsBySource: Record<string, number>
  sessionsByCampaign: Record<string, number>
  membersByDrink: Record<string, number>
  membersBySource: Record<string, number>
  deviceBreakdown: Record<string, number>
}

const DRINK_COLORS: Record<string, string> = {
  'black-panther': '#9B30FF',
  cheetah: '#D4D700',
  cougar: '#6B8E23',
  lioness: '#FF8C2A',
}

export default function AdminLoyaltyPage() {
  const [tab, setTab] = useState<Tab>('members')
  const [members, setMembers] = useState<Member[]>([])
  const [receipts, setReceipts] = useState<ReceiptWithMember[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/loyalty/members?${params}`)
    const data = await res.json()
    setMembers(data.members || [])
  }, [search])

  const loadReceipts = useCallback(async () => {
    const res = await fetch('/api/admin/loyalty/receipts?status=all')
    const data = await res.json()
    setReceipts(data.receipts || [])
  }, [])

  const loadAnalytics = useCallback(async () => {
    const res = await fetch('/api/admin/loyalty/analytics')
    const data = await res.json()
    setAnalytics(data)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadMembers(), loadReceipts(), loadAnalytics()]).finally(() =>
      setLoading(false)
    )
  }, [loadMembers, loadReceipts, loadAnalytics])

  async function reviewReceipt(receiptId: string, action: 'approve' | 'reject') {
    setReviewingId(receiptId)
    await fetch('/api/admin/loyalty/receipts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptId, action }),
    })
    await Promise.all([loadReceipts(), loadMembers(), loadAnalytics()])
    setReviewingId(null)
  }

  const pendingReceipts = receipts.filter((r) => r.status === 'pending')

  const TABS = [
    { key: 'members' as Tab, label: 'Members', icon: Users, count: members.length },
    { key: 'receipts' as Tab, label: 'Receipts', icon: Receipt, count: pendingReceipts.length },
    { key: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
  ]

  function getDrinkColor(slug: string | null) {
    return slug ? DRINK_COLORS[slug] || '#666' : '#666'
  }

  function getDrinkName(slug: string | null) {
    if (!slug) return 'Unknown'
    return drinks.find((d) => d.slug === slug)?.name || slug
  }

  const DEVICE_ICONS: Record<string, typeof Monitor> = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#9B30FF]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-condensed text-2xl font-bold uppercase tracking-wider text-white">
          Loyalty Program
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#111] rounded-xl border border-[#2A2A2A]">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              tab === key
                ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count !== undefined && count > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-[#9B30FF]/20 text-[#9B30FF]">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadMembers()}
              className="w-full pl-11 pr-4 py-3 bg-[#111] border border-[#2A2A2A] rounded-xl text-white placeholder:text-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/50"
            />
          </div>

          {members.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No members yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-4 bg-[#111] border border-[#2A2A2A] rounded-xl"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{
                        backgroundColor: `${getDrinkColor(m.favorite_drink_slug)}20`,
                        color: getDrinkColor(m.favorite_drink_slug),
                      }}
                    >
                      {(m.first_name || m.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {m.first_name || 'No name'}{' '}
                        <span className="text-[#666]">{m.email}</span>
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[#666] mt-0.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{
                            backgroundColor: `${getDrinkColor(m.favorite_drink_slug)}15`,
                            color: getDrinkColor(m.favorite_drink_slug),
                          }}
                        >
                          {getDrinkName(m.favorite_drink_slug)}
                        </span>
                        {m.first_utm_source && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {m.first_utm_source}
                          </span>
                        )}
                        <span>
                          {new Date(m.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Trophy className="w-4 h-4 text-[#666]" />
                    <span className="text-white font-bold text-sm">{m.points_balance}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Receipts Tab */}
      {tab === 'receipts' && (
        <div className="space-y-4">
          {receipts.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No receipts submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    'p-4 bg-[#111] border rounded-xl',
                    r.status === 'pending'
                      ? 'border-yellow-500/30'
                      : r.status === 'approved'
                        ? 'border-green-500/20'
                        : 'border-red-500/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <a
                        href={r.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 rounded-lg bg-[#1A1A1A] border border-[#333] flex items-center justify-center shrink-0 hover:border-[#9B30FF]/50 transition-colors"
                      >
                        <Eye className="w-5 h-5 text-[#666]" />
                      </a>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {r.member?.first_name || r.member?.email || 'Unknown'}
                        </p>
                        <p className="text-[#666] text-xs">{r.member?.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {r.drink_slug && (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs"
                              style={{
                                backgroundColor: `${getDrinkColor(r.drink_slug)}15`,
                                color: getDrinkColor(r.drink_slug),
                              }}
                            >
                              {getDrinkName(r.drink_slug)}
                            </span>
                          )}
                          <span className="text-[#666] text-xs">
                            {new Date(r.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => reviewReceipt(r.id, 'approve')}
                            disabled={reviewingId === r.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            {reviewingId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => reviewReceipt(r.id, 'reject')}
                            disabled={reviewingId === r.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      ) : (
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            r.status === 'approved'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          )}
                        >
                          {r.status === 'approved'
                            ? `+${r.points_awarded} pts`
                            : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Visitors', value: analytics.totals.visitors },
              { label: 'Sessions', value: analytics.totals.sessions },
              { label: 'Members', value: analytics.totals.members },
              { label: 'Receipts', value: analytics.totals.receipts },
              { label: 'Pending', value: analytics.totals.pendingReceipts },
              { label: 'Points Issued', value: analytics.totals.totalPointsIssued },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-4 bg-[#111] border border-[#2A2A2A] rounded-xl text-center"
              >
                <p className="text-[#9B30FF] font-condensed text-2xl font-bold">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-[#666] text-xs uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Sessions by Source */}
          <div className="p-5 bg-[#111] border border-[#2A2A2A] rounded-xl">
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#9B30FF]" />
              Sessions by Source
            </h3>
            <div className="space-y-2">
              {Object.entries(analytics.sessionsBySource)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => {
                  const total = Object.values(analytics.sessionsBySource).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="text-[#999] text-sm w-24 truncate">{source}</span>
                      <div className="flex-1 h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#9B30FF]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-white text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Members by Drink + Device Breakdown side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-[#111] border border-[#2A2A2A] rounded-xl">
              <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                Members by Drink
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.membersByDrink)
                  .sort(([, a], [, b]) => b - a)
                  .map(([slug, count]) => (
                    <div key={slug} className="flex items-center justify-between">
                      <span
                        className="text-sm font-medium"
                        style={{ color: getDrinkColor(slug) }}
                      >
                        {getDrinkName(slug)}
                      </span>
                      <span className="text-white text-sm font-bold">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-5 bg-[#111] border border-[#2A2A2A] rounded-xl">
              <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                Device Breakdown
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.deviceBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([device, count]) => {
                    const Icon = DEVICE_ICONS[device] || Monitor
                    return (
                      <div key={device} className="flex items-center justify-between">
                        <span className="text-[#999] text-sm flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {device}
                        </span>
                        <span className="text-white text-sm font-bold">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Campaigns */}
          {Object.keys(analytics.sessionsByCampaign).length > 0 && (
            <div className="p-5 bg-[#111] border border-[#2A2A2A] rounded-xl">
              <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                Top Campaigns
              </h3>
              <div className="space-y-2">
                {Object.entries(analytics.sessionsByCampaign)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([campaign, count]) => (
                    <div key={campaign} className="flex items-center justify-between">
                      <span className="text-[#999] text-sm truncate">{campaign}</span>
                      <span className="text-white text-sm font-bold">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
