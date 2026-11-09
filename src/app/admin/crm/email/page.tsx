'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  Send,
  Workflow,
  LayoutTemplate,
  Users,
  Mail,
  Settings,
  Plus,
  PauseCircle,
  PlayCircle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { FlowStatusBadge } from '@/components/admin/email/FlowStatusBadge'
import { cn } from '@/lib/utils'

interface Health {
  sent: number
  delivered: number
  bounced: number
  complaints: number
  opened: number
  clicked: number
}

interface SendStats {
  sent: number
  delivered: number
  clicked: number
  unsubscribes: number
  complaints: number
  orders: number
  revenue_cents: number
}

interface DashboardData {
  readiness: { ready: boolean; issues: string[]; warnings: string[] }
  settings: { marketingPaused: boolean; marketingPausedReason: string | null; complaintPauseRate: number; bouncePauseRate: number }
  canManage: boolean
  today: { sent: number; cap: number | null }
  health: { marketing: Health; transactional: Health }
  alerts: { id: string; kind: string; severity: string; message: string; created_at: string }[]
  contacts: number
  lists: { slug: string; name: string; subscribed: number }[]
  growth: { day: string; list_slug: string; opt_ins: number; opt_outs: number }[]
  campaigns: {
    id: string
    name: string
    subject: string
    kind: string
    status: string
    audience_count: number
    scheduled_for: string | null
    created_at: string
    stats: SendStats | null
  }[]
  flows: { slug: string; name: string; status: string; stream: string; triggerDescription: string; active: number; stats: SendStats | null }[]
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(n / d < 0.01 ? 2 : 1)}%` : '—')
const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

export default function EmailDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/email/dashboard')
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not load the dashboard')
      else setData(json)
    } catch {
      setError('Could not load the dashboard')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleMarketing(paused: boolean) {
    const reason = paused ? prompt('Why pause all marketing email?') : null
    if (paused && reason === null) return
    setBusy(true)
    await fetch('/api/admin/crm/email/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketing_paused: paused, reason }),
    })
    await load()
    setBusy(false)
  }

  async function resolveAlert(id: string) {
    await fetch('/api/admin/crm/email/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  if (error) return <div className="max-w-6xl mx-auto rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">{error}</div>
  if (!data) return <div className="max-w-6xl mx-auto py-16 text-center text-[#A0A0A0]"><Loader2 className="w-5 h-5 animate-spin inline" /></div>

  const m = data.health.marketing
  const complaintRate = m.delivered > 0 ? m.complaints / m.delivered : 0
  const bounceRate = m.sent > 0 ? m.bounced / m.sent : 0
  const growthByList = new Map<string, { ins: number; outs: number }>()
  let unsubAll = 0
  for (const g of data.growth) {
    if (g.list_slug === 'all') {
      unsubAll += g.opt_outs
      continue
    }
    const cur = growthByList.get(g.list_slug) || { ins: 0, outs: 0 }
    cur.ins += g.opt_ins
    cur.outs += g.opt_outs
    growthByList.set(g.list_slug, cur)
  }
  const pendingApproval = data.campaigns.filter((c) => c.status === 'pending_approval')

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Email</h1>
          <p className="text-sm text-[#A0A0A0]">Deliverability, campaigns, automated flows, and list growth.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/admin/crm/contacts" icon={<Users className="w-4 h-4" />}>Contacts</QuickLink>
          <QuickLink href="/admin/crm/email/templates" icon={<LayoutTemplate className="w-4 h-4" />}>Templates</QuickLink>
          <QuickLink href="/admin/crm/outreach" icon={<Mail className="w-4 h-4" />}>Outreach</QuickLink>
          <QuickLink href="/admin/crm/email/settings" icon={<Settings className="w-4 h-4" />}>Settings</QuickLink>
          <Link href="/admin/crm/blast" className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#B560FF]">
            <Plus className="w-4 h-4" /> New campaign
          </Link>
        </div>
      </div>

      {data.settings.marketingPaused ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-red-300 text-sm">
            <PauseCircle className="w-5 h-5" /> All marketing email is paused{data.settings.marketingPausedReason ? `: ${data.settings.marketingPausedReason}` : ''}.
          </div>
          {data.canManage && (
            <button onClick={() => toggleMarketing(false)} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-[#9B30FF] text-white">
              <PlayCircle className="w-4 h-4" /> Resume marketing
            </button>
          )}
        </div>
      ) : !data.readiness.ready ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-center gap-2 font-medium mb-1"><AlertTriangle className="w-4 h-4" /> Marketing can&apos;t send yet</div>
          <ul className="list-disc pl-6 text-xs space-y-0.5">{data.readiness.issues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-[#A0A0A0]"><CheckCircle className="w-4 h-4 text-[#9B30FF]" /> Marketing is live.</span>
          {data.canManage && (
            <button onClick={() => toggleMarketing(true)} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10">
              <PauseCircle className="w-3.5 h-3.5" /> Pause all marketing
            </button>
          )}
        </div>
      )}

      {data.alerts.length > 0 && (
        <section className="space-y-2">
          {data.alerts.map((a) => (
            <div key={a.id} className={cn('rounded-lg border p-3 flex items-start justify-between gap-3 text-sm', a.severity === 'critical' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-200')}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  {a.message}
                  <div className="text-[10px] opacity-70 mt-0.5">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              </div>
              {data.canManage && <button onClick={() => resolveAlert(a.id)} className="text-xs underline shrink-0">Resolve</button>}
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile label="Marketing sent (30d)" value={m.sent.toLocaleString()} />
        <Tile label="Delivered" value={pct(m.delivered, m.sent)} />
        <Tile label="Clicked" value={pct(m.clicked, m.delivered)} sub="of delivered" />
        <Tile label="Complaints" value={pct(m.complaints, m.delivered)} warn={complaintRate > data.settings.complaintPauseRate / 3} bad={complaintRate > data.settings.complaintPauseRate} sub="keep under 0.1%" />
        <Tile label="Hard bounces" value={pct(m.bounced, m.sent)} warn={bounceRate > 0.02} bad={bounceRate > data.settings.bouncePauseRate} sub="keep under 2%" />
        <Tile label="Sent today" value={data.today.sent.toLocaleString()} sub={data.today.cap ? `cap ${data.today.cap.toLocaleString()}` : 'no daily cap'} />
      </div>

      <section className="rounded-xl border border-[#9B30FF]/30 bg-[#111] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Workflow className="w-4 h-4 text-[#9B30FF]" /> Automated flows
          </h2>
          <Link href="/admin/crm/email/flows" className="text-xs text-[#C792FF] hover:underline flex items-center gap-1">
            Manage flows <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.flows.map((f) => (
            <Link
              key={f.slug}
              href={f.status === 'unavailable' ? '/admin/crm/email/flows' : `/admin/crm/email/flows/${f.slug}`}
              className={cn('rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3 hover:border-[#9B30FF]/50', f.status === 'unavailable' && 'opacity-50')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white truncate">{f.name}</span>
                <FlowStatusBadge status={f.status} />
              </div>
              <div className="text-[11px] text-[#A0A0A0] mt-0.5 truncate">{f.triggerDescription}</div>
              <div className="text-[11px] text-[#666] mt-1">
                {f.active} in flow · {(f.stats?.sent || 0).toLocaleString()} sent · {(f.stats?.clicked || 0).toLocaleString()} clicks · {money(f.stats?.revenue_cents || 0)}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-xl border border-[#2A2A2A] bg-[#111] p-4 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Send className="w-4 h-4 text-[#9B30FF]" /> Campaigns</h2>
            {pendingApproval.length > 0 && (
              <span className="text-xs text-amber-300 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {pendingApproval.length} waiting for approval</span>
            )}
          </div>
          {data.campaigns.length === 0 ? (
            <p className="text-sm text-[#666]">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#666] text-left">
                    <th className="pb-2 font-normal">Campaign</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal text-right">Sent</th>
                    <th className="pb-2 font-normal text-right">Clicks</th>
                    <th className="pb-2 font-normal text-right">Unsubs</th>
                    <th className="pb-2 font-normal text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {data.campaigns.map((c) => (
                    <tr key={c.id} className="text-xs">
                      <td className="py-2 pr-2 max-w-[260px]">
                        <Link href={`/admin/crm/blast/${c.id}`} className="text-white hover:text-[#C792FF] truncate block">{c.name || c.subject}</Link>
                        <span className="text-[10px] text-[#666]">
                          {c.kind === 'repermission' ? 'Permission request · ' : ''}
                          {c.scheduled_for && c.status === 'scheduled' ? `for ${new Date(c.scheduled_for).toLocaleString()}` : new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-2 text-[#A0A0A0]">{c.status.replace('_', ' ')}</td>
                      <td className="py-2 text-right text-[#D0D0D0]">{(c.stats?.sent || 0).toLocaleString()}</td>
                      <td className="py-2 text-right text-[#D0D0D0]">{pct(c.stats?.clicked || 0, c.stats?.delivered || 0)}</td>
                      <td className="py-2 text-right text-[#D0D0D0]">{(c.stats?.unsubscribes || 0).toLocaleString()}</td>
                      <td className="py-2 text-right text-[#C792FF]">{money(c.stats?.revenue_cents || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-[#666] mt-3">Revenue: online orders placed within 7 days of clicking the email.</p>
        </section>

        <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-1"><Users className="w-4 h-4 text-[#9B30FF]" /> Lists</h2>
          <p className="text-xs text-[#666] mb-3">{data.contacts.toLocaleString()} contacts · last 30 days</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#666] text-left">
                <th className="pb-2 font-normal">List</th>
                <th className="pb-2 font-normal text-right">Subscribed</th>
                <th className="pb-2 font-normal text-right">+ / −</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {data.lists.map((l) => {
                const g = growthByList.get(l.slug) || { ins: 0, outs: 0 }
                return (
                  <tr key={l.slug}>
                    <td className="py-2 text-white">{l.name}</td>
                    <td className="py-2 text-right text-[#D0D0D0]">{l.subscribed.toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <span className="text-green-400">+{g.ins}</span> <span className="text-red-400">−{g.outs}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {unsubAll > 0 && <p className="text-[11px] text-[#A0A0A0] mt-2">{unsubAll} unsubscribed from everything.</p>}
        </section>
      </div>
    </div>
  )
}

function QuickLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border border-[#2A2A2A] text-[#A0A0A0] hover:text-white">
      {icon}
      {children}
    </Link>
  )
}

function Tile({ label, value, sub, warn, bad }: { label: string; value: string; sub?: string; warn?: boolean; bad?: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-[#111] p-4', bad ? 'border-red-500/50' : warn ? 'border-amber-500/40' : 'border-[#2A2A2A]')}>
      <div className="text-[10px] uppercase tracking-wider text-[#A0A0A0] mb-1">{label}</div>
      <div className={cn('text-xl font-bold', bad ? 'text-red-400' : warn ? 'text-amber-300' : 'text-white')}>{value}</div>
      {sub && <div className="text-[10px] text-[#666] mt-0.5">{sub}</div>}
    </div>
  )
}
