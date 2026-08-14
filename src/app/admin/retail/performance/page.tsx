'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus } from 'lucide-react'

interface Funnel {
  spend: number
  impressions: number
  clicks: number
  cpc: number
  ctr: number
  paidSessions: number
  lpViews: number
  formStarts: number
  formCompletes: number
  leads: number
  cpl: number
  lpCvr: number
  contacted: number
  contactedWithinSla: number
  slaRate: number
  qualified: number
  converted: number
  costPerDoor: number
}

interface CampaignRow {
  campaign: string
  source: string
  leads: number
  converted: number
  spend: number
  costPerDoor: number | null
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

export default function RetailPerformancePage() {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [showSpend, setShowSpend] = useState(false)
  const [saving, setSaving] = useState(false)
  const [spendForm, setSpendForm] = useState({
    spend_date: new Date().toISOString().slice(0, 10),
    platform: 'meta' as 'meta' | 'google' | 'other',
    campaign_name: '',
    spend: '',
    impressions: '',
    clicks: '',
  })

  function load(d = days) {
    setLoading(true)
    fetch(`/api/admin/retail/performance?days=${d}`)
      .then((res) => res.json())
      .then((data) => {
        setFunnel(data.funnel)
        setCampaigns(data.campaigns || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  async function saveSpend(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/retail/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spend_date: spendForm.spend_date,
          platform: spendForm.platform,
          campaign_name: spendForm.campaign_name || undefined,
          spend: Number(spendForm.spend),
          impressions: spendForm.impressions ? Number(spendForm.impressions) : 0,
          clicks: spendForm.clicks ? Number(spendForm.clicks) : 0,
        }),
      })
      if (res.ok) {
        setShowSpend(false)
        setSpendForm((f) => ({ ...f, spend: '', impressions: '', clicks: '', campaign_name: '' }))
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  const steps = funnel
    ? [
        { label: 'Spend', value: money(funnel.spend) },
        { label: 'Impressions', value: funnel.impressions.toLocaleString() },
        { label: 'Clicks', value: funnel.clicks.toLocaleString(), sub: funnel.impressions ? `${pct(funnel.ctr)} CTR · ${money(funnel.cpc)} CPC` : undefined },
        { label: 'LP views', value: funnel.lpViews.toLocaleString() },
        { label: 'Form starts', value: funnel.formStarts.toLocaleString() },
        { label: 'Leads', value: String(funnel.leads), sub: funnel.leads ? `${money(funnel.cpl)} CPL` : undefined },
        { label: 'Contacted', value: String(funnel.contacted), sub: `${pct(funnel.slaRate)} within 48h` },
        { label: 'Qualified', value: String(funnel.qualified) },
        { label: 'Doors', value: String(funnel.converted), sub: funnel.converted ? `${money(funnel.costPerDoor)} / door` : undefined },
      ]
    : []

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Retail Performance</h1>
          <p className="text-sm text-[#999]">Spend through doors. First-party attribution is the source of truth.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                days === d ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#2A2A2A] text-[#999]'
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowSpend((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-white hover:bg-[#1A1A1A]"
          >
            <Plus className="h-3.5 w-3.5" /> Log spend
          </button>
          <Link href="/admin/retail" className="text-xs text-[#999] hover:text-white">
            Workbench
          </Link>
        </div>
      </div>

      {showSpend && (
        <form onSubmit={saveSpend} className="mb-6 grid gap-3 rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 sm:grid-cols-6">
          <input
            type="date"
            required
            value={spendForm.spend_date}
            onChange={(e) => setSpendForm((f) => ({ ...f, spend_date: e.target.value }))}
            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
          />
          <select
            value={spendForm.platform}
            onChange={(e) => setSpendForm((f) => ({ ...f, platform: e.target.value as 'meta' | 'google' | 'other' }))}
            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
          >
            <option value="meta">Meta</option>
            <option value="google">Google</option>
            <option value="other">Other</option>
          </select>
          <input
            placeholder="Campaign"
            value={spendForm.campaign_name}
            onChange={(e) => setSpendForm((f) => ({ ...f, campaign_name: e.target.value }))}
            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0"
            placeholder="Spend $"
            value={spendForm.spend}
            onChange={(e) => setSpendForm((f) => ({ ...f, spend: e.target.value }))}
            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
          />
          <input
            type="number"
            min="0"
            placeholder="Impressions"
            value={spendForm.impressions}
            onChange={(e) => setSpendForm((f) => ({ ...f, impressions: e.target.value }))}
            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#FFD700] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <input
            type="number"
            min="0"
            placeholder="Clicks"
            value={spendForm.clicks}
            onChange={(e) => setSpendForm((f) => ({ ...f, clicks: e.target.value }))}
            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white sm:col-start-5"
          />
        </form>
      )}

      {loading || !funnel ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {steps.map((s) => (
              <div key={s.label} className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
                <p className="text-[11px] uppercase tracking-widest text-[#666]">{s.label}</p>
                <p className="mt-1 font-condensed text-2xl font-bold text-white">{s.value}</p>
                {s.sub && <p className="mt-1 text-xs text-[#999]">{s.sub}</p>}
              </div>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-[#2A2A2A]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#141414] text-xs uppercase tracking-widest text-[#666]">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Doors</th>
                  <th className="px-4 py-3">Spend</th>
                  <th className="px-4 py-3">$ / door</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={`${c.source}-${c.campaign}`} className="border-b border-[#2A2A2A] last:border-0">
                    <td className="px-4 py-3 text-white">{c.source}</td>
                    <td className="px-4 py-3 text-[#999]">{c.campaign}</td>
                    <td className="px-4 py-3 text-white">{c.leads}</td>
                    <td className="px-4 py-3 text-[#FFD700]">{c.converted}</td>
                    <td className="px-4 py-3 text-white">{c.spend ? money(c.spend) : '—'}</td>
                    <td className="px-4 py-3 text-white">{c.costPerDoor != null ? money(c.costPerDoor) : '—'}</td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#666]">
                      No attributed retail leads in this window yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
