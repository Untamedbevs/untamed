'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Loader2, Mail, Phone, MapPin, User, Save,
  Clock, Radio, BarChart3, Send, PhoneCall, Calendar,
  Package, StickyNote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BUSINESS_TYPE_LABELS,
  VOLUME_INTEREST_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_SLA_HOURS,
  LEAD_ACTIVITY_LABELS,
} from '@/lib/referral/constants'
import type {
  DistributorLead,
  DistributorLeadStatus,
  LeadActivity,
  LeadActivityType,
} from '@/lib/referral/types'

interface LeadWithReferrer extends DistributorLead {
  referrer: { email: string; display_name: string | null; referral_code: string } | null
}

const STATUS_COLORS: Record<DistributorLeadStatus, string> = {
  new: '#3b82f6',
  contacted: '#FFD700',
  qualified: '#22c55e',
  negotiating: '#FF8C2A',
  converted: '#9B30FF',
  declined: '#ef4444',
}

const STATUSES: DistributorLeadStatus[] = [
  'new', 'contacted', 'qualified', 'negotiating', 'converted', 'declined',
]

const QUICK_ACTIONS: { type: LeadActivityType; label: string; icon: typeof PhoneCall }[] = [
  { type: 'called', label: 'Called', icon: PhoneCall },
  { type: 'emailed', label: 'Emailed', icon: Send },
  { type: 'meeting', label: 'Meeting', icon: Calendar },
  { type: 'sample_sent', label: 'Sample', icon: Package },
  { type: 'note', label: 'Note', icon: StickyNote },
]

function slaState(lead: LeadWithReferrer): { label: string; overdue: boolean; hours: number } {
  if (lead.status !== 'new' || lead.first_contacted_at) {
    return { label: 'Contacted', overdue: false, hours: 0 }
  }
  const hours = (Date.now() - new Date(lead.created_at).getTime()) / 36e5
  const remaining = LEAD_SLA_HOURS - hours
  if (remaining <= 0) {
    return { label: `${Math.floor(hours - LEAD_SLA_HOURS)}h over SLA`, overdue: true, hours }
  }
  return { label: `${Math.ceil(remaining)}h left`, overdue: false, hours }
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

export default function AdminRetailWorkbenchPage() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<LeadWithReferrer[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionAt, setNextActionAt] = useState('')
  const [activityBody, setActivityBody] = useState('')

  const load = useCallback(() => {
    return fetch('/api/admin/retail')
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
    if (!selectedId) {
      setActivities([])
      return
    }
    fetch(`/api/admin/retail/${selectedId}`)
      .then((res) => res.json())
      .then((data) => {
        setActivities(data.activities || [])
        if (data.lead) {
          setNotes(data.lead.admin_notes || '')
          setNextAction(data.lead.next_action || '')
          setNextActionAt(data.lead.next_action_at ? data.lead.next_action_at.slice(0, 16) : '')
        }
      })
  }, [selectedId])

  async function updateLead(id: string, updates: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/retail/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l)))
        const newCounts: Record<string, number> = {}
        const updated = leads.map((l) => (l.id === id ? { ...l, ...data.lead } : l))
        for (const l of updated) {
          newCounts[l.status] = (newCounts[l.status] || 0) + 1
        }
        setStatusCounts(newCounts)
      }
    } finally {
      setSaving(false)
    }
  }

  async function logActivity(type: LeadActivityType) {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/retail/${selectedId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_type: type, body: activityBody || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        setActivities((prev) => [data.activity, ...prev])
        setActivityBody('')
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Retail Leads</h1>
          <p className="text-sm text-[#999]">{leads.length} total · 48h first-touch SLA</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/retail/locations"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A]"
          >
            <MapPin className="h-4 w-4 text-[#FFD700]" />
            Locations
          </Link>
          <Link
            href="/admin/retail/performance"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A]"
          >
            <BarChart3 className="h-4 w-4 text-[#FFD700]" />
            Performance
          </Link>
          <Link
            href="/admin/retail/utm-builder"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A]"
          >
            <Radio className="h-4 w-4 text-[#FFD700]" />
            UTM Builder
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-2">
          {STATUSES.map((status) => {
            const column = leads.filter((l) => l.status === status)
            return (
              <div
                key={status}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-[#2A2A2A] bg-[#0F0F0F]"
              >
                <div className="flex items-center justify-between border-b border-[#2A2A2A] px-3 py-2.5">
                  <span className="text-xs font-medium" style={{ color: STATUS_COLORS[status] }}>
                    {LEAD_STATUS_LABELS[status]}
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
                            ? 'border-[#FFD700]/50 bg-[#FFD700]/5'
                            : 'border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]'
                        )}
                      >
                        <p className="truncate text-sm font-medium text-white">{lead.business_name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#999]">
                          {BUSINESS_TYPE_LABELS[lead.business_type]}
                          {lead.location ? ` · ${lead.location}` : ''}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="truncate text-[11px] text-[#666]">
                            {lead.first_utm_source || lead.referrer?.display_name || 'direct'}
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

        <aside className="hidden w-[380px] shrink-0 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#141414] lg:block">
          {!selected ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[#666]">
              Select a lead
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${STATUS_COLORS[selected.status]}1A` }}
                  >
                    <Building2 className="h-5 w-5" style={{ color: STATUS_COLORS[selected.status] }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-white">{selected.business_name}</h2>
                    <p className="text-xs text-[#999]">{selected.contact_name}</p>
                  </div>
                </div>
                {selected.status === 'new' && (
                  <p className={cn('mt-2 flex items-center gap-1.5 text-xs', slaState(selected).overdue ? 'text-red-400' : 'text-[#FFD700]')}>
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
                {selected.volume_interest && (
                  <p className="text-xs text-[#999]">
                    Volume: {VOLUME_INTEREST_LABELS[selected.volume_interest]}
                  </p>
                )}
                {selected.referrer && (
                  <p className="flex items-center gap-2 text-xs text-orange-400">
                    <User className="h-3.5 w-3.5" />
                    Referred by {selected.referrer.display_name || selected.referrer.email}
                  </p>
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
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateLead(selected.id, { status })}
                      disabled={selected.status === status || saving}
                      className="rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
                      style={{
                        borderColor: `${STATUS_COLORS[status]}66`,
                        color: STATUS_COLORS[status],
                        backgroundColor: selected.status === status ? `${STATUS_COLORS[status]}1A` : 'transparent',
                      }}
                    >
                      {LEAD_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3">
                <p className="mb-2 font-condensed text-[11px] uppercase tracking-widest text-[#FFD700]">
                  Attribution
                </p>
                <div className="space-y-1.5">
                  <AttrRow label="Source" value={selected.first_utm_source} />
                  <AttrRow label="Medium" value={selected.first_utm_medium} />
                  <AttrRow label="Campaign" value={selected.first_utm_campaign} />
                  <AttrRow label="Landing" value={selected.first_landing_page} />
                  <AttrRow label="Referrer" value={selected.first_referrer} />
                  <AttrRow label="gclid" value={selected.first_gclid} />
                  <AttrRow label="fbclid" value={selected.first_fbclid} />
                  <AttrRow label="Converting campaign" value={selected.converting_utm_campaign} />
                  {!selected.first_utm_source && !selected.first_gclid && !selected.first_fbclid && (
                    <p className="text-xs text-[#666]">Direct / unattributed</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-[#999]">Log activity</p>
                <textarea
                  value={activityBody}
                  onChange={(e) => setActivityBody(e.target.value)}
                  rows={2}
                  placeholder="Optional note..."
                  className="mb-2 w-full resize-none rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.type}
                      type="button"
                      onClick={() => logActivity(a.type)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A2A] px-2 py-1.5 text-[11px] text-white hover:bg-[#1A1A1A] disabled:opacity-50"
                    >
                      <a.icon className="h-3 w-3" />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-[#999]">Next action</p>
                <input
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Send sample kit"
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

              <div>
                <p className="mb-2 text-xs text-[#999]">Activity</p>
                <ol className="space-y-2">
                  {activities.map((a) => (
                    <li key={a.id} className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2">
                      <p className="text-[11px] text-[#FFD700]">
                        {LEAD_ACTIVITY_LABELS[a.activity_type] || a.activity_type}
                        <span className="ml-2 text-[#666]">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </p>
                      {a.body && <p className="mt-0.5 text-xs text-white">{a.body}</p>}
                    </li>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-xs text-[#666]">No activity yet</p>
                  )}
                </ol>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
