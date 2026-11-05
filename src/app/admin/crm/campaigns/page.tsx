'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Send, XCircle } from 'lucide-react'
import { getSenderById } from '@/lib/crm/senders'
import { cn } from '@/lib/utils'

interface Campaign {
  id: string
  name: string
  subject: string | null
  sender_id: string | null
  audience_count: number
  sent_count: number
  failed_count: number
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  scheduled_for: string | null
  created_at: string
}

const STATUS_STYLES: Record<Campaign['status'], string> = {
  draft: 'bg-[#1A1A1A] text-[#A0A0A0]',
  scheduled: 'bg-blue-500/15 text-blue-300',
  sending: 'bg-amber-500/15 text-amber-300',
  sent: 'bg-green-500/15 text-green-300',
  cancelled: 'bg-red-500/10 text-red-300',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/crm/blast')
    const data = await res.json().catch(() => ({}))
    setCampaigns(data.campaigns || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  async function cancel(c: Campaign) {
    if (!confirm(`Cancel "${c.name}"? Emails not yet sent will be dropped.`)) return
    setError(null)
    const res = await fetch(`/api/admin/crm/blast/${c.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Cancel failed')
    load()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm" className="text-[#A0A0A0] hover:text-white" aria-label="Back to CRM">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
        </div>
        <Link
          href="/admin/crm/blast"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#B560FF]"
        >
          <Send className="w-4 h-4" /> New blast
        </Link>
      </div>

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#A0A0A0]" />
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] p-10 text-center text-sm text-[#A0A0A0]">
          No campaigns yet.
        </div>
      ) : (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#111] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#666] border-b border-[#2A2A2A]">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium text-right">Progress</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const pct = c.audience_count > 0 ? Math.round((c.sent_count / c.audience_count) * 100) : 0
                const when = c.status === 'scheduled' && c.scheduled_for ? c.scheduled_for : c.created_at
                return (
                  <tr key={c.id} className="border-b border-[#1A1A1A] last:border-0 hover:bg-[#151515]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/crm/blast/${c.id}`} className="text-white hover:underline">
                        {c.subject || c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#A0A0A0] font-mono">
                      {c.sender_id ? getSenderById(c.sender_id).email : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-white">
                        {c.sent_count.toLocaleString()} / {c.audience_count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#666]">
                        {pct}%{c.failed_count > 0 && <span className="text-red-400"> · {c.failed_count} failed</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#A0A0A0]">
                      {c.status === 'scheduled' ? 'Sends ' : ''}
                      {new Date(when).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(c.status === 'scheduled' || c.status === 'sending') && (
                        <button
                          onClick={() => cancel(c)}
                          className="inline-flex items-center gap-1 text-xs text-[#A0A0A0] hover:text-red-400"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
