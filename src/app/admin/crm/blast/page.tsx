'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Send,
  Filter,
  Plus,
  Trash2,
  Users,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Mail,
  Ban,
  Tag,
  Save,
  Clock,
  FlaskConical,
  Eye,
  Bookmark,
} from 'lucide-react'
import type { BlastFilters, Audience, BlastRecipient } from '@/lib/crm/blast-filters'
import { CRM_SENDERS, DEFAULT_CRM_SENDER, type CrmSenderId } from '@/lib/crm/senders'
import {
  type FilterField,
  type FilterOption,
  getFilterOptions,
  getValueOptions,
  isDateField,
  isNumberField,
  isTextField,
  formatFilterValue,
} from '@/lib/crm/blast-constants'
import { cn } from '@/lib/utils'
import { MERGE_TAGS, SAMPLE_LINK_VARS, applyVariables, renderEmailHtml } from '@/lib/email/render'

interface FilterRow {
  id: string
  field: FilterField
  value: string
}

interface TemplateRow {
  id: string
  slug: string
  name: string
  subject: string
  body: string
  preheader: string | null
  sender_id: string | null
  default_audience: Audience | null
}

interface SegmentRow {
  id: string
  name: string
  description: string | null
  filters: BlastFilters
  last_count: number | null
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: 'loyalty', label: 'Loyalty Members', description: 'All loyalty program members' },
  { value: 'referrers', label: 'Referrers', description: 'Active referral participants' },
  { value: 'distributors', label: 'Distributor Leads', description: 'B2B retail / distribution prospects' },
  { value: 'all', label: 'All Contacts', description: 'Loyalty + referrers + distributors (deduped)' },
  { value: 'staff', label: 'Team (internal test)', description: 'Active staff only: send to yourself or the founders first' },
]

function insertAtCursor(
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  value: string,
  tag: string,
  setValue: (v: string) => void
) {
  const el = ref.current
  if (!el) {
    setValue(value + tag)
    return
  }
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const next = value.slice(0, start) + tag + value.slice(end)
  setValue(next)
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + tag.length
    el.setSelectionRange(pos, pos)
  })
}

function rowsToFilters(audience: Audience, rows: FilterRow[]): BlastFilters {
  const filters: BlastFilters = { audience }
  const target = filters as unknown as Record<string, unknown>
  for (const row of rows) {
    if (!row.value) continue
    const f = row.field
    if (isNumberField(f)) {
      const n = parseInt(row.value, 10)
      if (!Number.isNaN(n)) target[f] = n
    } else if (f === 'has_receipts' || f === 'referrer_active' || f === 'has_referrer' || f === 'only_me') {
      target[f] = row.value === 'yes'
    } else {
      target[f] = row.value
    }
  }
  return filters
}

function filtersToRows(f: BlastFilters): FilterRow[] {
  const rows: FilterRow[] = []
  for (const [key, value] of Object.entries(f)) {
    if (key === 'audience' || value === undefined || value === null) continue
    rows.push({
      id: crypto.randomUUID(),
      field: key as FilterField,
      value: typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value),
    })
  }
  return rows
}

function sameFilters(a: BlastFilters, b: BlastFilters): boolean {
  const norm = (f: BlastFilters) =>
    JSON.stringify(Object.entries(f).filter(([, v]) => v !== undefined).sort(([x], [y]) => x.localeCompare(y)))
  return norm(a) === norm(b)
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function BlastPage() {
  const router = useRouter()
  const [audience, setAudience] = useState<Audience>('loyalty')
  const [rows, setRows] = useState<FilterRow[]>([])
  const [senderId, setSenderId] = useState<CrmSenderId>(DEFAULT_CRM_SENDER.id)
  const [subject, setSubject] = useState('')
  const [textBody, setTextBody] = useState('')
  const [preheader, setPreheader] = useState('')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [segments, setSegments] = useState<SegmentRow[]>([])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduleAt, setScheduleAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000))
  )
  const [testTo, setTestTo] = useState('')
  const [testState, setTestState] = useState<{ status: 'idle' | 'sending' | 'ok' | 'error'; msg?: string }>({ status: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)

  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewSuppressed, setPreviewSuppressed] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewRecipients, setPreviewRecipients] = useState<BlastRecipient[]>([])

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{
    campaignId: string
    recipientCount: number
    suppressedCount: number
    noReferralCodeCount?: number
    scheduledFor?: string | null
  } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const loadLibrary = useCallback(async () => {
    const [t, sg] = await Promise.all([
      fetch('/api/admin/crm/templates?kind=campaign').then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/crm/segments').then((r) => r.json()).catch(() => ({})),
    ])
    setTemplates(t.templates || [])
    setSegments(sg.segments || [])
  }, [])

  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  const subjectRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  const filterOptions = useMemo(() => getFilterOptions(audience), [audience])
  const filters = useMemo(() => rowsToFilters(audience, rows), [audience, rows])
  const activeSegment = useMemo(
    () => segments.find((sg) => sameFilters(sg.filters, filters)) || null,
    [segments, filters]
  )

  const scheduledIso = useMemo(() => {
    if (scheduleMode !== 'later') return null
    const d = new Date(scheduleAt)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }, [scheduleMode, scheduleAt])
  const scheduleInvalid = scheduleMode === 'later' && (!scheduledIso || new Date(scheduledIso) <= new Date())

  const previewHtml = useMemo(() => {
    const sample = previewRecipients[0]
    const vars: Record<string, string> = {
      first_name: sample?.firstName || 'Alex',
      name: sample?.name || 'Alex Rivera',
      email: sample?.email || 'alex@example.com',
      ...SAMPLE_LINK_VARS,
    }
    return {
      subject: applyVariables(subject, vars),
      html: renderEmailHtml({
        body: applyVariables(textBody || ' ', vars),
        preheader: preheader ? applyVariables(preheader, vars) : undefined,
        unsubscribeUrl: '#',
        recipientEmail: vars.email,
      }),
    }
  }, [subject, textBody, preheader, previewRecipients])

  function applyTemplate(t: TemplateRow) {
    setTemplateId(t.id)
    setSubject(t.subject)
    setTextBody(t.body)
    setPreheader(t.preheader || '')
    if (t.default_audience) setAudience(t.default_audience)
    if (t.sender_id && CRM_SENDERS.some((x) => x.id === t.sender_id)) {
      setSenderId(t.sender_id as CrmSenderId)
    }
  }

  function applySegment(sg: SegmentRow) {
    setAudience(sg.filters.audience)
    setRows(filtersToRows(sg.filters))
  }

  async function saveSegment(name: string) {
    const res = await fetch('/api/admin/crm/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, filters }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Save failed')
    await loadLibrary()
    setNotice(`Saved segment "${name}"`)
  }

  async function saveTemplate(name: string) {
    const existing = templates.find((t) => t.id === templateId)
    const overwrite = existing && existing.name === name
    const res = await fetch(
      overwrite ? `/api/admin/crm/templates/${existing.id}` : '/api/admin/crm/templates',
      {
        method: overwrite ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          body: textBody,
          preheader,
          kind: 'campaign',
          sender_id: senderId,
          default_audience: audience,
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Save failed')
    setTemplateId(data.template.id)
    await loadLibrary()
    setNotice(overwrite ? `Updated template "${name}"` : `Saved template "${name}"`)
  }

  async function sendTest() {
    setTestState({ status: 'sending' })
    try {
      const res = await fetch('/api/admin/crm/blast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, textBody, preheader, senderId, to: testTo || undefined }),
      })
      const data = await res.json()
      if (!res.ok) setTestState({ status: 'error', msg: data.error || 'Test failed' })
      else setTestState({ status: 'ok', msg: `Sent to ${data.to}` })
    } catch (err) {
      setTestState({ status: 'error', msg: err instanceof Error ? err.message : 'Test failed' })
    }
  }

  const addRow = useCallback(() => {
    const used = new Set(rows.map((r) => r.field))
    const next = filterOptions.find((o) => !used.has(o.value))
    if (!next) return
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), field: next.value, value: '' },
    ])
  }, [rows, filterOptions])

  const updateRow = useCallback((id: string, patch: Partial<FilterRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  useEffect(() => {
    setRows((prev) => prev.filter((r) => filterOptions.some((o) => o.value === r.field)))
  }, [filterOptions])

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/crm/blast/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setPreviewError(data.error || 'Preview failed')
          setPreviewCount(null)
          setPreviewRecipients([])
        } else {
          setPreviewCount(data.count || 0)
          setPreviewSuppressed(data.suppressedCount || 0)
          setPreviewRecipients(data.recipients || [])
        }
      } catch {
        if (!cancelled) {
          setPreviewError('Preview request failed')
          setPreviewCount(null)
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [filters])

  const canSend =
    !!subject.trim() &&
    !!textBody.trim() &&
    (previewCount || 0) > 0 &&
    !scheduleInvalid &&
    !sending

  async function handleSend() {
    setSending(true)
    setSendError(null)
    setSendResult(null)
    try {
      const res = await fetch('/api/admin/crm/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters,
          subject,
          textBody,
          senderId,
          templateId,
          segmentId: activeSegment?.id || null,
          scheduledFor: scheduledIso,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Send failed')
      } else {
        setSendResult(data)
        setConfirmOpen(false)
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (sendResult) {
    return (
      <SuccessView
        sendResult={sendResult}
        onNewBlast={() => {
          setSendResult(null)
          setSubject('')
          setTextBody('')
          setPreheader('')
          setTemplateId(null)
          setScheduleMode('now')
          setRows([])
          setPreviewCount(null)
        }}
        onViewCampaign={() => router.push(`/admin/crm/blast/${sendResult.campaignId}`)}
      />
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/crm"
            className="text-[#A0A0A0] hover:text-white"
            aria-label="Back to CRM"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Email Blast</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin/crm/campaigns" className="text-xs text-[#A0A0A0] hover:text-white">
            Campaigns
          </Link>
          <SenderPill senderId={senderId} setSenderId={setSenderId} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6">
        <aside className="space-y-4">
          <Section title="Audience" icon={<Users className="w-4 h-4" />}>
            {segments.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">
                  Saved segment
                </label>
                <select
                  value={activeSegment?.id || ''}
                  onChange={(e) => {
                    const sg = segments.find((x) => x.id === e.target.value)
                    if (sg) applySegment(sg)
                  }}
                  className="w-full px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
                >
                  <option value="">{activeSegment ? '' : 'Custom (unsaved)'}</option>
                  {segments.map((sg) => (
                    <option key={sg.id} value={sg.id}>
                      {sg.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                    audience === opt.value
                      ? 'border-[#9B30FF]/60 bg-[#9B30FF]/10'
                      : 'border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]'
                  )}
                >
                  <div className="text-sm font-medium text-white">{opt.label}</div>
                  <div className="text-xs text-[#A0A0A0] mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Filters" icon={<Filter className="w-4 h-4" />}>
            <div className="space-y-2">
              {rows.length === 0 && (
                <p className="text-xs text-[#A0A0A0] italic">
                  No filters — all contacts in this audience.
                </p>
              )}
              {rows.map((row) => (
                <FilterRowEditor
                  key={row.id}
                  row={row}
                  options={filterOptions}
                  onChange={(patch) => updateRow(row.id, patch)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
              <button
                onClick={addRow}
                disabled={rows.length >= filterOptions.length}
                className="flex items-center gap-2 text-xs text-[#9B30FF] hover:text-[#B560FF] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> Add filter
              </button>
              {!activeSegment && (
                <InlineSave
                  label="Save as segment"
                  icon={<Bookmark className="w-3.5 h-3.5" />}
                  placeholder="Segment name"
                  onSave={saveSegment}
                />
              )}
            </div>
          </Section>

          <Section title="Recipients" icon={<Mail className="w-4 h-4" />}>
            <RecipientCard
              loading={previewLoading}
              error={previewError}
              count={previewCount}
              suppressed={previewSuppressed}
              sample={previewRecipients}
            />
          </Section>
        </aside>

        <main className="space-y-4">
          <Section title="Compose">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#A0A0A0]">Templates</label>
                  <Link href="/admin/crm/templates" className="text-[11px] text-[#9B30FF] hover:text-[#B560FF]">
                    Manage
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {templates.length === 0 && (
                    <span className="text-xs text-[#666] italic">No saved templates yet.</span>
                  )}
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-colors',
                        templateId === t.id
                          ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-white'
                          : 'border-[#2A2A2A] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#9B30FF] hover:text-white'
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">
                  Subject
                </label>
                <input
                  ref={subjectRef}
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
                />
                <MergeTagBar
                  onInsert={(tag) => insertAtCursor(subjectRef, subject, tag, setSubject)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">
                  Preview text <span className="text-[#666]">(optional, shown after the subject in the inbox)</span>
                </label>
                <input
                  type="text"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  placeholder="A short teaser line"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">
                  Message <span className="text-[#666]">(blank line = new paragraph, **bold**, links auto-detected)</span>
                </label>
                <textarea
                  ref={bodyRef}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  placeholder={`Hey {{first_name}},\n\nWrite your message here...`}
                  rows={14}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60 font-mono"
                />
                <MergeTagBar
                  onInsert={(tag) => insertAtCursor(bodyRef, textBody, tag, setTextBody)}
                />
              </div>

              <InlineSave
                label={templateId ? 'Save template' : 'Save as template'}
                icon={<Save className="w-3.5 h-3.5" />}
                placeholder="Template name"
                initialValue={templates.find((t) => t.id === templateId)?.name || ''}
                disabled={!subject.trim() || !textBody.trim()}
                onSave={saveTemplate}
              />
            </div>
          </Section>

          <Section title="Preview" icon={<Eye className="w-4 h-4" />}>
            <div className="text-xs text-[#A0A0A0] mb-2">
              Subject: <span className="text-white">{previewHtml.subject || '(no subject)'}</span>
            </div>
            <iframe
              title="Email preview"
              srcDoc={previewHtml.html}
              sandbox=""
              className="w-full h-[480px] rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]"
            />
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="Test address (defaults to you)"
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-xs focus:outline-none focus:border-[#9B30FF]/60"
              />
              <button
                type="button"
                onClick={sendTest}
                disabled={!subject.trim() || !textBody.trim() || testState.status === 'sending'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#2A2A2A] text-xs text-[#A0A0A0] hover:text-white hover:border-[#9B30FF] disabled:opacity-40"
              >
                {testState.status === 'sending' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FlaskConical className="w-3.5 h-3.5" />
                )}
                Send test
              </button>
              {testState.msg && (
                <span className={cn('text-xs', testState.status === 'error' ? 'text-red-400' : 'text-green-400')}>
                  {testState.msg}
                </span>
              )}
            </div>
          </Section>

          {notice && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400 flex items-center justify-between">
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} className="text-xs text-green-400/70 hover:text-green-300">
                Dismiss
              </button>
            </div>
          )}

          {sendError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
            <Clock className="w-4 h-4 text-[#A0A0A0]" />
            <div className="flex items-center gap-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-full p-1">
              {(['now', 'later'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setScheduleMode(m)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full',
                    scheduleMode === m ? 'bg-[#9B30FF]/20 text-[#9B30FF]' : 'text-[#A0A0A0] hover:text-white'
                  )}
                >
                  {m === 'now' ? 'Send now' : 'Schedule'}
                </button>
              ))}
            </div>
            {scheduleMode === 'later' && (
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="px-2 py-1 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
              />
            )}
            {scheduleInvalid && <span className="text-xs text-red-400">Pick a future time</span>}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
            <div className="text-sm text-[#A0A0A0]">
              {previewCount !== null ? (
                <>
                  <span className="text-white font-medium">
                    {previewCount.toLocaleString()}
                  </span>{' '}
                  recipients ready to send
                  {previewSuppressed > 0 && (
                    <span className="ml-2 text-xs">
                      ({previewSuppressed.toLocaleString()} suppressed)
                    </span>
                  )}
                </>
              ) : (
                <span>Calculating recipients...</span>
              )}
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSend}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all',
                canSend
                  ? 'bg-[#9B30FF] text-white hover:bg-[#B560FF] hover:shadow-[0_0_20px_rgba(155,48,255,0.4)]'
                  : 'bg-[#1A1A1A] text-[#666] cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
              {scheduleMode === 'later' ? 'Schedule Blast' : 'Send Blast'}
            </button>
          </div>
        </main>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          recipientCount={previewCount || 0}
          subject={subject}
          senderLabel={CRM_SENDERS.find((s) => s.id === senderId)?.email || ''}
          scheduledFor={scheduledIso}
          sending={sending}
          onConfirm={handleSend}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function SenderPill({
  senderId,
  setSenderId,
}: {
  senderId: CrmSenderId
  setSenderId: (id: CrmSenderId) => void
}) {
  return (
    <div className="flex items-center gap-1 bg-[#111] border border-[#2A2A2A] rounded-full p-1">
      {CRM_SENDERS.map((s) => (
        <button
          key={s.id}
          onClick={() => setSenderId(s.id)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
            senderId === s.id
              ? 'bg-[#9B30FF]/20 text-[#9B30FF]'
              : 'text-[#A0A0A0] hover:text-white'
          )}
          title={s.email}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

function FilterRowEditor({
  row,
  options,
  onChange,
  onRemove,
}: {
  row: FilterRow
  options: FilterOption[]
  onChange: (patch: Partial<FilterRow>) => void
  onRemove: () => void
}) {
  const valueOptions = getValueOptions(row.field)

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={row.field}
        onChange={(e) => onChange({ field: e.target.value as FilterField, value: '' })}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {valueOptions ? (
        <select
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
        >
          <option value="">Select...</option>
          {valueOptions.map((v) => (
            <option key={v} value={v}>
              {formatFilterValue(v)}
            </option>
          ))}
        </select>
      ) : isDateField(row.field) ? (
        <input
          type="date"
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
        />
      ) : isNumberField(row.field) ? (
        <input
          type="number"
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="0"
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
        />
      ) : isTextField(row.field) ? (
        <input
          type="text"
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="value"
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
        />
      ) : null}

      <button
        onClick={onRemove}
        className="p-1.5 rounded-md text-[#A0A0A0] hover:text-red-400 hover:bg-red-400/10"
        aria-label="Remove filter"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function MergeTagBar({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <Tag className="w-3 h-3 text-[#666]" />
      {MERGE_TAGS.map((m) => (
        <button
          key={m.tag}
          onClick={() => onInsert(m.tag)}
          className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#A0A0A0] hover:bg-[#9B30FF]/10 hover:text-[#9B30FF] font-mono"
        >
          {m.tag}
        </button>
      ))}
    </div>
  )
}

function RecipientCard({
  loading,
  error,
  count,
  suppressed,
  sample,
}: {
  loading: boolean
  error: string | null
  count: number | null
  suppressed: number
  sample: BlastRecipient[]
}) {
  if (error) {
    return (
      <div className="text-xs text-red-400 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-2xl font-bold text-white">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin inline" />
            ) : (
              (count ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-xs text-[#A0A0A0]">eligible</div>
        </div>
        {suppressed > 0 && (
          <div className="text-right">
            <div className="text-sm text-orange-400 flex items-center gap-1">
              <Ban className="w-3 h-3" /> {suppressed.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#A0A0A0]">suppressed</div>
          </div>
        )}
      </div>

      {sample.length > 0 && (
        <div className="border-t border-[#2A2A2A] pt-3">
          <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1.5">
            Sample
          </div>
          <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {sample.slice(0, 20).map((r, i) => (
              <li key={i} className="text-xs text-[#A0A0A0] truncate">
                <span className="text-white">{r.email}</span>
                {r.name && r.name !== r.email && (
                  <span className="ml-2 text-[#666]">{r.name}</span>
                )}
              </li>
            ))}
          </ul>
          {sample.length > 20 && (
            <div className="text-[10px] text-[#666] mt-1">
              +{sample.length - 20} more...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ConfirmDialog({
  recipientCount,
  subject,
  senderLabel,
  scheduledFor,
  sending,
  onConfirm,
  onCancel,
}: {
  recipientCount: number
  subject: string
  senderLabel: string
  scheduledFor: string | null
  sending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A] p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-white mb-2">
          {scheduledFor ? 'Schedule blast?' : 'Send blast?'}
        </h3>
        <p className="text-sm text-[#A0A0A0] mb-4">
          This will queue{' '}
          <span className="text-white font-medium">
            {recipientCount.toLocaleString()}
          </span>{' '}
          messages from{' '}
          <span className="text-white font-mono text-xs">{senderLabel}</span>
          {scheduledFor ? (
            <>
              {' '}to start sending{' '}
              <span className="text-white">{new Date(scheduledFor).toLocaleString()}</span>
            </>
          ) : null}
          . Sends are paced to stay under the Google Workspace daily limit, so large lists may take more than a day.
        </p>
        <div className="rounded-lg border border-[#2A2A2A] bg-[#111] p-3 mb-5">
          <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">
            Subject
          </div>
          <div className="text-sm text-white">{subject}</div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={sending}
            className="px-4 py-2 rounded-full text-sm text-[#A0A0A0] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {scheduledFor ? 'Schedule' : 'Send now'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SuccessView({
  sendResult,
  onNewBlast,
  onViewCampaign,
}: {
  sendResult: {
    campaignId: string
    recipientCount: number
    suppressedCount: number
    noReferralCodeCount?: number
    scheduledFor?: string | null
  }
  onNewBlast: () => void
  onViewCampaign: () => void
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-[#9B30FF]/30 bg-[#111] p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-4">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {sendResult.scheduledFor ? 'Blast scheduled' : 'Blast queued'}
        </h2>
        <p className="text-sm text-[#A0A0A0] mb-6">
          {sendResult.recipientCount.toLocaleString()} messages queued for delivery.
          {sendResult.suppressedCount > 0 && (
            <>
              {' '}
              {sendResult.suppressedCount.toLocaleString()} suppressed recipients
              skipped.
            </>
          )}
          {(sendResult.noReferralCodeCount ?? 0) > 0 && (
            <>
              {' '}
              {sendResult.noReferralCodeCount!.toLocaleString()} recipients without a referral
              code skipped.
            </>
          )}{' '}
          {sendResult.scheduledFor
            ? `Sending starts ${new Date(sendResult.scheduledFor).toLocaleString()}.`
            : 'The cron worker will start sending within a minute.'}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onNewBlast}
            className="px-4 py-2 rounded-full text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A]"
          >
            New blast
          </button>
          <button
            onClick={onViewCampaign}
            className="px-4 py-2 rounded-full text-sm bg-[#9B30FF] text-white hover:bg-[#B560FF]"
          >
            View status
          </button>
        </div>
      </div>
    </div>
  )
}

function InlineSave({
  label,
  icon,
  placeholder,
  initialValue = '',
  disabled,
  onSave,
}: {
  label: string
  icon: React.ReactNode
  placeholder: string
  initialValue?: string
  disabled?: boolean
  onSave: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setName(initialValue)
          setError(null)
          setOpen(true)
        }}
        className="flex items-center gap-1.5 text-xs text-[#9B30FF] hover:text-[#B560FF] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {icon} {label}
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60"
        />
        <button
          type="button"
          disabled={!name.trim() || busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await onSave(name.trim())
              setOpen(false)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Save failed')
            } finally {
              setBusy(false)
            }
          }}
          className="px-2.5 py-1.5 rounded-md bg-[#9B30FF] text-white text-xs disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-1.5 text-xs text-[#A0A0A0] hover:text-white">
          Cancel
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}
