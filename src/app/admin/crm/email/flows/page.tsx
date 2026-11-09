'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Workflow,
  ShoppingBag,
  Gift,
  Repeat,
  Cake,
  Sparkles,
  Bell,
  ChevronRight,
  ShoppingCart,
  Coins,
  PackageCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FlowStatusBadge } from '@/components/admin/email/FlowStatusBadge'

interface FlowSummary {
  slug: string
  name: string
  description: string | null
  trigger: string
  triggerDescription: string
  stream: 'marketing' | 'transactional'
  list_slug: string | null
  status: 'draft' | 'active' | 'paused' | 'unavailable'
  stepCount: number
  enrollments: Record<string, number>
  stats30d: { sent: number; clicked: number; unsubscribes: number; orders: number; revenue_cents: number } | null
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  list_opt_in: Sparkles,
  order_placed: ShoppingBag,
  order_lapsed: Repeat,
  referral_credit: Gift,
  points_balance: Coins,
  redemption_created: Bell,
  redemption_fulfilled: PackageCheck,
  birthday: Cake,
  cart_abandoned: ShoppingCart,
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/crm/email/flows')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) setError(json.error || 'Could not load flows')
        else setFlows(json.flows)
      })
      .catch(() => setError('Could not load flows'))
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/crm/email" className="text-[#A0A0A0] hover:text-white" aria-label="Back to email dashboard">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Workflow className="w-6 h-6 text-[#9B30FF]" /> Automated flows
        </h1>
      </div>
      <p className="text-sm text-[#A0A0A0] mb-6 max-w-3xl">
        Emails that send themselves when something happens: a first opt-in, an order, a lapsed customer, referral credit,
        a redemption, a birthday. Every flow starts as a draft. Review the copy, send yourself a test, then activate it.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        <Journey
          title="Order journey (previous orders)"
          steps={['Order placed', '3 days: how’s it going + share for points', '18 days: reorder reminder (skipped if they reordered)', '60 days quiet: win-back (stops when they order)']}
        />
        <Journey
          title="Referral credit → redemption"
          steps={['Friend joins or buys: points credited', 'Email: credit earned + what it redeems for', '7 days later, not redeemed: reminder', 'Redeem: confirmation, then “on its way” when fulfilled']}
        />
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {!flows ? (
        <div className="py-16 text-center text-[#A0A0A0]"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : (
        <div className="space-y-2">
          {flows.map((f) => {
            const Icon = ICONS[f.trigger] || Workflow
            const active = f.enrollments.active || 0
            const body = (
              <>
                <div className="p-2 rounded-lg bg-[#9B30FF]/15 text-[#9B30FF] shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-medium">{f.name}</span>
                    <FlowStatusBadge status={f.status} />
                    <span className={cn('text-[10px] uppercase tracking-wider', f.stream === 'marketing' ? 'text-[#C792FF]' : 'text-sky-300')}>
                      {f.stream === 'marketing' ? `marketing · needs opt-in${f.list_slug ? ` (${f.list_slug})` : ''}` : 'account notice'}
                    </span>
                  </div>
                  <div className="text-xs text-[#A0A0A0] mt-0.5">{f.triggerDescription} · {f.stepCount} step{f.stepCount === 1 ? '' : 's'}</div>
                  {f.status === 'unavailable' && f.description && <div className="text-xs text-[#666] mt-0.5">{f.description}</div>}
                </div>
                <div className="hidden sm:grid grid-cols-4 gap-4 text-right text-xs shrink-0">
                  <Metric label="In flow" value={active.toLocaleString()} />
                  <Metric label="Sent 30d" value={(f.stats30d?.sent || 0).toLocaleString()} />
                  <Metric label="Clicks" value={(f.stats30d?.clicked || 0).toLocaleString()} />
                  <Metric label="Revenue" value={`$${((f.stats30d?.revenue_cents || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                </div>
                {f.status !== 'unavailable' && <ChevronRight className="w-4 h-4 text-[#666] shrink-0" />}
              </>
            )
            return f.status === 'unavailable' ? (
              <div key={f.slug} className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#111] p-4 opacity-60">{body}</div>
            ) : (
              <Link key={f.slug} href={`/admin/crm/email/flows/${f.slug}`} className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#111] p-4 hover:border-[#9B30FF]/50">
                {body}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white font-medium">{value}</div>
      <div className="text-[10px] text-[#666]">{label}</div>
    </div>
  )
}

function Journey({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">{title}</div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-2 text-sm text-[#D0D0D0]">
            <span className="shrink-0 w-5 h-5 rounded-full bg-[#9B30FF]/20 text-[#C792FF] text-[11px] flex items-center justify-center">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}
