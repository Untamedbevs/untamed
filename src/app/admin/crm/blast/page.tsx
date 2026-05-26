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

interface FilterRow {
  id: string
  field: FilterField
  value: string
}

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{name}}', label: 'Name' },
  { tag: '{{email}}', label: 'Email' },
]

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: 'loyalty', label: 'Loyalty Members', description: 'All loyalty program members' },
  { value: 'referrers', label: 'Referrers', description: 'Active referral participants' },
  { value: 'distributors', label: 'Distributor Leads', description: 'B2B retail / distribution prospects' },
  { value: 'all', label: 'All Contacts', description: 'Loyalty + referrers + distributors (deduped)' },
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
    } else if (f === 'has_receipts' || f === 'referrer_active' || f === 'has_referrer') {
      target[f] = row.value === 'yes'
    } else {
      target[f] = row.value
    }
  }
  return filters
}

export default function BlastPage() {
  const router = useRouter()
  const [audience, setAudience] = useState<Audience>('loyalty')
  const [rows, setRows] = useState<FilterRow[]>([])
  const [senderId, setSenderId] = useState<CrmSenderId>(DEFAULT_CRM_SENDER.id)
  const [subject, setSubject] = useState('')
  const [textBody, setTextBody] = useState('')

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
  } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const subjectRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  const filterOptions = useMemo(() => getFilterOptions(audience), [audience])
  const filters = useMemo(() => rowsToFilters(audience, rows), [audience, rows])

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
    !sending

  async function handleSend() {
    setSending(true)
    setSendError(null)
    setSendResult(null)
    try {
      const res = await fetch('/api/admin/crm/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, subject, textBody, senderId }),
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
          <SenderPill senderId={senderId} setSenderId={setSenderId} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6">
        <aside className="space-y-4">
          <Section title="Audience" icon={<Users className="w-4 h-4" />}>
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
                  Message (plain text)
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
            </div>
          </Section>

          {sendError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}

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
              Send Blast
            </button>
          </div>
        </main>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          recipientCount={previewCount || 0}
          subject={subject}
          senderLabel={CRM_SENDERS.find((s) => s.id === senderId)?.email || ''}
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
    <div className="flex items-center gap-1 mt-1.5">
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
  sending,
  onConfirm,
  onCancel,
}: {
  recipientCount: number
  subject: string
  senderLabel: string
  sending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A] p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-white mb-2">Send blast?</h3>
        <p className="text-sm text-[#A0A0A0] mb-4">
          This will queue{' '}
          <span className="text-white font-medium">
            {recipientCount.toLocaleString()}
          </span>{' '}
          messages from{' '}
          <span className="text-white font-mono text-xs">{senderLabel}</span>.
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
            Send now
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
  sendResult: { campaignId: string; recipientCount: number; suppressedCount: number }
  onNewBlast: () => void
  onViewCampaign: () => void
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-[#9B30FF]/30 bg-[#111] p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-4">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Blast queued</h2>
        <p className="text-sm text-[#A0A0A0] mb-6">
          {sendResult.recipientCount.toLocaleString()} messages queued for delivery.
          {sendResult.suppressedCount > 0 && (
            <>
              {' '}
              {sendResult.suppressedCount.toLocaleString()} suppressed recipients
              skipped.
            </>
          )}{' '}
          The cron worker will process them in the next few minutes.
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
