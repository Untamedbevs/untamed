'use client'

import { useState, useEffect } from 'react'
import {
  Users, MousePointerClick, UserCheck, Building2,
  TrendingUp, Search, Trophy, Activity, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReferralParticipant, ReferralEvent, ReferralRewardTier } from '@/lib/referral/types'

type Tab = 'participants' | 'events' | 'tiers'

interface Totals {
  participants: number
  totalClicks: number
  consumerSignups: number
  distributorLeads: number
  paidConversions: number
}

interface RewardEarnedWithRelations {
  id: string
  participant_id: string
  tier_id: string
  is_claimed: boolean
  earned_at: string
  tier: ReferralRewardTier | null
  participant: { email: string; display_name: string | null } | null
}

export default function AdminReferralsPage() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('participants')
  const [search, setSearch] = useState('')

  const [totals, setTotals] = useState<Totals>({
    participants: 0, totalClicks: 0, consumerSignups: 0,
    distributorLeads: 0, paidConversions: 0,
  })
  const [participants, setParticipants] = useState<ReferralParticipant[]>([])
  const [events, setEvents] = useState<ReferralEvent[]>([])
  const [tiers, setTiers] = useState<ReferralRewardTier[]>([])
  const [rewardsEarned, setRewardsEarned] = useState<RewardEarnedWithRelations[]>([])

  useEffect(() => {
    fetch('/api/admin/referrals')
      .then((res) => res.json())
      .then((data) => {
        setTotals(data.totals)
        setParticipants(data.participants)
        setEvents(data.events)
        setTiers(data.tiers)
        setRewardsEarned(data.rewardsEarned)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredParticipants = participants.filter(
    (p) =>
      !search ||
      p.email.includes(search.toLowerCase()) ||
      p.referral_code.includes(search.toLowerCase()) ||
      (p.display_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const statCards = [
    { label: 'Participants', value: totals.participants, icon: Users, color: '#FFD700' },
    { label: 'Total Clicks', value: totals.totalClicks, icon: MousePointerClick, color: '#3b82f6' },
    { label: 'Consumer Signups', value: totals.consumerSignups, icon: UserCheck, color: '#22c55e' },
    { label: 'Distributor Leads', value: totals.distributorLeads, icon: Building2, color: '#FF8C2A' },
    { label: 'Paid Conversions', value: totals.paidConversions, icon: TrendingUp, color: '#9B30FF' },
  ]

  const tabItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'participants', label: 'Participants', icon: <Users className="w-4 h-4" /> },
    { id: 'events', label: 'Events', icon: <Activity className="w-4 h-4" /> },
    { id: 'tiers', label: 'Tiers & Rewards', icon: <Trophy className="w-4 h-4" /> },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Referral Program</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4"
          >
            <stat.icon className="w-5 h-5 mb-2" style={{ color: stat.color }} />
            <p className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</p>
            <p className="text-xs text-[#999]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2A2A2A] mb-6">
        {tabItems.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
              tab === t.id
                ? 'text-white border-yellow-400'
                : 'text-[#999] border-transparent hover:text-white'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Participants tab */}
      {tab === 'participants' && (
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              type="text"
              placeholder="Search by email, code, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-white text-sm placeholder:text-[#666] focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#2A2A2A]">
            <table className="w-full text-sm">
              <thead className="bg-[#1A1A1A]">
                <tr>
                  <th className="text-left px-4 py-3 text-[#999] font-medium">Name / Email</th>
                  <th className="text-left px-4 py-3 text-[#999] font-medium">Code</th>
                  <th className="text-right px-4 py-3 text-[#999] font-medium">Clicks</th>
                  <th className="text-right px-4 py-3 text-[#999] font-medium">Signups</th>
                  <th className="text-right px-4 py-3 text-[#999] font-medium">Leads</th>
                  <th className="text-right px-4 py-3 text-[#999] font-medium">Conversions</th>
                  <th className="text-left px-4 py-3 text-[#999] font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {filteredParticipants.map((p) => (
                  <tr key={p.id} className="bg-[#141414] hover:bg-[#1A1A1A] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white">{p.display_name || '--'}</p>
                      <p className="text-xs text-[#999]">{p.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-yellow-400 text-xs bg-yellow-400/10 px-2 py-0.5 rounded">
                        {p.referral_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{p.total_clicks}</td>
                    <td className="px-4 py-3 text-right text-green-400">{p.consumer_signups}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{p.distributor_leads}</td>
                    <td className="px-4 py-3 text-right text-purple-400">{p.paid_conversions}</td>
                    <td className="px-4 py-3 text-[#999] text-xs">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredParticipants.length === 0 && (
              <p className="text-center py-8 text-[#666]">No participants found</p>
            )}
          </div>
        </div>
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <div className="space-y-2">
          {events.map((event) => {
            const participant = participants.find((p) => p.id === event.participant_id)
            const typeColors: Record<string, string> = {
              click_consumer: '#3b82f6',
              click_distributor: '#FF8C2A',
              consumer_signup: '#22c55e',
              distributor_lead: '#FF8C2A',
              paid_conversion: '#9B30FF',
              referral_sent: '#FFD700',
            }
            const typeLabels: Record<string, string> = {
              click_consumer: 'Consumer Click',
              click_distributor: 'Distributor Click',
              consumer_signup: 'Consumer Signup',
              distributor_lead: 'Distributor Lead',
              paid_conversion: 'Paid Conversion',
              referral_sent: 'Warm Intro Sent',
            }

            return (
              <div
                key={event.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#141414] border border-[#2A2A2A]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: `${typeColors[event.event_type] || '#666'}1A`,
                      color: typeColors[event.event_type] || '#666',
                    }}
                  >
                    {typeLabels[event.event_type] || event.event_type}
                  </span>
                  <span className="text-sm text-white">
                    {participant?.display_name || participant?.email || event.participant_id.slice(0, 8)}
                  </span>
                  {event.referred_email && (
                    <span className="text-xs text-[#999]">{event.referred_email}</span>
                  )}
                </div>
                <span className="text-xs text-[#666]">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
            )
          })}
          {events.length === 0 && (
            <p className="text-center py-8 text-[#666]">No events yet</p>
          )}
        </div>
      )}

      {/* Tiers & Rewards tab */}
      {tab === 'tiers' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Reward Tiers</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-white">{tier.tier_name}</h4>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      tier.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    )}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-[#999] mb-3">{tier.description}</p>
                  <div className="flex gap-4 text-xs text-[#999]">
                    <span>Signups: {tier.min_consumer_signups}</span>
                    <span>Leads: {tier.min_distributor_leads}</span>
                    <span>Conversions: {tier.min_paid_conversions}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Rewards Earned</h3>
            {rewardsEarned.length > 0 ? (
              <div className="space-y-2">
                {rewardsEarned.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#141414] border border-[#2A2A2A]"
                  >
                    <div>
                      <span className="text-white text-sm">
                        {r.participant?.display_name || r.participant?.email || 'Unknown'}
                      </span>
                      <span className="text-[#999] text-xs ml-2">
                        earned {r.tier?.tier_name || 'Unknown Tier'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        r.is_claimed ? 'bg-green-500/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'
                      )}>
                        {r.is_claimed ? 'Claimed' : 'Available'}
                      </span>
                      <span className="text-xs text-[#666]">
                        {new Date(r.earned_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-[#666]">No rewards earned yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
