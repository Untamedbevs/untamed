'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  ListPlus,
  Search,
  CircleStop,
  ChevronUp,
  ChevronDown,
  Trash2,
  Send,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_DAILY_CAP,
  MAX_STEPS,
  OUTREACH_MERGE_TAGS,
  OUTREACH_STATUS_LABELS,
  type OutreachStatus,
  type OutreachStep,
} from '@/lib/gmail/outreach'

interface Sequence {
  id: string
  name: string
  description: string | null
  steps: OutreachStep[]
  daily_cap_per_sender: number
  is_archived: boolean
  created_at: string
  updated_at: string
  counts: Record<string, number>
}

interface Overview {
  sequences: Sequence[]
  me: { id: string; email: string; full_name: string }
  permissions: { canEdit: boolean }
  config: { gmailConfigured: boolean; blocker: string | null; mailboxSynced: boolean }
}

interface Enrollment {
  id: string
  sequence_id: string
  contact_id: string | null
  email: string
  sender_email: string
  sender_name: string | null
  contact_name: string | null
  status: OutreachStatus
  next_step: number
  total_steps: number
  next_run_at: string | null
  last_sent_at: string | null
  stopped_reason: string | null
  sequence_name: string | null
  created_at: string
}

const STATUS_ORDER: OutreachStatus[] = ['active', 'replied', 'completed', 'stopped', 'bounced', 'suppressed']

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : '—'
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'bg-[#9B30FF]/15 text-[#C792FF]'
      : status === 'replied' || status === 'completed'
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-orange-500/10 text-orange-400'
  return (
    <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full', tone)}>
      {OUTREACH_STATUS_LABELS[status as OutreachStatus] || status}
    </span>
  )
}

export default function OutreachPage() {
  const [tab, setTab] = useState<'sequences' | 'enrollments'>('sequences')
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Sequence | 'new' | null>(null)
  const [enrollFor, setEnrollFor] = useState<string | null>(null)
  const [enrollmentFilter, setEnrollmentFilter] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/crm/outreach${showArchived ? '?archived=1' : ''}`)
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not load outreach')
      else {
        setData(json)
        setError(null)
      }
    } catch {
      setError('Could not load outreach')
    }
  }, [showArchived])

  useEffect(() => {
    load()
  }, [load])

  async function setArchived(seq: Sequence, archived: boolean) {
    if (archived && !confirm(`Archive "${seq.name}"? Everyone still in it stops receiving steps.`)) return
    const res = await fetch(`/api/admin/crm/outreach/${seq.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: archived }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) setError(json.error || 'Update failed')
    load()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link href="/admin/crm" className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-white">
        <ArrowLeft className="w-4 h-4" /> CRM
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Outreach</h1>
        <p className="text-sm text-[#A0A0A0] mt-1">
          One-to-one follow-up sequences sent from your own mailbox. A reply, bounce, or unsubscribe stops the sequence
          for that person.
        </p>
      </div>

      {data?.config.blocker && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{data.config.blocker}</span>
        </div>
      )}
      {data && data.config.gmailConfigured && !data.config.mailboxSynced && (
        <div className="rounded-lg border border-[#2A2A2A] bg-[#111] p-3 text-xs text-[#A0A0A0]">
          Your mailbox ({data.me.email}) isn&apos;t in GMAIL_SYNC_MAILBOXES, so your conversations won&apos;t show on contact
          timelines. Replies still stop your sequences.
        </div>
      )}
      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      <div className="flex gap-2 border-b border-[#2A2A2A]">
        {(['sequences', 'enrollments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm -mb-px border-b-2',
              tab === t ? 'border-[#9B30FF] text-white' : 'border-transparent text-[#A0A0A0] hover:text-white'
            )}
          >
            {t === 'sequences' ? 'Sequences' : 'Enrollments'}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="py-20 text-center text-[#A0A0A0]">
          <Loader2 className="w-6 h-6 animate-spin inline" />
        </div>
      ) : tab === 'sequences' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-[#A0A0A0]">
              <input type="checkbox" className="accent-[#9B30FF]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
            {data.permissions.canEdit && editing === null && (
              <button
                onClick={() => setEditing('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white hover:bg-[#8A20EE]"
              >
                <Plus className="w-3.5 h-3.5" /> New sequence
              </button>
            )}
          </div>

          {editing && (
            <SequenceEditor
              sequence={editing === 'new' ? null : editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null)
                load()
              }}
            />
          )}

          {data.sequences.length === 0 && !editing && (
            <p className="text-sm text-[#666] rounded-xl border border-[#2A2A2A] bg-[#111] p-6 text-center">
              No sequences yet.{data.permissions.canEdit ? ' Create one to start.' : ' An admin can create one.'}
            </p>
          )}

          {data.sequences.map((seq) => (
            <div key={seq.id} className={cn('rounded-xl border border-[#2A2A2A] bg-[#111] p-4', seq.is_archived && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white font-semibold">{seq.name}</h2>
                    {seq.is_archived && <span className="text-[10px] uppercase tracking-wider text-[#666]">Archived</span>}
                  </div>
                  {seq.description && <p className="text-sm text-[#A0A0A0] mt-0.5">{seq.description}</p>}
                  <p className="text-xs text-[#666] mt-1">
                    {seq.steps.length} step{seq.steps.length === 1 ? '' : 's'} over{' '}
                    {seq.steps.reduce((s, st) => s + st.delay_days, 0)} days · up to {seq.daily_cap_per_sender} per sender per day
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!seq.is_archived && (
                    <button
                      onClick={() => setEnrollFor(enrollFor === seq.id ? null : seq.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-[#9B30FF]/50 text-[#C792FF] hover:bg-[#9B30FF]/10"
                    >
                      <ListPlus className="w-3.5 h-3.5" /> Enroll contacts
                    </button>
                  )}
                  {data.permissions.canEdit && !seq.is_archived && (
                    <button
                      onClick={() => setEditing(seq)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {data.permissions.canEdit && (
                    <button
                      onClick={() => setArchived(seq, !seq.is_archived)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
                    >
                      {seq.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      {seq.is_archived ? 'Restore' : 'Archive'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {STATUS_ORDER.filter((s) => seq.counts[s]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setEnrollmentFilter(`${seq.id}|${s}`)
                      setTab('enrollments')
                    }}
                    className="text-xs px-2 py-1 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] text-[#A0A0A0] hover:text-white"
                  >
                    {OUTREACH_STATUS_LABELS[s]}: <span className="text-white">{seq.counts[s]}</span>
                  </button>
                ))}
                {Object.keys(seq.counts).length === 0 && <span className="text-xs text-[#666]">No one enrolled yet.</span>}
              </div>

              <ol className="mt-3 space-y-1">
                {seq.steps.map((st, i) => (
                  <li key={i} className="text-xs text-[#A0A0A0]">
                    <span className="text-[#666]">
                      Step {i + 1} · {i === 0 ? (st.delay_days === 0 ? 'right away' : `day ${st.delay_days}`) : `+${st.delay_days} days`}:
                    </span>{' '}
                    <span className="text-[#D0D0D0]">{st.subject || (i > 0 ? 'Reply in thread' : '')}</span>
                  </li>
                ))}
              </ol>

              {enrollFor === seq.id && (
                <EnrollPanel
                  sequenceId={seq.id}
                  sender={data.me.email}
                  disabled={!data.config.gmailConfigured}
                  onDone={load}
                  onClose={() => setEnrollFor(null)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <EnrollmentsTab
          sequences={data.sequences}
          initialFilter={enrollmentFilter}
          onChanged={load}
        />
      )}
    </div>
  )
}

function SequenceEditor({
  sequence,
  onCancel,
  onSaved,
}: {
  sequence: Sequence | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(sequence?.name || '')
  const [description, setDescription] = useState(sequence?.description || '')
  const [cap, setCap] = useState(String(sequence?.daily_cap_per_sender ?? DEFAULT_DAILY_CAP))
  const [steps, setSteps] = useState<OutreachStep[]>(
    sequence?.steps.length
      ? sequence.steps.map((s) => ({ ...s }))
      : [{ delay_days: 0, subject: '', body: 'Hi {{first_name|there}},\n\n\n\n{{sender_first_name}}' }]
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateStep(i: number, patch: Partial<OutreachStep>) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }

  function move(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      next[i] = prev[j]
      next[j] = prev[i]
      return next
    })
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(sequence ? `/api/admin/crm/outreach/${sequence.id}` : '/api/admin/crm/outreach', {
        method: sequence ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          daily_cap_per_sender: Number(cap),
          steps: steps.map((s) => ({ ...s, delay_days: Number(s.delay_days) })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Save failed')
        return
      }
      onSaved()
    } catch {
      setError('Save failed')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60'

  return (
    <div className="rounded-xl border border-[#9B30FF]/40 bg-[#111] p-4 space-y-4">
      <div className="text-sm font-semibold text-white">{sequence ? `Edit ${sequence.name}` : 'New sequence'}</div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-[#666]">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Bar & restaurant intro" className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#666]">Daily cap per sender</label>
          <input type="number" min={1} max={500} value={cap} onChange={(e) => setCap(e.target.value)} className={inputClass} />
        </div>
        <div className="md:col-span-3">
          <label className="text-[10px] uppercase tracking-wider text-[#666]">Description (for staff)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Who it's for and when to use it" className={inputClass} />
        </div>
      </div>

      <div className="text-xs text-[#666]">
        Merge tags:{' '}
        {OUTREACH_MERGE_TAGS.map((t) => (
          <code key={t.tag} className="mr-2 text-[#C792FF]" title={t.label}>
            {t.tag}
          </code>
        ))}
      </div>

      <ol className="space-y-3">
        {steps.map((st, i) => (
          <li key={i} className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-white">
                Step {i + 1}
                <span className="text-xs text-[#666]">{i === 0 ? 'wait after enrolling' : 'wait after the previous step'}</span>
                <input
                  type="number"
                  min={i === 0 ? 0 : 1}
                  max={90}
                  value={st.delay_days}
                  onChange={(e) => updateStep(i, { delay_days: Number(e.target.value) })}
                  className="w-16 px-2 py-1 rounded-lg bg-[#111] border border-[#2A2A2A] text-white text-sm"
                />
                <span className="text-xs text-[#666]">days</span>
              </div>
              <div className="flex gap-1">
                <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ChevronUp className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === steps.length - 1}>
                  <ChevronDown className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton label="Remove step" onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))} disabled={steps.length === 1}>
                  <Trash2 className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </div>
            <input
              value={st.subject}
              onChange={(e) => updateStep(i, { subject: e.target.value })}
              maxLength={200}
              placeholder={i === 0 ? 'Subject' : 'Leave blank to reply in the same thread (recommended)'}
              className={inputClass}
            />
            <textarea
              value={st.body}
              onChange={(e) => updateStep(i, { body: e.target.value })}
              rows={6}
              placeholder="Plain-text message"
              className={inputClass}
            />
          </li>
        ))}
      </ol>
      {steps.length < MAX_STEPS && (
        <button
          onClick={() =>
            setSteps((prev) => [...prev, { delay_days: 3, subject: '', body: 'Hi {{first_name|there}},\n\n\n\n{{sender_first_name}}' }])
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
        >
          <Plus className="w-3.5 h-3.5" /> Add follow-up
        </button>
      )}

      <p className="text-xs text-[#666]">
        Each email gets a short footer with our company name, postal address, and &ldquo;Reply &lsquo;unsubscribe&rsquo;
        and we won&apos;t email you again.&rdquo; Follow-ups go out as replies in the same thread. A custom subject on a
        follow-up may start a new thread in Gmail. Editing steps affects only steps people haven&apos;t received yet.
      </p>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !name.trim() || !steps[0]?.subject.trim()}
          className="px-4 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save sequence'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-full text-xs text-[#A0A0A0] hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-lg border border-[#2A2A2A] text-[#A0A0A0] hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  )
}

interface ContactHit {
  id: string | null
  email: string
  first_name: string | null
  last_name: string | null
  suppression: string | null
}

function EnrollPanel({
  sequenceId,
  sender,
  disabled,
  onDone,
  onClose,
}: {
  sequenceId: string
  sender: string
  disabled: boolean
  onDone: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ContactHit[]>([])
  const [selected, setSelected] = useState<Map<string, string>>(new Map())
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/admin/crm/contacts?q=${encodeURIComponent(query)}`)
        const json = await res.json()
        if (res.ok) setResults(json.contacts || [])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  function toggle(c: ContactHit) {
    if (!c.id) return
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(c.id!)) next.delete(c.id!)
      else next.set(c.id!, c.email)
      return next
    })
  }

  async function enroll() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/crm/outreach/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId, contactIds: [...selected.keys()] }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not enroll')
        return
      }
      const parts = [`Enrolled ${json.enrolled}.`]
      if (json.alreadyEnrolled) parts.push(`${json.alreadyEnrolled} already in this sequence.`)
      if (json.suppressed?.length) parts.push(`${json.suppressed.length} skipped (suppressed).`)
      if (json.warning) parts.push(json.warning)
      setMessage(parts.join(' '))
      setSelected(new Map())
      onDone()
    } catch {
      setError('Could not enroll')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4 space-y-3">
      {disabled ? (
        <p className="text-sm text-[#A0A0A0]">Connect Gmail before enrolling anyone (see docs/email/gmail-and-outreach.md).</p>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#666]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts by email or name"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#111] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
            />
            {searching && <Loader2 className="w-4 h-4 absolute right-3 top-2.5 animate-spin text-[#666]" />}
          </div>
          {results.length > 0 && (
            <ul className="max-h-64 overflow-y-auto divide-y divide-[#1A1A1A] rounded-lg border border-[#2A2A2A]">
              {results.map((c) => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
                const blocked = !c.id || !!c.suppression
                return (
                  <li key={c.email}>
                    <label className={cn('flex items-center gap-3 px-3 py-2 text-sm', blocked ? 'opacity-50' : 'cursor-pointer hover:bg-[#111]')}>
                      <input
                        type="checkbox"
                        className="accent-[#9B30FF]"
                        disabled={blocked}
                        checked={!!c.id && selected.has(c.id)}
                        onChange={() => toggle(c)}
                      />
                      <span className="text-white break-all">{c.email}</span>
                      {name && <span className="text-xs text-[#666]">{name}</span>}
                      {c.suppression && <span className="ml-auto text-xs text-orange-400">suppressed</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...selected.entries()].map(([id, email]) => (
                <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-[#9B30FF]/15 text-[#C792FF]">
                  {email}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={enroll}
              disabled={busy || selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
              Enroll {selected.size || ''}
            </button>
            <span className="text-xs text-[#666]">Steps are sent from {sender}.</span>
          </div>
        </>
      )}
      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={onClose} className="px-4 py-1.5 rounded-full text-xs text-[#A0A0A0] hover:text-white">
        Close
      </button>
    </div>
  )
}

function EnrollmentsTab({
  sequences,
  initialFilter,
  onChanged,
}: {
  sequences: Sequence[]
  initialFilter: string
  onChanged: () => void
}) {
  const [initialSequence, initialStatus] = initialFilter ? initialFilter.split('|') : ['', '']
  const [sequence, setSequence] = useState(initialSequence || '')
  const [status, setStatus] = useState(initialStatus || '')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Enrollment[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q)
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (sequence) params.set('sequence', sequence)
      if (status) params.set('status', status)
      if (query.trim()) params.set('q', query.trim())
      const res = await fetch(`/api/admin/crm/outreach/enrollments?${params}`)
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not load enrollments')
      else {
        setRows(json.enrollments || [])
        setTotal(json.total || 0)
        setPageSize(json.pageSize || 50)
        setError(null)
      }
    } catch {
      setError('Could not load enrollments')
    } finally {
      setLoading(false)
    }
  }, [sequence, status, query, page])

  useEffect(() => {
    load()
  }, [load])

  async function stop(id: string) {
    if (!confirm('Stop this sequence for this person? No more steps will be sent.')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/crm/outreach/enrollments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Could not stop')
      load()
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  const selectClass =
    'px-3 py-2 rounded-lg bg-[#111] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:border-[#9B30FF]/60'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#666]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#111] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
          />
        </div>
        <select value={sequence} onChange={(e) => { setSequence(e.target.value); setPage(0) }} className={selectClass}>
          <option value="">All sequences</option>
          {sequences.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} className={selectClass}>
          <option value="">Any status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {OUTREACH_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      <div className="rounded-xl border border-[#2A2A2A] bg-[#111] overflow-x-auto">
        {loading && rows.length === 0 ? (
          <div className="py-12 text-center text-[#A0A0A0]">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#666]">No enrollments match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#666] border-b border-[#2A2A2A]">
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Sequence</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sender</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Next step</th>
                <th className="px-3 py-2">Last sent</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1A1A1A] last:border-0 align-top">
                  <td className="px-3 py-2">
                    {r.contact_id ? (
                      <Link href={`/admin/crm/contacts/${r.contact_id}`} className="text-white hover:text-[#C792FF] break-all">
                        {r.email}
                      </Link>
                    ) : (
                      <span className="text-white break-all">{r.email}</span>
                    )}
                    {r.contact_name && <div className="text-xs text-[#666]">{r.contact_name}</div>}
                  </td>
                  <td className="px-3 py-2 text-[#D0D0D0]">{r.sequence_name || '—'}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={r.status} />
                    {r.stopped_reason && <div className="text-[10px] text-[#666] mt-1">{r.stopped_reason}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#A0A0A0]">{r.sender_name || r.sender_email}</td>
                  <td className="px-3 py-2 text-xs text-[#A0A0A0] whitespace-nowrap">
                    {Math.min(Math.max(0, r.next_step - 1), r.total_steps)} of {r.total_steps} sent
                  </td>
                  <td className="px-3 py-2 text-xs text-[#A0A0A0] whitespace-nowrap">
                    {r.status === 'active' ? when(r.next_run_at) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#666] whitespace-nowrap">{when(r.last_sent_at)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.status === 'active' && (
                      <button
                        onClick={() => stop(r.id)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-red-400 disabled:opacity-40"
                      >
                        <CircleStop className="w-3.5 h-3.5" /> Stop
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-[#A0A0A0]">
          <span>
            {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 rounded-full border border-[#2A2A2A] disabled:opacity-30">
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="px-3 py-1 rounded-full border border-[#2A2A2A] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[#666] flex items-center gap-1.5">
        <Send className="w-3.5 h-3.5" /> Due steps go out every 15 minutes. Before each one, replies and suppressions are
        re-checked.
      </p>
    </div>
  )
}
