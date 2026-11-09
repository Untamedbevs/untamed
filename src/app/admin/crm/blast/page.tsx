'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  ShieldCheck,
  ListChecks,
  Clock,
  LayoutTemplate,
} from 'lucide-react'
import type { BlastFilters, Audience } from '@/lib/crm/blast-filters'
import { CRM_SENDERS, DEFAULT_CRM_SENDER, type CrmSenderId } from '@/lib/crm/senders'
import {
  AUDIENCE_OPTIONS,
  type FilterField,
  type FilterOption,
  getFilterOptions,
  getValueOptions,
  isDateField,
  isNumberField,
  isTextField,
  formatFilterValue,
} from '@/lib/crm/blast-constants'
import { ContentEditor, type ContentChecks, type EmailContent } from '@/components/admin/email/ContentEditor'
import type { EmailBlock } from '@/lib/email/blocks'
import { cn } from '@/lib/utils'

interface FilterRow {
  id: string
  field: FilterField
  value: string
}

interface PreviewRecipient {
  email: string
  name: string
}

type BlastKind = 'marketing' | 'repermission'
type RepermissionAudience = 'consumer' | 'trade'

interface EmailListOption {
  slug: string
  name: string
  description: string | null
  audience: 'consumer' | 'trade'
  requires_age_verification: boolean
}

interface RepermissionCopy {
  subject: string
  body: string
  ctaLabel: string
  consentText: string
}

interface EmailSetup {
  readiness: { ready: boolean; issues: string[]; warnings: string[]; dailyCap: number | null }
  lists: EmailListOption[]
  settings: { approvalThreshold: number; weeklyFrequencyCap: number; quietHours: [number, number]; marketingPaused: boolean }
  permissions: { canDraft: boolean; canSend: boolean }
  repermission: {
    version: string
    approved: boolean
    copy: Record<RepermissionAudience, RepermissionCopy>
  }
}

interface TemplateOption {
  id: string
  name: string
  subject: string
  preheader: string | null
  blocks: EmailBlock[]
}

interface QuickStart {
  id: string
  label: string
  audience: Audience
  subject: string
  preheader: string
  blocks: EmailBlock[]
  filters?: { field: FilterField; value: string }[]
}

const QUICK_STARTS: QuickStart[] = [
  {
    id: 'ugc-call',
    label: 'UGC call: ask members for photos & videos',
    audience: 'loyalty',
    subject: 'Hey {{first_name|there}}, show us how you Unleash It',
    preheader: 'Your Untamed moment could be featured.',
    blocks: [
      { type: 'heading', text: 'Show us your Untamed moment' },
      {
        type: 'text',
        text:
          "Hey {{first_name|there}},\n\nWe're collecting photos and videos from real Untamed moments. Yours could be featured on our site and social.\n\nGot a clip of you cracking open a Cougar at sunset, or a Cheetah on the boat? We want it.",
      },
      { type: 'button', label: 'Submit in 30 seconds', url: '{{portal_login_url}}' },
      { type: 'text', text: 'See what others are sharing: [the community]({{community_url}})\n\nStay wild,\nThe Untamed crew' },
    ],
  },
  {
    id: 'ugc-thank-you',
    label: 'UGC thank-you: appreciate recent contributors',
    audience: 'loyalty',
    subject: 'Thanks for sharing, {{first_name|there}}',
    preheader: 'You keep this brand real.',
    blocks: [
      {
        type: 'text',
        text: '{{first_name|Hey}},\n\nThank you for sharing your Untamed moment with us. Your submission is what keeps this brand grounded in real people.',
      },
      { type: 'button', label: 'See your submissions and points', url: '{{portal_login_url}}' },
      { type: 'text', text: 'Stay wild,\nThe Untamed crew' },
    ],
    filters: [{ field: 'min_ugc_submissions', value: '1' }],
  },
  {
    id: 'ugc-distributor-call',
    label: 'Partner gallery: ask wholesale partners for shelf shots',
    audience: 'distributors',
    subject: 'Show us Untamed in your shop, {{first_name|there}}',
    preheader: "We'll spotlight the best ones.",
    blocks: [
      {
        type: 'text',
        text:
          "{{first_name|Hi}},\n\nA quick favor: we're building a partner gallery and would love to see Untamed on your shelves, your bar, or in customers' hands.",
      },
      { type: 'button', label: 'Submit photos', url: '{{portal_login_url}}' },
      { type: 'text', text: "We'll spotlight the best ones across our channels.\n\nThanks,\nThe Untamed team" },
    ],
  },
]

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

interface SendResult {
  campaignId: string
  status: 'sending' | 'scheduled' | 'pending_approval'
  recipientCount: number
  skippedCount?: number
  approvalReason?: string
}

export default function CampaignComposerPage() {
  const router = useRouter()
  const [setup, setSetup] = useState<EmailSetup | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templateId, setTemplateId] = useState<string>('')
  const [kind, setKind] = useState<BlastKind>('marketing')
  const [listSlug, setListSlug] = useState<string>('')
  const [repermissionAudience, setRepermissionAudience] = useState<RepermissionAudience>('consumer')
  const [audience, setAudience] = useState<Audience>('subscribers')
  const [rows, setRows] = useState<FilterRow[]>([])
  const [senderId, setSenderId] = useState<CrmSenderId>(DEFAULT_CRM_SENDER.id)
  const [name, setName] = useState('')
  const [content, setContent] = useState<EmailContent>({
    subject: '',
    preheader: '',
    blocks: [{ type: 'heading', text: '' }, { type: 'text', text: 'Hey {{first_name|there}},\n\n' }],
  })
  const [checks, setChecks] = useState<ContentChecks | null>(null)
  const [schedule, setSchedule] = useState<'now' | 'later'>('now')
  const [scheduledFor, setScheduledFor] = useState('')

  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewSuppressed, setPreviewSuppressed] = useState(0)
  const [previewMatched, setPreviewMatched] = useState<number | null>(null)
  const [previewNotEligible, setPreviewNotEligible] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewRecipients, setPreviewRecipients] = useState<PreviewRecipient[]>([])

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const filterOptions = useMemo(() => getFilterOptions(audience), [audience])
  const filters = useMemo(() => rowsToFilters(audience, rows), [audience, rows])

  const addRow = useCallback(() => {
    const used = new Set(rows.map((r) => r.field))
    const next = filterOptions.find((o) => !used.has(o.value))
    if (!next) return
    setRows((prev) => [...prev, { id: crypto.randomUUID(), field: next.value, value: '' }])
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
    fetch('/api/admin/crm/email-setup')
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setSetupError(data.error || 'Could not load email setup')
          return
        }
        setSetup(data)
        setListSlug((current) => current || data.lists?.[0]?.slug || '')
      })
      .catch(() => !cancelled && setSetupError('Could not load email setup'))
    fetch('/api/admin/crm/email/templates?category=campaign')
      .then(async (res) => (res.ok ? setTemplates((await res.json()).templates || []) : null))
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (kind === 'marketing' && !listSlug) {
      setPreviewCount(null)
      setPreviewRecipients([])
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/crm/blast/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, listSlug, repermissionAudience, filters }),
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
          setPreviewMatched(data.matchedCount ?? null)
          setPreviewNotEligible(data.notEligibleCount ?? null)
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
  }, [filters, kind, listSlug, repermissionAudience])

  const selectedList = setup?.lists.find((l) => l.slug === listSlug) || null
  const repermissionCopy = setup?.repermission.copy[repermissionAudience]
  const setupReady = !!setup?.readiness.ready
  const contentOk = kind === 'repermission' || (checks !== null && checks.errors.length === 0)
  const scheduleOk = schedule === 'now' || (!!scheduledFor && new Date(scheduledFor).getTime() > Date.now())
  const willNeedApproval =
    !!setup &&
    (!setup.permissions.canSend ||
      kind === 'repermission' ||
      (setup.settings.approvalThreshold > 0 && (previewCount || 0) > setup.settings.approvalThreshold))
  const canSend =
    setupReady &&
    !!setup?.permissions.canDraft &&
    (kind === 'marketing' ? !!listSlug && !!content.subject.trim() && contentOk : !!setup?.repermission.approved) &&
    scheduleOk &&
    (previewCount || 0) > 0 &&
    !sending

  function applyTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (t) setContent({ subject: t.subject || '', preheader: t.preheader || '', blocks: t.blocks || [] })
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)
    setSendResult(null)
    try {
      const res = await fetch('/api/admin/crm/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          listSlug,
          repermissionAudience,
          filters,
          name,
          subject: content.subject,
          preheader: content.preheader,
          blocks: content.blocks,
          templateId: templateId || undefined,
          senderId,
          scheduledFor: schedule === 'later' && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError([data.error || 'Send failed', ...(Array.isArray(data.issues) ? data.issues : [])].join(' '))
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
          setRows([])
          setPreviewCount(null)
        }}
        onViewCampaign={() => router.push(`/admin/crm/blast/${sendResult.campaignId}`)}
      />
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm/email" className="text-[#A0A0A0] hover:text-white" aria-label="Back to email dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">New campaign</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <SenderPill senderId={senderId} setSenderId={setSenderId} />
        </div>
      </div>

      <SetupBanner setup={setup} error={setupError} />

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6">
        <aside className="space-y-4">
          <Section title="Type" icon={<ListChecks className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'marketing', label: 'Marketing email', hint: 'To people who opted in' },
                  { value: 'repermission', label: 'Permission request', hint: 'One-time ask to opt in' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setKind(opt.value)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-lg border transition-colors',
                    kind === opt.value ? 'border-[#9B30FF]/60 bg-[#9B30FF]/10' : 'border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]'
                  )}
                >
                  <div className="text-sm font-medium text-white">{opt.label}</div>
                  <div className="text-xs text-[#A0A0A0] mt-0.5">{opt.hint}</div>
                </button>
              ))}
            </div>
          </Section>

          {kind === 'marketing' ? (
            <Section title="List" icon={<ShieldCheck className="w-4 h-4" />}>
              <p className="text-xs text-[#A0A0A0] mb-2">Only contacts who opted in to this list receive the email.</p>
              <div className="space-y-2">
                {(setup?.lists || []).map((l) => (
                  <button
                    key={l.slug}
                    onClick={() => setListSlug(l.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                      listSlug === l.slug ? 'border-[#9B30FF]/60 bg-[#9B30FF]/10' : 'border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]'
                    )}
                  >
                    <div className="text-sm font-medium text-white">
                      {l.name}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-[#666]">
                        {l.audience}
                        {l.requires_age_verification ? ' · 21+' : ''}
                      </span>
                    </div>
                    {l.description && <div className="text-xs text-[#A0A0A0] mt-0.5">{l.description}</div>}
                  </button>
                ))}
              </div>
            </Section>
          ) : (
            <Section title="Who to ask" icon={<ShieldCheck className="w-4 h-4" />}>
              <p className="text-xs text-[#A0A0A0] mb-2">Goes once to contacts who have never been asked and never opted in or out.</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'consumer', label: 'Customers & members' },
                    { value: 'trade', label: 'Wholesale leads' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRepermissionAudience(opt.value)}
                    className={cn(
                      'text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                      repermissionAudience === opt.value
                        ? 'border-[#9B30FF]/60 bg-[#9B30FF]/10 text-white'
                        : 'border-[#2A2A2A] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#3A3A3A]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Audience" icon={<Users className="w-4 h-4" />}>
            <div className="space-y-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                    audience === opt.value ? 'border-[#9B30FF]/60 bg-[#9B30FF]/10' : 'border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]'
                  )}
                >
                  <div className="text-sm font-medium text-white">{opt.label}</div>
                  <div className="text-xs text-[#A0A0A0] mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          </Section>

          {filterOptions.length > 0 && (
            <Section title="Filters" icon={<Filter className="w-4 h-4" />}>
              <div className="space-y-2">
                {rows.length === 0 && <p className="text-xs text-[#A0A0A0] italic">No filters: everyone in this audience.</p>}
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
          )}

          <Section title="Recipients" icon={<Mail className="w-4 h-4" />}>
            <RecipientCard
              loading={previewLoading}
              error={previewError}
              count={previewCount}
              suppressed={previewSuppressed}
              matched={previewMatched}
              notEligible={previewNotEligible}
              sample={previewRecipients}
            />
          </Section>
        </aside>

        <main className="space-y-4 min-w-0">
          {kind === 'repermission' ? (
            <RepermissionPreview copy={repermissionCopy} version={setup?.repermission.version} approved={!!setup?.repermission.approved} />
          ) : (
            <Section title="Content">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Campaign name (internal; defaults to the subject)"
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
                />
                <div className="flex items-center gap-1.5">
                  <LayoutTemplate className="w-4 h-4 text-[#666]" />
                  <select
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="px-2 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm"
                  >
                    <option value="">Start from a template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_STARTS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setAudience(t.audience)
                      setContent({ subject: t.subject, preheader: t.preheader, blocks: t.blocks })
                      if (t.filters) setRows(t.filters.map((f) => ({ id: crypto.randomUUID(), field: f.field, value: f.value })))
                    }}
                    className="text-xs px-2.5 py-1 rounded-full border border-[#2A2A2A] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#9B30FF] hover:text-white transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <ContentEditor value={content} onChange={setContent} listName={selectedList?.name} onChecks={setChecks} />
            </Section>
          )}

          <Section title="When" icon={<Clock className="w-4 h-4" />}>
            <div className="flex flex-wrap items-center gap-3">
              {(['now', 'later'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-[#D0D0D0]">
                  <input type="radio" className="accent-[#9B30FF]" checked={schedule === opt} onChange={() => setSchedule(opt)} />
                  {opt === 'now' ? 'Send as soon as possible' : 'Schedule'}
                </label>
              ))}
              {schedule === 'later' && (
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm"
                />
              )}
            </div>
            {setup && (
              <p className="text-xs text-[#666] mt-2">
                Sends respect quiet hours ({setup.settings.quietHours[0]}:00–{setup.settings.quietHours[1]}:00 in each person&apos;s time zone),
                at most {setup.settings.weeklyFrequencyCap} marketing emails per person per week, and the daily cap.
              </p>
            )}
          </Section>

          {sendError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
            <div className="text-sm text-[#A0A0A0]">
              {previewCount !== null ? (
                <>
                  <span className="text-white font-medium">{previewCount.toLocaleString()}</span> recipients
                  {willNeedApproval && <span className="ml-2 text-xs text-amber-300">· needs a second admin&apos;s approval</span>}
                  {kind === 'marketing' && checks && checks.errors.length > 0 && (
                    <span className="ml-2 text-xs text-red-400">· fix the content checks</span>
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
                canSend ? 'bg-[#9B30FF] text-white hover:bg-[#B560FF]' : 'bg-[#1A1A1A] text-[#666] cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
              {willNeedApproval ? 'Submit for approval' : schedule === 'later' ? 'Schedule' : 'Send'}
            </button>
          </div>
        </main>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          recipientCount={previewCount || 0}
          subject={kind === 'repermission' ? repermissionCopy?.subject || '' : content.subject}
          listLabel={kind === 'repermission' ? 'One-time permission request' : selectedList ? `${selectedList.name} list` : ''}
          senderLabel={CRM_SENDERS.find((s) => s.id === senderId)?.email || ''}
          when={schedule === 'later' && scheduledFor ? new Date(scheduledFor).toLocaleString() : 'As soon as possible'}
          needsApproval={willNeedApproval}
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

function SetupBanner({ setup, error }: { setup: EmailSetup | null; error: string | null }) {
  if (error) {
    return (
      <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }
  if (!setup) return null
  const { issues, warnings, dailyCap } = setup.readiness
  return (
    <div className="mb-6 space-y-2">
      {issues.length > 0 ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          <div className="flex items-center gap-2 font-medium mb-1.5">
            <AlertTriangle className="w-4 h-4" /> Marketing email can&apos;t send yet
          </div>
          <ul className="list-disc pl-6 space-y-0.5 text-xs">
            {issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-3 text-xs text-[#A0A0A0] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#9B30FF]" />
          Marketing email is set up.{dailyCap ? ` Daily cap: ${dailyCap.toLocaleString()}.` : ''}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <ul className="list-disc pl-5 space-y-0.5">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      {!setup.permissions.canDraft && (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-3 text-xs text-[#A0A0A0]">Your role can view campaigns but not create them.</div>
      )}
    </div>
  )
}

function RepermissionPreview({ copy, version, approved }: { copy: RepermissionCopy | undefined; version: string | undefined; approved: boolean }) {
  return (
    <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">Permission request</div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', approved ? 'border-[#9B30FF]/50 text-[#9B30FF]' : 'border-amber-500/40 text-amber-300')}>
          {version} · {approved ? 'approved' : 'awaiting approval'}
        </span>
      </div>
      {!approved && (
        <p className="text-xs text-amber-200">
          This wording is a draft. It can&apos;t be sent until counsel approves it and EMAIL_REPERMISSION_APPROVED_VERSION is set to {version}.
        </p>
      )}
      {copy ? (
        <>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Subject</div>
            <div className="text-sm text-white">{copy.subject}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Body</div>
            <div className="text-sm text-[#D0D0D0] whitespace-pre-line">{copy.body}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Button opens the confirm page, where they agree to</div>
            <div className="text-sm text-white">
              <span className="text-[#9B30FF]">{copy.ctaLabel}</span> · &ldquo;{copy.consentText}&rdquo;
            </div>
          </div>
        </>
      ) : (
        <Loader2 className="w-4 h-4 animate-spin text-[#A0A0A0]" />
      )}
      <p className="text-xs text-[#666]">Wording lives in src/lib/email/consent-copy.ts. Any change needs a new version and a new approval.</p>
    </section>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
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

function SenderPill({ senderId, setSenderId }: { senderId: CrmSenderId; setSenderId: (id: CrmSenderId) => void }) {
  return (
    <div className="flex items-center gap-1 bg-[#111] border border-[#2A2A2A] rounded-full p-1">
      {CRM_SENDERS.map((s) => (
        <button
          key={s.id}
          onClick={() => setSenderId(s.id)}
          className={cn('px-3 py-1.5 text-xs font-medium rounded-full transition-colors', senderId === s.id ? 'bg-[#9B30FF]/20 text-[#9B30FF]' : 'text-[#A0A0A0] hover:text-white')}
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
  const field = 'flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-[#9B30FF]/60'

  return (
    <div className="flex items-center gap-1.5">
      <select value={row.field} onChange={(e) => onChange({ field: e.target.value as FilterField, value: '' })} className={field}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {valueOptions ? (
        <select value={row.value} onChange={(e) => onChange({ value: e.target.value })} className={field}>
          <option value="">Select...</option>
          {valueOptions.map((v) => <option key={v} value={v}>{formatFilterValue(v)}</option>)}
        </select>
      ) : isDateField(row.field) ? (
        <input type="date" value={row.value} onChange={(e) => onChange({ value: e.target.value })} className={field} />
      ) : isNumberField(row.field) ? (
        <input type="number" value={row.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="0" className={field} />
      ) : isTextField(row.field) ? (
        <input type="text" value={row.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="value" className={field} />
      ) : null}
      <button onClick={onRemove} className="p-1.5 rounded-md text-[#A0A0A0] hover:text-red-400 hover:bg-red-400/10" aria-label="Remove filter">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function RecipientCard({
  loading,
  error,
  count,
  suppressed,
  matched,
  notEligible,
  sample,
}: {
  loading: boolean
  error: string | null
  count: number | null
  suppressed: number
  matched: number | null
  notEligible: number | null
  sample: PreviewRecipient[]
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : (count ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#A0A0A0]">can be emailed</div>
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

      {!loading && matched !== null && (
        <p className="text-[11px] text-[#666] leading-relaxed">
          {matched.toLocaleString()} matched the filters
          {notEligible
            ? `; ${notEligible.toLocaleString()} can't be emailed (no opt-in for this, not 21+ verified, paused, unengaged, outside allowed countries, or suppressed)`
            : ''}
          .
        </p>
      )}

      {sample.length > 0 && (
        <div className="border-t border-[#2A2A2A] pt-3">
          <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1.5">Sample</div>
          <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {sample.slice(0, 20).map((r, i) => (
              <li key={i} className="text-xs text-[#A0A0A0] truncate">
                <span className="text-white">{r.email}</span>
                {r.name && r.name !== r.email && <span className="ml-2 text-[#666]">{r.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConfirmDialog({
  recipientCount,
  subject,
  listLabel,
  senderLabel,
  when,
  needsApproval,
  sending,
  onConfirm,
  onCancel,
}: {
  recipientCount: number
  subject: string
  listLabel: string
  senderLabel: string
  when: string
  needsApproval: boolean
  sending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A] p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-white mb-2">{needsApproval ? 'Submit for approval?' : 'Send campaign?'}</h3>
        <p className="text-sm text-[#A0A0A0] mb-4">
          {needsApproval ? 'A second admin approves it before anything is queued. ' : ''}
          <span className="text-white font-medium">{recipientCount.toLocaleString()}</span> recipients from{' '}
          <span className="text-white font-mono text-xs">{senderLabel}</span>.
        </p>
        <div className="rounded-lg border border-[#2A2A2A] bg-[#111] p-3 mb-5 space-y-3">
          <Detail label="Subject" value={subject} />
          {listLabel && <Detail label="Sending as" value={listLabel} />}
          <Detail label="When" value={when} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={sending} className="px-4 py-2 rounded-full text-sm text-[#A0A0A0] hover:text-white">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {needsApproval ? 'Submit' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">{label}</div>
      <div className="text-sm text-white">{value}</div>
    </div>
  )
}

function SuccessView({ sendResult, onNewBlast, onViewCampaign }: { sendResult: SendResult; onNewBlast: () => void; onViewCampaign: () => void }) {
  const title =
    sendResult.status === 'pending_approval' ? 'Submitted for approval' : sendResult.status === 'scheduled' ? 'Campaign scheduled' : 'Campaign queued'
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-[#9B30FF]/30 bg-[#111] p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-4">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-[#A0A0A0] mb-6">
          {sendResult.status === 'pending_approval'
            ? `${sendResult.approvalReason || 'Needs approval'}. Another admin can approve it from the campaign page.`
            : `${sendResult.recipientCount.toLocaleString()} messages queued.${
                sendResult.skippedCount ? ` ${sendResult.skippedCount.toLocaleString()} matching contacts skipped (no opt-in, not verified, or suppressed).` : ''
              } They go out within the daily cap, quiet hours, and weekly limit.`}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={onNewBlast} className="px-4 py-2 rounded-full text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A]">New campaign</button>
          <button onClick={onViewCampaign} className="px-4 py-2 rounded-full text-sm bg-[#9B30FF] text-white hover:bg-[#B560FF]">View status</button>
        </div>
      </div>
    </div>
  )
}
