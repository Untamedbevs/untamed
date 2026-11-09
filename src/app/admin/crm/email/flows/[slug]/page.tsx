'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Play, Pause, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { ContentEditor } from '@/components/admin/email/ContentEditor'
import { FlowStatusBadge } from '@/components/admin/email/FlowStatusBadge'
import type { EmailBlock } from '@/lib/email/blocks'
import { cn } from '@/lib/utils'

interface Flow {
  slug: string
  name: string
  description: string | null
  trigger: string
  triggerDescription: string
  trigger_config: Record<string, number>
  stream: 'marketing' | 'transactional'
  list_slug: string | null
  status: 'draft' | 'active' | 'paused' | 'unavailable'
  sender_id: string
}

interface Step {
  id?: string
  delay_hours: number
  subject: string
  preheader: string | null
  blocks: EmailBlock[]
  list_slug: string | null
  exit_if: string | null
  is_active: boolean
}

interface Enrollment {
  id: string
  email: string
  status: string
  next_step_order: number | null
  next_run_at: string | null
  steps_sent: number
  exit_reason: string | null
  enrolled_at: string
}

const EXIT_OPTIONS = [
  { value: '', label: 'Always send' },
  { value: 'ordered_since_enrollment', label: 'Skip and end if they ordered since entering' },
  { value: 'redeemed_since_enrollment', label: 'Skip and end if they redeemed since entering' },
  { value: 'balance_below_min_reward', label: 'Skip and end if their points can’t cover a reward' },
]

const CONFIG_FIELDS: Record<string, { key: string; label: string }[]> = {
  order_lapsed: [{ key: 'days', label: 'Days since last order' }],
  points_balance: [
    { key: 'min_points', label: 'Minimum points balance' },
    { key: 'every_days', label: 'At most once every (days)' },
  ],
}

const input = 'px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:border-[#9B30FF]/60'

function delayLabel(hours: number): string {
  if (hours === 0) return 'immediately'
  if (hours % 24 === 0) return `${hours / 24} day${hours === 24 ? '' : 's'}`
  return `${hours} hour${hours === 1 ? '' : 's'}`
}

export default function FlowEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [lists, setLists] = useState<{ slug: string; name: string }[]>([])
  const [senders, setSenders] = useState<{ id: string; label: string; email: string }[]>([])
  const [canActivate, setCanActivate] = useState(false)
  const [open, setOpen] = useState<number | null>(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/email/flows/${slug}`)
    const json = await res.json()
    if (!res.ok) return setMessage({ tone: 'error', text: json.error || 'Could not load flow' })
    setFlow(json.flow)
    setSteps(json.steps)
    setEnrollments(json.enrollments)
    setLists(json.lists)
    setSenders(json.senders)
    setCanActivate(json.canActivate)
    setDirty(false)
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))
    setDirty(true)
  }

  async function saveSteps() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/crm/email/flows/${slug}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })
      const json = await res.json()
      if (!res.ok) setMessage({ tone: 'error', text: json.error || 'Save failed' })
      else {
        setSteps(json.steps)
        setDirty(false)
        setMessage({ tone: 'ok', text: 'Steps saved.' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function patchFlow(patch: Record<string, unknown>) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/crm/email/flows/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) setMessage({ tone: 'error', text: [json.error, ...(json.issues || [])].filter(Boolean).join(' ') })
      else {
        setMessage({ tone: 'ok', text: 'Flow updated.' })
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  async function stopEnrollment(id: string) {
    if (!confirm('Stop this person’s flow? They won’t get the remaining emails.')) return
    await fetch(`/api/admin/crm/email/flows/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_enrollment', enrollmentId: id }),
    })
    await load()
  }

  if (!flow) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center text-[#A0A0A0]">
        {message ? <p className="text-red-400">{message.text}</p> : <Loader2 className="w-5 h-5 animate-spin inline" />}
      </div>
    )
  }

  const listName = lists.find((l) => l.slug === flow.list_slug)?.name

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin/crm/email/flows" className="text-[#A0A0A0] hover:text-white" aria-label="Back to flows">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {flow.name} <FlowStatusBadge status={flow.status} />
            </h1>
            <p className="text-xs text-[#A0A0A0]">Starts on: {flow.triggerDescription}</p>
          </div>
        </div>
        {canActivate && flow.status !== 'unavailable' && (
          <div className="flex items-center gap-2">
            {flow.status === 'active' ? (
              <button onClick={() => patchFlow({ status: 'paused' })} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border border-[#2A2A2A] text-[#A0A0A0] hover:text-white">
                <Pause className="w-4 h-4" /> Pause
              </button>
            ) : (
              <button
                onClick={() => patchFlow({ status: 'active' })}
                disabled={busy || dirty}
                title={dirty ? 'Save the steps first' : undefined}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-[#9B30FF] text-white hover:bg-[#B560FF] disabled:opacity-50"
              >
                <Play className="w-4 h-4" /> Activate
              </button>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={cn('rounded-lg border p-3 text-sm', message.tone === 'ok' ? 'border-[#9B30FF]/40 text-[#C792FF]' : 'border-red-500/40 bg-red-500/10 text-red-300')}>
          {message.text}
        </div>
      )}

      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">Settings</div>
        <p className="text-sm text-[#D0D0D0] mb-4">{flow.description}</p>
        <div className="flex flex-wrap items-end gap-4">
          {flow.stream === 'marketing' ? (
            <label className="text-xs text-[#A0A0A0]">
              Needs an opt-in to
              <select
                className={cn(input, 'block mt-1')}
                value={flow.list_slug || ''}
                disabled={!canActivate}
                onChange={(e) => patchFlow({ list_slug: e.target.value })}
              >
                {lists.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="text-xs text-[#A0A0A0] max-w-sm">
              Account notice: goes to the member without a list opt-in, but anyone who unsubscribed, bounced, or complained is never emailed.
            </div>
          )}
          <label className="text-xs text-[#A0A0A0]">
            From
            <select className={cn(input, 'block mt-1')} value={flow.sender_id} disabled={!canActivate} onChange={(e) => patchFlow({ sender_id: e.target.value })}>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
            </select>
          </label>
          {(CONFIG_FIELDS[flow.trigger] || []).map((f) => (
            <label key={f.key} className="text-xs text-[#A0A0A0]">
              {f.label}
              <input
                type="number"
                min={1}
                className={cn(input, 'block mt-1 w-40')}
                defaultValue={flow.trigger_config?.[f.key] ?? ''}
                disabled={!canActivate}
                onBlur={(e) => patchFlow({ trigger_config: { [f.key]: Number(e.target.value) } })}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">Steps</div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
            <button onClick={saveSteps} disabled={busy || !dirty} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-[#9B30FF] text-white hover:bg-[#B560FF] disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save steps
            </button>
          </div>
        </div>
        {flow.status === 'active' && dirty && (
          <p className="text-xs text-amber-300 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> This flow is live: saved changes apply to the next emails it sends.
          </p>
        )}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step.id || `new-${i}`} className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">
                    {i + 1}. {step.subject || 'Untitled email'} {!step.is_active && <span className="text-xs text-[#666]">(off)</span>}
                  </div>
                  <div className="text-xs text-[#A0A0A0]">
                    {i === 0 ? 'Sends' : 'Then'} {delayLabel(step.delay_hours)} {i === 0 ? 'after the trigger' : 'later'}
                    {step.exit_if ? ` · ${EXIT_OPTIONS.find((o) => o.value === step.exit_if)?.label.toLowerCase()}` : ''}
                  </div>
                </div>
                {open === i ? <ChevronUp className="w-4 h-4 text-[#666]" /> : <ChevronDown className="w-4 h-4 text-[#666]" />}
              </button>
              {open === i && (
                <div className="border-t border-[#2A2A2A] p-3 space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-[#A0A0A0]">
                      Wait (hours)
                      <input type="number" min={0} className={cn(input, 'block mt-1 w-28')} value={step.delay_hours} onChange={(e) => updateStep(i, { delay_hours: Number(e.target.value) })} />
                    </label>
                    <label className="text-xs text-[#A0A0A0]">
                      Exit rule
                      <select className={cn(input, 'block mt-1')} value={step.exit_if || ''} onChange={(e) => updateStep(i, { exit_if: e.target.value || null })}>
                        {EXIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    {flow.stream === 'marketing' && (
                      <label className="text-xs text-[#A0A0A0]">
                        Opt-in list for this step
                        <select className={cn(input, 'block mt-1')} value={step.list_slug || ''} onChange={(e) => updateStep(i, { list_slug: e.target.value || null })}>
                          <option value="">Same as the flow ({listName || flow.list_slug})</option>
                          {lists.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-xs text-[#A0A0A0] pb-2">
                      <input type="checkbox" className="accent-[#9B30FF]" checked={step.is_active} onChange={(e) => updateStep(i, { is_active: e.target.checked })} /> Step on
                    </label>
                    <button
                      onClick={() => {
                        setSteps((prev) => prev.filter((_, j) => j !== i))
                        setDirty(true)
                        setOpen(null)
                      }}
                      className="flex items-center gap-1 text-xs text-red-400 pb-2 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove step
                    </button>
                  </div>
                  <ContentEditor
                    value={{ subject: step.subject, preheader: step.preheader || '', blocks: step.blocks }}
                    onChange={(c) => updateStep(i, { subject: c.subject, preheader: c.preheader, blocks: c.blocks })}
                    kind={flow.stream}
                    listName={lists.find((l) => l.slug === (step.list_slug || flow.list_slug))?.name}
                    flowTags
                  />
                </div>
              )}
            </div>
          ))}
          {steps.length < 10 && (
            <button
              onClick={() => {
                setSteps((prev) => [
                  ...prev,
                  { delay_hours: 72, subject: '', preheader: '', blocks: [{ type: 'text', text: 'Hey {{first_name|there}},\n\n' }], list_slug: null, exit_if: null, is_active: true },
                ])
                setOpen(steps.length)
                setDirty(true)
              }}
              className="flex items-center gap-2 text-xs text-[#9B30FF] hover:text-[#B560FF]"
            >
              <Plus className="w-3.5 h-3.5" /> Add step
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-3">Recent people in this flow</div>
        {enrollments.length === 0 ? (
          <p className="text-sm text-[#666]">No one yet. People enter when the flow is active and its trigger happens.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#666] text-left">
                  <th className="pb-2 font-normal">Email</th>
                  <th className="pb-2 font-normal">Status</th>
                  <th className="pb-2 font-normal">Sent</th>
                  <th className="pb-2 font-normal">Next</th>
                  <th className="pb-2 font-normal" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {enrollments.map((e) => (
                  <tr key={e.id} className="text-xs">
                    <td className="py-2 text-white font-mono truncate max-w-[240px]">{e.email}</td>
                    <td className="py-2 text-[#A0A0A0]">{e.status}{e.exit_reason ? `: ${e.exit_reason}` : ''}</td>
                    <td className="py-2 text-[#A0A0A0]">{e.steps_sent}</td>
                    <td className="py-2 text-[#A0A0A0]">{e.status === 'active' && e.next_run_at ? `Step ${e.next_step_order}, ${new Date(e.next_run_at).toLocaleString()}` : '—'}</td>
                    <td className="py-2 text-right">
                      {e.status === 'active' && (
                        <button onClick={() => stopEnrollment(e.id)} className="text-red-400 hover:underline">Stop</button>
                      )}
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
