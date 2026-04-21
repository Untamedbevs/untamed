'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Loader2, ChevronDown, MessageSquare,
  MapPin, Phone, Mail, User, Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BUSINESS_TYPE_LABELS, VOLUME_INTEREST_LABELS, LEAD_STATUS_LABELS } from '@/lib/referral/constants'
import type { DistributorLead, DistributorLeadStatus } from '@/lib/referral/types'

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

export default function AdminDistributorLeadsPage() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<LeadWithReferrer[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [filterStatus, setFilterStatus] = useState<DistributorLeadStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/admin/distributor-leads')
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.leads)
        setStatusCounts(data.statusCounts)
      })
      .finally(() => setLoading(false))
  }, [])

  async function updateLead(id: string, updates: { status?: string; admin_notes?: string }) {
    setSaving((prev) => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(`/api/admin/distributor-leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)))

        // Recalculate status counts
        const newCounts: Record<string, number> = {}
        const updatedLeads = leads.map((l) => (l.id === id ? data.lead : l))
        for (const l of updatedLeads) {
          newCounts[l.status] = (newCounts[l.status] || 0) + 1
        }
        setStatusCounts(newCounts)
      }
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  const filteredLeads = filterStatus === 'all'
    ? leads
    : leads.filter((l) => l.status === filterStatus)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Distributor Leads</h1>
        <span className="text-sm text-[#999]">{leads.length} total</span>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
            filterStatus === 'all'
              ? 'border-white bg-white/10 text-white'
              : 'border-[#2A2A2A] text-[#999] hover:text-white'
          )}
        >
          All ({leads.length})
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
              filterStatus === status
                ? 'text-white'
                : 'text-[#999] hover:text-white'
            )}
            style={{
              borderColor: filterStatus === status ? STATUS_COLORS[status] : '#2A2A2A',
              backgroundColor: filterStatus === status ? `${STATUS_COLORS[status]}1A` : 'transparent',
            }}
          >
            {LEAD_STATUS_LABELS[status]} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {/* Leads list */}
      <div className="space-y-3">
        {filteredLeads.map((lead) => {
          const expanded = expandedId === lead.id
          const notesKey = lead.id
          const currentNotes = editNotes[notesKey] ?? lead.admin_notes ?? ''

          return (
            <div
              key={lead.id}
              className="rounded-xl border border-[#2A2A2A] bg-[#141414] overflow-hidden"
            >
              {/* Lead header */}
              <button
                onClick={() => setExpandedId(expanded ? null : lead.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#1A1A1A] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${STATUS_COLORS[lead.status]}1A` }}
                  >
                    <Building2 className="w-5 h-5" style={{ color: STATUS_COLORS[lead.status] }} />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">{lead.business_name}</p>
                    <p className="text-xs text-[#999]">
                      {lead.contact_name} &middot; {BUSINESS_TYPE_LABELS[lead.business_type]}
                      {lead.location && ` &middot; ${lead.location}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: `${STATUS_COLORS[lead.status]}1A`,
                      color: STATUS_COLORS[lead.status],
                    }}
                  >
                    {LEAD_STATUS_LABELS[lead.status]}
                  </span>
                  <span className="text-xs text-[#666]">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-[#999] transition-transform',
                      expanded && 'rotate-180'
                    )}
                  />
                </div>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-5 pb-5 border-t border-[#2A2A2A] pt-4 space-y-4">
                  {/* Contact info */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-[#999]" />
                      <a href={`mailto:${lead.email}`} className="text-blue-400 hover:underline">
                        {lead.email}
                      </a>
                    </div>
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-[#999]" />
                        <span className="text-white">{lead.phone}</span>
                      </div>
                    )}
                    {lead.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-[#999]" />
                        <span className="text-white">{lead.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Volume + referrer */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {lead.volume_interest && (
                      <span className="text-[#999]">
                        Volume: <span className="text-white">{VOLUME_INTEREST_LABELS[lead.volume_interest]}</span>
                      </span>
                    )}
                    {lead.referrer && (
                      <span className="text-[#999]">
                        <User className="w-3 h-3 inline mr-1" />
                        Referred by:{' '}
                        <span className="text-orange-400">
                          {lead.referrer.display_name || lead.referrer.email}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  {lead.message && (
                    <div>
                      <p className="text-xs text-[#999] mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Message
                      </p>
                      <p className="text-sm text-white bg-[#0A0A0A] rounded-lg p-3 border border-[#2A2A2A]">
                        {lead.message}
                      </p>
                    </div>
                  )}

                  {/* Status update */}
                  <div>
                    <p className="text-xs text-[#999] mb-2">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((status) => (
                        <button
                          key={status}
                          onClick={() => updateLead(lead.id, { status })}
                          disabled={lead.status === status || saving[lead.id]}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            lead.status === status
                              ? 'opacity-50 cursor-default'
                              : 'hover:scale-105 cursor-pointer'
                          )}
                          style={{
                            borderColor: `${STATUS_COLORS[status]}66`,
                            backgroundColor: lead.status === status ? `${STATUS_COLORS[status]}1A` : 'transparent',
                            color: STATUS_COLORS[status],
                          }}
                        >
                          {LEAD_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Admin notes */}
                  <div>
                    <p className="text-xs text-[#999] mb-2">Admin Notes</p>
                    <div className="flex gap-2">
                      <textarea
                        value={currentNotes}
                        onChange={(e) => setEditNotes((prev) => ({ ...prev, [notesKey]: e.target.value }))}
                        rows={2}
                        className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-sm placeholder:text-[#666] focus:outline-none resize-none"
                        placeholder="Internal notes..."
                      />
                      <button
                        onClick={() => updateLead(lead.id, { admin_notes: currentNotes })}
                        disabled={saving[lead.id]}
                        className="self-end px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm hover:bg-[#222] transition-colors disabled:opacity-50"
                      >
                        {saving[lead.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filteredLeads.length === 0 && (
          <p className="text-center py-12 text-[#666]">No leads found</p>
        )}
      </div>
    </div>
  )
}
