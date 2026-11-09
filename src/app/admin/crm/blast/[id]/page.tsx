'use client'

import { useCallback, useEffect, useState, use } from 'react'
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
  DollarSign,
  UserMinus,
  Pause,
  Play,
  XCircle,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmailBlock } from '@/lib/email/blocks'

interface CampaignData {
  campaign: {
    id: string
    name: string
    subject: string
    preheader: string | null
    blocks: EmailBlock[] | null
    textBody: string | null
    senderId: string
    kind: string
    listSlug: string | null
    skippedCount: number
    audienceCount: number
    sentCount: number
    failedCount: number
    status: string
    scheduledFor: string | null
    approvalRequired: boolean
    submittedBy: string | null
    submittedByMe: boolean
    approvedBy: string | null
    rejectionReason: string | null
    pausedReason: string | null
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
    rejected: number
    failed: number
    unsubscribes: number
    orders: number
    revenueCents: number
  }
  pending: number
  canManage: boolean
  recipients: Array<{
    email: string
    status: string
    sentAt: string | null
    deliveredAt: string | null
    openedAt: string | null
    clickedAt: string | null
  }>
}

const LIVE_STATUSES = ['sending', 'scheduled', 'pending_approval', 'paused']

export default function CampaignStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<CampaignData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/crm/blast/${id}`)
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Failed to load campaign')
      else setData(json)
    } catch {
      setError('Failed to load campaign')
    }
  }, [id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const blocks = data?.campaign.blocks
  const textBody = data?.campaign.textBody
  useEffect(() => {
    if (!data) return
    const content = blocks && blocks.length ? blocks : textBody ? [{ type: 'text', text: textBody }] : []
    fetch('/api/admin/crm/email/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: data.campaign.subject, preheader: data.campaign.preheader, blocks: content }),
    })
      .then(async (res) => (res.ok ? setPreview((await res.json()).html || null) : null))
      .catch(() => null)
    // Content doesn't change after submission; render once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.campaign.id])

  async function act(action: 'approve' | 'reject' | 'pause' | 'resume' | 'cancel') {
    let reason: string | undefined
    if (action === 'reject') {
      reason = prompt('Why are you rejecting it? (shown to the submitter)') || undefined
      if (reason === undefined) return
    }
    if (action === 'cancel' && !confirm('Cancel this campaign? Unsent messages will not go out.')) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/crm/blast/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const json = await res.json()
      if (!res.ok) setActionError([json.error, ...(json.issues || [])].filter(Boolean).join(' '))
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-400">{error}</div>
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

  const { campaign, stats, pending, recipients, canManage } = data
  const live = LIVE_STATUSES.includes(campaign.status)
  const rate = (n: number) => (stats.delivered > 0 ? `${((n / stats.delivered) * 100).toFixed(1)}%` : '—')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/admin/crm/email" className="text-[#A0A0A0] hover:text-white" aria-label="Back to email dashboard">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{campaign.name || campaign.subject}</h1>
          <div className="text-xs text-[#A0A0A0] mt-0.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            <span>{campaign.kind === 'repermission' ? 'Permission request' : campaign.listSlug ? `List: ${campaign.listSlug}` : 'Legacy blast'}</span>
            {campaign.scheduledFor && <span>· scheduled {new Date(campaign.scheduledFor).toLocaleString()}</span>}
            {campaign.submittedBy && <span>· submitted by {campaign.submittedBy}</span>}
            {campaign.approvedBy && <span>· approved by {campaign.approvedBy}</span>}
          </div>
        </div>
        {live && (
          <div className="text-xs text-[#A0A0A0] flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Refreshing every 5s
          </div>
        )}
      </div>

      {campaign.status === 'pending_approval' && (
        <Banner tone="amber" icon={<ShieldCheck className="w-4 h-4" />}>
          Waiting for a second admin&apos;s approval. Recipients are re-checked when it&apos;s approved.
        </Banner>
      )}
      {campaign.status === 'draft' && campaign.rejectionReason && (
        <Banner tone="red" icon={<XCircle className="w-4 h-4" />}>Rejected: {campaign.rejectionReason}</Banner>
      )}
      {campaign.status === 'paused' && (
        <Banner tone="amber" icon={<Pause className="w-4 h-4" />}>Paused: {campaign.pausedReason || 'by staff'}</Banner>
      )}
      {actionError && <Banner tone="red" icon={<AlertTriangle className="w-4 h-4" />}>{actionError}</Banner>}

      {canManage && (
        <div className="flex flex-wrap gap-2 mb-6">
          {campaign.status === 'pending_approval' && !campaign.submittedByMe && (
            <>
              <ActionButton onClick={() => act('approve')} busy={busy} primary icon={<CheckCircle className="w-4 h-4" />}>Approve and queue</ActionButton>
              <ActionButton onClick={() => act('reject')} busy={busy} icon={<XCircle className="w-4 h-4" />}>Reject</ActionButton>
            </>
          )}
          {campaign.status === 'pending_approval' && campaign.submittedByMe && (
            <span className="text-xs text-[#A0A0A0]">You submitted this, so another admin has to approve it.</span>
          )}
          {['scheduled', 'sending'].includes(campaign.status) && (
            <ActionButton onClick={() => act('pause')} busy={busy} icon={<Pause className="w-4 h-4" />}>Pause</ActionButton>
          )}
          {campaign.status === 'paused' && (
            <ActionButton onClick={() => act('resume')} busy={busy} primary icon={<Play className="w-4 h-4" />}>Resume</ActionButton>
          )}
          {!['sent', 'cancelled'].includes(campaign.status) && (
            <ActionButton onClick={() => act('cancel')} busy={busy} danger icon={<XCircle className="w-4 h-4" />}>Cancel</ActionButton>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <StatCard icon={<Mail className="w-4 h-4" />} label="Audience" value={campaign.audienceCount} sub={campaign.skippedCount ? `${campaign.skippedCount.toLocaleString()} skipped` : undefined} />
        <StatCard icon={<Loader2 className="w-4 h-4" />} label="Pending" value={pending} />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Sent" value={stats.total} color="green" />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Delivered" value={stats.delivered} color="green" />
        <StatCard icon={<DollarSign className="w-4 h-4" />} label="Revenue" value={stats.revenueCents / 100} money sub={`${stats.orders} order${stats.orders === 1 ? '' : 's'} within 7 days of a click`} color="purple" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={<MailOpen className="w-4 h-4" />} label="Opened" value={stats.opened} sub={rate(stats.opened)} color="purple" />
        <StatCard icon={<MousePointerClick className="w-4 h-4" />} label="Clicked" value={stats.clicked} sub={rate(stats.clicked)} color="purple" />
        <StatCard icon={<UserMinus className="w-4 h-4" />} label="Unsubscribed" value={stats.unsubscribes} sub={rate(stats.unsubscribes)} />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Bounced" value={stats.bounced + stats.failed + stats.rejected} sub={rate(stats.bounced)} color="red" />
        <StatCard icon={<Ban className="w-4 h-4" />} label="Complaints" value={stats.complaint} sub={rate(stats.complaint)} color="red" />
      </div>
      <p className="text-[11px] text-[#666] mb-6">
        Open rates are inflated by Apple Mail privacy protection; clicks and revenue are the reliable signals.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">Recent recipients</h2>
          {recipients.length === 0 ? (
            <p className="text-sm text-[#A0A0A0]">No sent messages yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#666] text-left">
                  <th className="pb-2 font-normal">Email</th>
                  <th className="pb-2 font-normal">Status</th>
                  <th className="pb-2 font-normal">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {recipients.map((r, i) => (
                  <tr key={i} className="text-xs">
                    <td className="py-2 text-white font-mono truncate max-w-[220px]">{r.email}</td>
                    <td className="py-2"><StatusBadge status={r.status} /></td>
                    <td className="py-2 text-[#A0A0A0]">{r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">Content</h2>
          <div className="text-sm text-white mb-1">{campaign.subject}</div>
          {campaign.preheader && <div className="text-xs text-[#A0A0A0] mb-3">{campaign.preheader}</div>}
          {preview ? (
            <iframe title="Campaign preview" sandbox="" srcDoc={preview} className="w-full rounded-lg bg-[#0A0A0A]" style={{ height: 480, border: 0 }} />
          ) : (
            <p className="text-xs text-[#666]">Preview unavailable.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function Banner({ tone, icon, children }: { tone: 'amber' | 'red'; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm flex items-center gap-2 mb-4',
        tone === 'amber' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-red-500/40 bg-red-500/10 text-red-300'
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  )
}

function ActionButton({
  onClick,
  busy,
  primary,
  danger,
  icon,
  children,
}: {
  onClick: () => void
  busy: boolean
  primary?: boolean
  danger?: boolean
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm disabled:opacity-50',
        primary
          ? 'bg-[#9B30FF] text-white hover:bg-[#B560FF]'
          : danger
            ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10'
            : 'border border-[#2A2A2A] text-[#A0A0A0] hover:text-white'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  money,
  color = 'white',
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  money?: boolean
  color?: 'white' | 'green' | 'purple' | 'red'
}) {
  const colorClasses = { white: 'text-white', green: 'text-green-400', purple: 'text-[#9B30FF]', red: 'text-red-400' }
  return (
    <div className="rounded-lg border border-[#2A2A2A] bg-[#111] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#A0A0A0] mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('text-xl font-bold', colorClasses[color])}>
        {money ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : value.toLocaleString()}
      </div>
      {sub && <div className="text-[10px] text-[#666] mt-0.5">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'text-[#A0A0A0] bg-[#1A1A1A]',
    pending_approval: 'text-amber-300 bg-amber-400/10',
    scheduled: 'text-sky-300 bg-sky-400/10',
    sending: 'text-yellow-400 bg-yellow-400/10',
    paused: 'text-amber-300 bg-amber-400/10',
    sent: 'text-green-400 bg-green-400/10',
    delivered: 'text-green-400 bg-green-400/10',
    opened: 'text-[#9B30FF] bg-[#9B30FF]/10',
    clicked: 'text-[#9B30FF] bg-[#9B30FF]/10',
    bounced: 'text-red-400 bg-red-400/10',
    rejected: 'text-red-400 bg-red-400/10',
    failed: 'text-red-400 bg-red-400/10',
    complaint: 'text-orange-400 bg-orange-400/10',
    cancelled: 'text-[#A0A0A0] bg-[#1A1A1A]',
    pending: 'text-[#A0A0A0] bg-[#1A1A1A]',
  }
  return (
    <span className={cn('inline-block text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded', map[status] || 'text-[#A0A0A0] bg-[#1A1A1A]')}>
      {status.replace('_', ' ')}
    </span>
  )
}
