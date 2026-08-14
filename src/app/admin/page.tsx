'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Lightbulb,
  Image,
  Megaphone,
  ArrowRight,
  Clock,
  TrendingUp,
  Loader2,
  Building2,
} from 'lucide-react'

interface DashboardStats {
  totalIdeas: number
  totalMedia: number
  totalCampaigns: number
  activeCampaigns: number
  retailLeads: number
}

interface RecentIdea {
  id: string
  title: string
  category: string
  status: string
  created_at: string
}

interface UpcomingCampaign {
  id: string
  title: string
  status: string
  platforms: string[]
  scheduled_date: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  social: '#9B30FF',
  marketing: '#E87511',
  strategy: '#4A7C0F',
  product: '#D4D700',
  event: '#FF0040',
  partnership: '#00BFFF',
  other: '#666',
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#666',
  scheduled: '#D4D700',
  posted: '#4A7C0F',
  archived: '#A0A0A0',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentIdeas, setRecentIdeas] = useState<RecentIdea[]>([])
  const [upcomingCampaigns, setUpcomingCampaigns] = useState<UpcomingCampaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient()

      const [ideasCount, mediaCount, campaignsCount, activeCampaignsCount, ideas, campaigns, retailRes] =
        await Promise.all([
          supabase.from('ideas').select('*', { count: 'exact', head: true }),
          supabase.from('media').select('*', { count: 'exact', head: true }),
          supabase.from('campaigns').select('*', { count: 'exact', head: true }),
          supabase
            .from('campaigns')
            .select('*', { count: 'exact', head: true })
            .in('status', ['draft', 'scheduled']),
          supabase
            .from('ideas')
            .select('id, title, category, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('campaigns')
            .select('id, title, status, platforms, scheduled_date')
            .in('status', ['draft', 'scheduled'])
            .order('scheduled_date', { ascending: true, nullsFirst: false })
            .limit(5),
          fetch('/api/admin/retail').then((r) => r.json()).catch(() => ({ total: 0 })),
        ])

      setStats({
        totalIdeas: ideasCount.count ?? 0,
        totalMedia: mediaCount.count ?? 0,
        totalCampaigns: campaignsCount.count ?? 0,
        activeCampaigns: activeCampaignsCount.count ?? 0,
        retailLeads: retailRes.total ?? 0,
      })
      setRecentIdeas(ideas.data ?? [])
      setUpcomingCampaigns(campaigns.data ?? [])
      setLoading(false)
    }
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#9B30FF] animate-spin" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Retail Leads',
      value: stats?.retailLeads ?? 0,
      icon: Building2,
      color: '#FF8C2A',
      href: '/admin/retail',
    },
    {
      label: 'Total Ideas',
      value: stats?.totalIdeas ?? 0,
      icon: Lightbulb,
      color: '#9B30FF',
      href: '/admin/ideas',
    },
    {
      label: 'Media Files',
      value: stats?.totalMedia ?? 0,
      icon: Image,
      color: '#E87511',
      href: '/admin/media',
    },
    {
      label: 'Total Campaigns',
      value: stats?.totalCampaigns ?? 0,
      icon: Megaphone,
      color: '#4A7C0F',
      href: '/admin/campaigns',
    },
    {
      label: 'Active Campaigns',
      value: stats?.activeCampaigns ?? 0,
      icon: TrendingUp,
      color: '#D4D700',
      href: '/admin/campaigns',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 hover:border-[#444] transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <ArrowRight className="w-4 h-4 text-[#666] group-hover:text-white transition-colors" />
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-[#A0A0A0] mt-1">{card.label}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Recent Ideas</h3>
            <Link
              href="/admin/ideas"
              className="text-sm text-[#9B30FF] hover:text-[#BF5FFF] transition-colors"
            >
              View all
            </Link>
          </div>
          {recentIdeas.length === 0 ? (
            <p className="text-sm text-[#666] py-8 text-center">No ideas yet. Start brainstorming!</p>
          ) : (
            <div className="space-y-3">
              {recentIdeas.map((idea) => (
                <Link
                  key={idea.id}
                  href="/admin/ideas"
                  className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#1A1A1A] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: CATEGORY_COLORS[idea.category] || '#666',
                      }}
                    />
                    <span className="text-sm text-white truncate">{idea.title}</span>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full shrink-0 ml-2"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[idea.category] || '#666'}20`,
                      color: CATEGORY_COLORS[idea.category] || '#666',
                    }}
                  >
                    {idea.category}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Upcoming Campaigns</h3>
            <Link
              href="/admin/campaigns"
              className="text-sm text-[#9B30FF] hover:text-[#BF5FFF] transition-colors"
            >
              View all
            </Link>
          </div>
          {upcomingCampaigns.length === 0 ? (
            <p className="text-sm text-[#666] py-8 text-center">
              No upcoming campaigns. Plan your next post!
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href="/admin/campaigns"
                  className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#1A1A1A] transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-white truncate block">{campaign.title}</span>
                    {campaign.scheduled_date && (
                      <span className="text-xs text-[#666] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(campaign.scheduled_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full shrink-0 ml-2"
                    style={{
                      backgroundColor: `${STATUS_COLORS[campaign.status] || '#666'}20`,
                      color: STATUS_COLORS[campaign.status] || '#666',
                    }}
                  >
                    {campaign.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
