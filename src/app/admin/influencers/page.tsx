'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  COMPENSATION_LABELS,
  CONTENT_FOCUS_LABELS,
  FOLLOWER_TIER_LABELS,
  INFLUENCER_SLA_HOURS,
  INFLUENCER_STATUS_COLORS,
  INFLUENCER_STATUS_LABELS,
  PLATFORM_LABELS,
} from '@/lib/influencers/constants'
import { INFLUENCER_STATUSES, type InfluencerLead } from '@/lib/influencers/types'

function slaState(lead: InfluencerLead): { label: string; overdue: boolean } {
  if (lead.status !== 'new' || lead.first_contacted_at) {
    return { label: 'Touched', overdue: false }
  }
  const hours = (Date.now() - new Date(lead.created_at).getTime()) / 36e5
  const remaining = INFLUENCER_SLA_HOURS - hours
  if (remaining <= 0) {
    return { label: `${Math.floor(hours - INFLUENCER_SLA_HOURS)}h over SLA`, overdue: true }
  }
  return { label: `${Math.ceil(remaining)}h left`, overdue: false }
}

function AttrRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[#666]">{label}</span>
      <span className="truncate text-right text-white">{value}</span>
    </div>
  )
}

export default function AdminInfluencersPage() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<InfluencerLead[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionAt, setNextActionAt] = useState('')

  const load = useCallback(() => {
    return fetch('/api/admin/influencers')
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.leads || [])
        setStatusCounts(data.statusCounts || {})
      })
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) || null,
    [leads, selectedId]
  )

  useEffect(() => {
    if (!selected) {
      setNotes('')
      setNextAction('')
      setNextActionAt('')
      return
    }
    setNotes(selected.admin_notes || '')
    setNextAction(selected.next_action || '')
    setNextActionAt(selected.next_action_at ? selected.next_action_at.slice(0, 16) : '')
  }, [selected])

  async function updateLead(id: string, updates: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/influencers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l)))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#9B30FF]" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">Creator Partnerships</h1>
        <p className="text-sm text-[#999]">
          {leads.length} applications · 72h first-touch SLA ·{' '}
          <a href="/influencers" className="text-[#9B30FF] hover:underline" target="_blank" rel="noreferrer">
            /influencers
          </a>
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[240px] min-w-0 flex-1 gap-3 overflow-x-auto pb-2 lg:min-h-0">
          {INFLUENCER_STATUSES.map((status) => {
            const column = leads.filter((l) => l.status === status)
            return (
              <div
                key={status}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-[#2A2A2A] bg-[#0F0F0F]"
              >
                <div className="flex items-center justify-between border-b border-[#2A2A2A] px-3 py-2.5">
                  <span className="text-xs font-medium" style={{ color: INFLUENCER_STATUS_COLORS[status] }}>
                    {INFLUENCER_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-[#666]">{statusCounts[status] || 0}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                  {column.map((lead) => {
                    const sla = slaState(lead)
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedId(lead.id)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition-colors',
                          selectedId === lead.id
                            ? 'border-[#9B30FF]/50 bg-[#9B30FF]/5'
                            : 'border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]'
                        )}
                      >
                        <p className="truncate text-sm font-medium text-white">{lead.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#999]">
                          {PLATFORM_LABELS[lead.primary_platform]} · @{lead.handle}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="truncate text-[11px] text-[#666]">
                            {FOLLOWER_TIER_LABELS[lead.follower_tier]}
                            {lead.location ? ` · ${lead.location}` : ''}
                          </span>
                          {lead.status === 'new' && (
                            <span className={cn('text-[11px]', sla.overdue ? 'text-red-400' : 'text-[#FFD700]')}>
                              {sla.label}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <aside className="w-full shrink-0 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#141414] lg:w-[380px]">
          {!selected ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[#666]">
              Select an application
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${INFLUENCER_STATUS_COLORS[selected.status]}1A` }}
                  >
                    <Sparkles className="h-5 w-5" style={{ color: INFLUENCER_STATUS_COLORS[selected.status] }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-white">{selected.name}</h2>
                    <p className="text-xs text-[#999]">
                      {PLATFORM_LABELS[selected.primary_platform]} · @{selected.handle}
                    </p>
                  </div>
                </div>
                {selected.status === 'new' && (
                  <p
                    className={cn(
                      'mt-2 flex items-center gap-1.5 text-xs',
                      slaState(selected).overdue ? 'text-red-400' : 'text-[#FFD700]'
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {slaState(selected).label}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-blue-400 hover:underline">
                  <Mail className="h-4 w-4" /> {selected.email}
                </a>
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-white hover:underline">
                    <Phone className="h-4 w-4 text-[#999]" /> {selected.phone}
                  </a>
                )}
                {selected.location && (
                  <p className="flex items-center gap-2 text-white">
                    <MapPin className="h-4 w-4 text-[#999]" /> {selected.location}
                  </p>
                )}
                <a
                  href={selected.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#9B30FF] hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Open profile
                </a>
                {selected.content_link && (
                  <a
                    href={selected.content_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-white hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 text-[#999]" /> Sample post
                  </a>
                )}
                <p className="text-xs text-[#999]">
                  {CONTENT_FOCUS_LABELS[selected.content_focus]} · {FOLLOWER_TIER_LABELS[selected.follower_tier]}
                </p>
                <p className="text-xs text-[#999]">
                  {COMPENSATION_LABELS[selected.compensation]}
                </p>
                {selected.other_handles && (
                  <p className="text-xs text-[#999]">Also: {selected.other_handles}</p>
                )}
              </div>

              {selected.message && (
                <p className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3 text-sm text-white">
                  {selected.message}
                </p>
              )}

              <div>
                <p className="mb-2 text-xs text-[#999]">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {INFLUENCER_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateLead(selected.id, { status })}
                      disabled={selected.status === status || saving}
                      className="rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
                      style={{
                        borderColor: `${INFLUENCER_STATUS_COLORS[status]}66`,
                        color: INFLUENCER_STATUS_COLORS[status],
                        backgroundColor:
                          selected.status === status ? `${INFLUENCER_STATUS_COLORS[status]}1A` : 'transparent',
                      }}
                    >
                      {INFLUENCER_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3">
                <p className="mb-2 font-condensed text-[11px] uppercase tracking-widest text-[#9B30FF]">
                  Attribution
                </p>
                <div className="space-y-1.5">
                  <AttrRow label="Source" value={selected.first_utm_source} />
                  <AttrRow label="Medium" value={selected.first_utm_medium} />
                  <AttrRow label="Campaign" value={selected.first_utm_campaign} />
                  <AttrRow label="Landing" value={selected.first_landing_page} />
                  <AttrRow label="Referrer" value={selected.first_referrer} />
                  {!selected.first_utm_source && !selected.first_gclid && !selected.first_fbclid && (
                    <p className="text-xs text-[#666]">Direct / unattributed</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-[#999]">Next action</p>
                <input
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. DM on Instagram"
                  className="mb-2 w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                />
                <input
                  type="datetime-local"
                  value={nextActionAt}
                  onChange={(e) => setNextActionAt(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    updateLead(selected.id, {
                      next_action: nextAction || null,
                      next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-white hover:bg-[#1A1A1A]"
                >
                  <Save className="h-3.5 w-3.5" /> Save next action
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs text-[#999]">Admin notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mb-2 w-full resize-none rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => updateLead(selected.id, { admin_notes: notes })}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-white hover:bg-[#1A1A1A]"
                >
                  <Save className="h-3.5 w-3.5" /> Save notes
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
