'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw, Trash2, Users, Send } from 'lucide-react'
import { ALL_FILTER_OPTIONS, formatFilterValue } from '@/lib/crm/blast-constants'

interface Segment {
  id: string
  name: string
  description: string | null
  filters: Record<string, unknown> & { audience: string }
  last_count: number | null
  last_counted_at: string | null
}

const AUDIENCE_LABELS: Record<string, string> = {
  loyalty: 'Loyalty members',
  referrers: 'Referrers',
  distributors: 'Distributor leads',
  all: 'All contacts',
  staff: 'Team (internal)',
}

function describeFilters(f: Segment['filters']): string[] {
  return Object.entries(f)
    .filter(([k]) => k !== 'audience')
    .map(([k, v]) => {
      const label = ALL_FILTER_OPTIONS.find((o) => o.value === k)?.label || k
      const val = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : formatFilterValue(String(v))
      return `${label}: ${val}`
    })
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/crm/segments')
    const data = await res.json().catch(() => ({}))
    setSegments(data.segments || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function recount(id: string) {
    setBusyId(id)
    setError(null)
    const res = await fetch(`/api/admin/crm/segments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recount: true }),
    })
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Recount failed')
    setBusyId(null)
    load()
  }

  async function rename(sg: Segment) {
    const name = prompt('Segment name', sg.name)?.trim()
    if (!name || name === sg.name) return
    const res = await fetch(`/api/admin/crm/segments/${sg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Rename failed')
    load()
  }

  async function remove(sg: Segment) {
    if (!confirm(`Delete segment "${sg.name}"? Past campaigns are not affected.`)) return
    await fetch(`/api/admin/crm/segments/${sg.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm" className="text-[#A0A0A0] hover:text-white" aria-label="Back to CRM">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Segments</h1>
        </div>
        <Link
          href="/admin/crm/blast"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#B560FF]"
        >
          <Send className="w-4 h-4" /> New blast
        </Link>
      </div>
      <p className="text-sm text-[#A0A0A0] mb-6">
        Saved audiences. Build one in the blast composer with filters, then &ldquo;Save as segment&rdquo;. Membership is
        live: each send re-runs the filters and drops unsubscribed or bounced addresses.
      </p>

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#A0A0A0]" />
      ) : segments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] p-10 text-center text-sm text-[#A0A0A0]">
          No segments yet.
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((sg) => {
            const rules = describeFilters(sg.filters)
            return (
              <div key={sg.id} className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 flex items-start gap-4">
                <div className="p-2 rounded-lg bg-[#9B30FF]/15 text-[#9B30FF]">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <button onClick={() => rename(sg)} className="text-white font-medium hover:underline text-left">
                    {sg.name}
                  </button>
                  {sg.description && <div className="text-xs text-[#A0A0A0] mt-0.5">{sg.description}</div>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#9B30FF]/10 text-[#B560FF]">
                      {AUDIENCE_LABELS[sg.filters.audience] || sg.filters.audience}
                    </span>
                    {rules.map((r) => (
                      <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-[#1A1A1A] text-[#A0A0A0]">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-white">
                    {sg.last_count === null ? '—' : sg.last_count.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#666]">
                    {sg.last_counted_at ? `as of ${new Date(sg.last_counted_at).toLocaleDateString()}` : 'not counted'}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button
                      onClick={() => recount(sg.id)}
                      disabled={busyId === sg.id}
                      className="p-1.5 rounded-md text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]"
                      title="Recount"
                    >
                      <RefreshCw className={busyId === sg.id ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
                    </button>
                    <button
                      onClick={() => remove(sg)}
                      className="p-1.5 rounded-md text-[#A0A0A0] hover:text-red-400 hover:bg-red-400/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
