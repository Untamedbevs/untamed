'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, AlertTriangle, CheckCircle, PauseCircle, PlayCircle, History } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Settings {
  marketing_paused: boolean
  marketing_paused_reason: string | null
  weekly_frequency_cap: number
  quiet_hours_start: number
  quiet_hours_end: number
  default_timezone: string
  sunset_days: number
  sunset_min_sends: number
  approval_threshold: number
  complaint_pause_rate: number
  bounce_pause_rate: number
  retention_body_days: number
}

interface AuditRow {
  id: string
  staff_name: string
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

const FIELDS: { key: keyof Settings; label: string; help: string; step?: number; percent?: boolean }[] = [
  { key: 'weekly_frequency_cap', label: 'Weekly frequency cap', help: 'Most marketing emails one person gets in 7 days (campaigns + flows).' },
  { key: 'quiet_hours_start', label: 'Quiet hours start (0–23)', help: 'No marketing after this hour in the recipient’s time zone.' },
  { key: 'quiet_hours_end', label: 'Quiet hours end (0–23)', help: 'Marketing resumes at this hour.' },
  { key: 'sunset_days', label: 'Sunset after (days)', help: 'Stop marketing to people who haven’t opened or clicked in this long…' },
  { key: 'sunset_min_sends', label: 'Sunset after (emails)', help: '…and have been sent at least this many emails since.' },
  { key: 'approval_threshold', label: 'Approval threshold', help: 'Campaigns to more people than this need a second admin. 0 = only contractors and permission requests.' },
  { key: 'complaint_pause_rate', label: 'Auto-pause at complaint rate', help: 'Pause a campaign (and, over 7 days, all marketing) above this.', step: 0.0005, percent: true },
  { key: 'bounce_pause_rate', label: 'Auto-pause at hard-bounce rate', help: 'Pause a campaign above this hard-bounce rate.', step: 0.005, percent: true },
  { key: 'retention_body_days', label: 'Keep email bodies (days)', help: 'After this, message text is cleared; who/when/status is kept. Consent proof is never cleared.' },
]

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Partial<Settings>>({})
  const [readiness, setReadiness] = useState<{ ready: boolean; issues: string[]; warnings: string[] } | null>(null)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/crm/email/settings')
    const json = await res.json()
    if (!res.ok) return setMessage({ tone: 'error', text: json.error || 'Could not load settings' })
    setSettings(json.settings)
    setReadiness(json.readiness)
    setAudit(json.audit)
    setDraft({})
  }

  useEffect(() => {
    load()
  }, [])

  async function save(body: Record<string, unknown>) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/crm/email/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) setMessage({ tone: 'error', text: json.error || 'Save failed' })
      else {
        setMessage({ tone: 'ok', text: 'Saved.' })
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  if (!settings) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-[#A0A0A0]">
        {message ? <p className="text-red-400">{message.text}</p> : <Loader2 className="w-5 h-5 animate-spin inline" />}
      </div>
    )
  }

  const value = (k: keyof Settings) => (draft[k] ?? settings[k]) as number | string

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/crm/email" className="text-[#A0A0A0] hover:text-white" aria-label="Back to email dashboard">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Email settings</h1>
      </div>

      {message && (
        <div className={cn('rounded-lg border p-3 text-sm', message.tone === 'ok' ? 'border-[#9B30FF]/40 text-[#C792FF]' : 'border-red-500/40 bg-red-500/10 text-red-300')}>{message.text}</div>
      )}

      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="text-white font-medium">Marketing kill switch</div>
          <div className="text-xs text-[#A0A0A0]">
            {settings.marketing_paused ? `Paused: ${settings.marketing_paused_reason || 'no reason given'}` : 'Marketing campaigns and marketing flows are sending normally.'} Account notices
            (credit earned, redemption status) keep sending.
          </div>
        </div>
        {settings.marketing_paused ? (
          <button onClick={() => save({ marketing_paused: false })} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-[#9B30FF] text-white">
            <PlayCircle className="w-4 h-4" /> Resume marketing
          </button>
        ) : (
          <button
            onClick={() => {
              const reason = prompt('Why pause all marketing email?')
              if (reason !== null) save({ marketing_paused: true, reason })
            }}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10"
          >
            <PauseCircle className="w-4 h-4" /> Pause all marketing
          </button>
        )}
      </section>

      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">Sending policy</div>
          <button
            onClick={() => save(draft)}
            disabled={busy || Object.keys(draft).length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-[#9B30FF] text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm text-white">{f.label}</span>
              <input
                type="number"
                step={f.step || 1}
                value={value(f.key)}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:border-[#9B30FF]/60"
              />
              <span className="block text-[11px] text-[#666] mt-1">
                {f.help}
                {f.percent ? ` Currently ${(Number(value(f.key)) * 100).toFixed(2)}%.` : ''}
              </span>
            </label>
          ))}
          <label className="block">
            <span className="text-sm text-white">Default time zone</span>
            <input
              value={String(value('default_timezone'))}
              onChange={(e) => setDraft((d) => ({ ...d, default_timezone: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm"
            />
            <span className="block text-[11px] text-[#666] mt-1">Used for quiet hours when a contact&apos;s time zone and state are unknown.</span>
          </label>
        </div>
      </section>

      {readiness && (
        <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">Setup (environment)</div>
          {readiness.issues.length === 0 ? (
            <p className="text-sm text-[#A0A0A0] flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#9B30FF]" /> All required settings are present.</p>
          ) : (
            <ul className="space-y-1">
              {readiness.issues.map((i) => <li key={i} className="text-sm text-red-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{i}</li>)}
            </ul>
          )}
          {readiness.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {readiness.warnings.map((w) => <li key={w} className="text-xs text-amber-300">{w}</li>)}
            </ul>
          )}
          <p className="text-[11px] text-[#666] mt-3">These come from the deployment environment; see docs/email/README.md.</p>
        </section>
      )}

      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">
          <History className="w-4 h-4" /> Staff activity
        </div>
        {audit.length === 0 ? (
          <p className="text-sm text-[#666]">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-[#1A1A1A]">
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 text-[#666] whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-white whitespace-nowrap">{a.staff_name}</td>
                    <td className="py-2 pr-3 text-[#C792FF] whitespace-nowrap">{a.action}</td>
                    <td className="py-2 text-[#A0A0A0] truncate max-w-[360px]">
                      {a.entity_type ? `${a.entity_type} ${a.entity_id || ''}` : ''} {Object.keys(a.details || {}).length ? JSON.stringify(a.details) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
