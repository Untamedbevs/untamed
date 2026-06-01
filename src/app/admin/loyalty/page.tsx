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
  Gift,
  Minus,
  Plus,
  Pencil,
  X as XIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { drinks } from '@/lib/drinks'

type Tab = 'members' | 'receipts' | 'redemptions' | 'analytics'

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
  claimed_items: { drinkSlug: string; quantity: number }[] | null
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

interface RedemptionWithMember {
  id: string
  member_id: string
  reward_slug: string
  reward_label: string
  points_cost: number
  status: 'pending' | 'fulfilled' | 'cancelled'
  admin_notes: string | null
  fulfilled_at: string | null
  cancelled_at: string | null
  created_at: string
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
  const [redemptions, setRedemptions] = useState<RedemptionWithMember[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [actingRedemptionId, setActingRedemptionId] = useState<string | null>(null)
  const [customPointsByReceiptId, setCustomPointsByReceiptId] = useState<
    Record<string, number>
  >({})
  const [adjustingMember, setAdjustingMember] = useState<Member | null>(null)

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

  const loadRedemptions = useCallback(async () => {
    const res = await fetch('/api/admin/loyalty/redemptions?status=all')
    const data = await res.json()
    setRedemptions(data.redemptions || [])
  }, [])

  const loadAnalytics = useCallback(async () => {
    const res = await fetch('/api/admin/loyalty/analytics')
    const data = await res.json()
    setAnalytics(data)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadMembers(),
      loadReceipts(),
      loadRedemptions(),
      loadAnalytics(),
    ]).finally(() => setLoading(false))
  }, [loadMembers, loadReceipts, loadRedemptions, loadAnalytics])

  // Seed the custom-points editor with the suggested amount per pending
  // receipt whenever the receipts list refreshes. Existing edits are kept.
  useEffect(() => {
    setCustomPointsByReceiptId((prev) => {
      const next = { ...prev }
      for (const r of receipts) {
        if (r.status === 'pending' && next[r.id] === undefined) {
          next[r.id] = suggestedPoints(r)
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts])

  async function reviewReceipt(receiptId: string, action: 'approve' | 'reject') {
    setReviewingId(receiptId)
    const customPoints =
      action === 'approve' ? customPointsByReceiptId[receiptId] : undefined
    await fetch('/api/admin/loyalty/receipts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiptId,
        action,
        customPoints:
          typeof customPoints === 'number' && customPoints >= 0
            ? customPoints
            : undefined,
      }),
    })
    await Promise.all([loadReceipts(), loadMembers(), loadAnalytics()])
    setReviewingId(null)
  }

  async function reviewRedemption(redemptionId: string, action: 'fulfill' | 'cancel') {
    if (action === 'cancel') {
      if (!confirm('Cancel this redemption and refund the points?')) return
    }
    setActingRedemptionId(redemptionId)
    const res = await fetch('/api/admin/loyalty/redemptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: redemptionId, action }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.message || data.error || 'Action failed')
    }
    await Promise.all([loadRedemptions(), loadMembers()])
    setActingRedemptionId(null)
  }

  const pendingReceipts = receipts.filter((r) => r.status === 'pending')
  const pendingRedemptions = redemptions.filter((r) => r.status === 'pending')

  const TABS = [
    { key: 'members' as Tab, label: 'Members', icon: Users, count: members.length },
    { key: 'receipts' as Tab, label: 'Receipts', icon: Receipt, count: pendingReceipts.length },
    {
      key: 'redemptions' as Tab,
      label: 'Redemptions',
      icon: Gift,
      count: pendingRedemptions.length,
    },
    { key: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
  ]

  function getDrinkColor(slug: string | null) {
    return slug ? DRINK_COLORS[slug] || '#666' : '#666'
  }

  function getDrinkName(slug: string | null) {
    if (!slug) return 'Unknown'
    return drinks.find((d) => d.slug === slug)?.name || slug
  }

  function suggestedPoints(r: ReceiptWithMember): number {
    const totalUnits = (r.claimed_items || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    )
    return totalUnits > 0 ? totalUnits * 25 : 25
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
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-[#666]" />
                      <span className="text-white font-bold text-sm">{m.points_balance}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjustingMember(m)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#9B30FF]/10 text-[#C68BFF] hover:bg-[#9B30FF]/20 transition-colors"
                      title="Adjust points"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Adjust
                    </button>
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
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {r.claimed_items && r.claimed_items.length > 0 ? (
                            r.claimed_items.map((item) => (
                              <span
                                key={item.drinkSlug}
                                className="px-2 py-0.5 rounded-full text-xs"
                                style={{
                                  backgroundColor: `${getDrinkColor(item.drinkSlug)}15`,
                                  color: getDrinkColor(item.drinkSlug),
                                }}
                              >
                                {item.quantity}× {getDrinkName(item.drinkSlug)}
                              </span>
                            ))
                          ) : r.drink_slug ? (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs"
                              style={{
                                backgroundColor: `${getDrinkColor(r.drink_slug)}15`,
                                color: getDrinkColor(r.drink_slug),
                              }}
                            >
                              {getDrinkName(r.drink_slug)}
                            </span>
                          ) : null}
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
                          <div className="flex items-center gap-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-1.5 py-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCustomPointsByReceiptId((prev) => ({
                                  ...prev,
                                  [r.id]: Math.max(
                                    0,
                                    (prev[r.id] ?? suggestedPoints(r)) - 25
                                  ),
                                }))
                              }
                              disabled={reviewingId === r.id}
                              aria-label="Decrease points"
                              className="w-5 h-5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] flex items-center justify-center disabled:opacity-50"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100000}
                              value={
                                customPointsByReceiptId[r.id] ??
                                suggestedPoints(r)
                              }
                              onChange={(e) =>
                                setCustomPointsByReceiptId((prev) => ({
                                  ...prev,
                                  [r.id]: Math.max(
                                    0,
                                    Math.floor(Number(e.target.value) || 0)
                                  ),
                                }))
                              }
                              disabled={reviewingId === r.id}
                              aria-label="Points to award"
                              className="w-14 bg-transparent text-center text-white text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setCustomPointsByReceiptId((prev) => ({
                                  ...prev,
                                  [r.id]:
                                    (prev[r.id] ?? suggestedPoints(r)) + 25,
                                }))
                              }
                              disabled={reviewingId === r.id}
                              aria-label="Increase points"
                              className="w-5 h-5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] flex items-center justify-center disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
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

      {/* Redemptions Tab */}
      {tab === 'redemptions' && (
        <div className="space-y-4">
          {redemptions.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No redemptions yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    'p-4 bg-[#111] border rounded-xl',
                    r.status === 'pending'
                      ? 'border-yellow-500/30'
                      : r.status === 'fulfilled'
                        ? 'border-green-500/20'
                        : 'border-red-500/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-[#1A1A1A] border border-[#333] flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5 text-[#9B30FF]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">
                          {r.reward_label}
                        </p>
                        <p className="text-[#9B30FF] text-xs font-medium">
                          {r.points_cost.toLocaleString()} pts
                        </p>
                        <p className="text-[#A0A0A0] text-xs mt-1 truncate">
                          {r.member?.first_name || 'No name'}{' '}
                          <span className="text-[#666]">{r.member?.email}</span>
                        </p>
                        <p className="text-[#666] text-xs">
                          {new Date(r.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {r.member && (
                            <>
                              {' · '}
                              <span>
                                Balance: {r.member.points_balance.toLocaleString()} pts
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => reviewRedemption(r.id, 'fulfill')}
                            disabled={actingRedemptionId === r.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            {actingRedemptionId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Fulfill
                          </button>
                          <button
                            onClick={() => reviewRedemption(r.id, 'cancel')}
                            disabled={actingRedemptionId === r.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            r.status === 'fulfilled'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          )}
                        >
                          {r.status === 'fulfilled' ? 'Fulfilled' : 'Cancelled'}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.admin_notes && (
                    <p className="mt-2 text-xs text-[#A0A0A0] italic border-t border-[#2A2A2A] pt-2">
                      {r.admin_notes}
                    </p>
                  )}
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

      {adjustingMember && (
        <PointsAdjustModal
          member={adjustingMember}
          onClose={() => setAdjustingMember(null)}
          onSaved={async () => {
            setAdjustingMember(null)
            await Promise.all([loadMembers(), loadAnalytics()])
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual points adjustment modal
// ---------------------------------------------------------------------------
function PointsAdjustModal({
  member,
  onClose,
  onSaved,
}: {
  member: Member
  onClose: () => void
  onSaved: () => void
}) {
  const [delta, setDelta] = useState<number>(0)
  const [note, setNote] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const newBalance = member.points_balance + delta
  const wouldGoNegative = newBalance < 0
  const valid = delta !== 0 && note.trim().length > 0 && !wouldGoNegative

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setError('')

    const res = await fetch(`/api/admin/loyalty/members/${member.id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta, note: note.trim() }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.message || data.error || 'Adjustment failed')
      setSubmitting(false)
      return
    }

    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#141414] border border-[#2A2A2A] rounded-2xl max-w-md w-full p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-headline text-xl text-white mb-1">
              Adjust points
            </h3>
            <p className="text-sm text-[#A0A0A0]">
              {member.first_name || 'No name'}{' '}
              <span className="text-[#666]">{member.email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="text-[#A0A0A0] hover:text-white"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#A0A0A0]">Current balance</span>
            <span className="text-white font-semibold">
              {member.points_balance.toLocaleString()} pts
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDelta(delta - 25)}
              disabled={submitting}
              className="w-9 h-9 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-white flex items-center justify-center hover:border-red-400 hover:text-red-400 transition-colors"
              aria-label="Subtract 25"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              value={delta}
              onChange={(e) => setDelta(Math.trunc(Number(e.target.value) || 0))}
              disabled={submitting}
              autoFocus
              className="flex-1 bg-transparent border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-center text-white text-lg font-semibold focus:outline-none focus:border-[#9B30FF] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Delta points"
            />
            <button
              type="button"
              onClick={() => setDelta(delta + 25)}
              disabled={submitting}
              className="w-9 h-9 rounded-full bg-[#9B30FF]/15 border border-[#9B30FF]/30 text-[#C68BFF] flex items-center justify-center hover:bg-[#9B30FF]/25 transition-colors"
              aria-label="Add 25"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[-100, -25, 25, 100, 250].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setDelta(delta + step)}
                disabled={submitting}
                className="px-2.5 py-1 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] text-xs hover:border-[#9B30FF] hover:text-white transition-colors"
              >
                {step > 0 ? `+${step}` : step}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDelta(0)}
              disabled={submitting}
              className="px-2.5 py-1 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#666] text-xs hover:text-white"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-[#2A2A2A] pt-3 text-sm">
            <span className="text-[#A0A0A0]">New balance</span>
            <span
              className={cn(
                'font-semibold',
                wouldGoNegative
                  ? 'text-red-400'
                  : delta === 0
                    ? 'text-[#666]'
                    : 'text-[#39FF14]'
              )}
            >
              {newBalance.toLocaleString()} pts
              {wouldGoNegative && (
                <span className="ml-2 text-xs text-red-400 font-normal">
                  (cannot go negative)
                </span>
              )}
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="adjust-note"
            className="block text-sm font-medium text-[#A0A0A0] mb-2"
          >
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            id="adjust-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            maxLength={500}
            placeholder="e.g. Customer service comp for shipping delay"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#666] focus:outline-none focus:border-[#9B30FF] resize-none"
          />
          <p className="text-xs text-[#666] mt-1">
            Saved on the loyalty ledger. Visible to staff for audits.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-2.5 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-[#A0A0A0] hover:text-white px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || submitting}
            className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Apply adjustment
          </button>
        </div>
      </form>
    </div>
  )
}
