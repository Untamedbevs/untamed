'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Ban,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampaignData {
  campaign: {
    id: string
    name: string
    subject: string
    senderId: string
    audienceCount: number
    sentCount: number
    failedCount: number
    status: string
    createdAt: string
    updatedAt: string
  }
  stats: {
    total: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complaint: number
    failed: number
  }
  pending: number
  recipients: Array<{
    email: string
    status: string
    sentAt: string | null
    deliveredAt: string | null
    openedAt: string | null
    clickedAt: string | null
  }>
}

export default function CampaignStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [data, setData] = useState<CampaignData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/admin/crm/blast/${id}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Failed to load campaign')
        } else {
          setData(json)
        }
      } catch {
        if (!cancelled) setError('Failed to load campaign')
      }
    }

    load()
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [id])

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-[#A0A0A0]">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    )
  }

  const { campaign, stats, pending, recipients } = data
  const isComplete = campaign.status === 'sent'

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/crm/blast" className="text-[#A0A0A0] hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{campaign.subject}</h1>
          <div className="text-xs text-[#A0A0A0] mt-0.5">
            Campaign {campaign.id.slice(0, 8)} •{' '}
            <StatusBadge status={campaign.status} />
          </div>
        </div>
        {!isComplete && (
          <div className="text-xs text-[#A0A0A0] flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Refreshing every 5s
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <StatCard
          icon={<Mail className="w-4 h-4" />}
          label="Audience"
          value={campaign.audienceCount}
          color="white"
        />
        <StatCard
          icon={<Loader2 className="w-4 h-4" />}
          label="Pending"
          value={pending}
          color="white"
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Sent"
          value={stats.total}
          color="green"
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Delivered"
          value={stats.delivered}
          color="green"
        />
        <StatCard
          icon={<MailOpen className="w-4 h-4" />}
          label="Opened"
          value={stats.opened}
          color="purple"
        />
        <StatCard
          icon={<MousePointerClick className="w-4 h-4" />}
          label="Clicked"
          value={stats.clicked}
          color="purple"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Bounced"
          value={stats.bounced + stats.failed}
          color="red"
        />
      </div>

      {stats.complaint > 0 && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-400 flex items-center gap-2 mb-4">
          <Ban className="w-4 h-4" />
          {stats.complaint} complaint{stats.complaint === 1 ? '' : 's'} reported
        </div>
      )}

      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">
          Recent Recipients
        </h2>
        {recipients.length === 0 ? (
          <p className="text-sm text-[#A0A0A0]">No sent messages yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#666] text-left">
                <th className="pb-2 font-normal">Email</th>
                <th className="pb-2 font-normal">Status</th>
                <th className="pb-2 font-normal">Sent</th>
                <th className="pb-2 font-normal">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {recipients.map((r, i) => (
                <tr key={i} className="text-xs">
                  <td className="py-2 text-white font-mono truncate max-w-[260px]">
                    {r.email}
                  </td>
                  <td className="py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2 text-[#A0A0A0]">
                    {r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 text-[#A0A0A0]">
                    {r.openedAt ? new Date(r.openedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'white' | 'green' | 'purple' | 'red'
}) {
  const colorClasses = {
    white: 'text-white',
    green: 'text-green-400',
    purple: 'text-[#9B30FF]',
    red: 'text-red-400',
  }
  return (
    <div className="rounded-lg border border-[#2A2A2A] bg-[#111] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#A0A0A0] mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('text-xl font-bold', colorClasses[color])}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'text-[#A0A0A0] bg-[#1A1A1A]',
    sending: 'text-yellow-400 bg-yellow-400/10',
    sent: 'text-green-400 bg-green-400/10',
    delivered: 'text-green-400 bg-green-400/10',
    opened: 'text-[#9B30FF] bg-[#9B30FF]/10',
    clicked: 'text-[#9B30FF] bg-[#9B30FF]/10',
    bounced: 'text-red-400 bg-red-400/10',
    failed: 'text-red-400 bg-red-400/10',
    complaint: 'text-orange-400 bg-orange-400/10',
    cancelled: 'text-[#A0A0A0] bg-[#1A1A1A]',
    pending: 'text-[#A0A0A0] bg-[#1A1A1A]',
  }
  return (
    <span
      className={cn(
        'inline-block text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded',
        map[status] || 'text-[#A0A0A0] bg-[#1A1A1A]'
      )}
    >
      {status}
    </span>
  )
}
