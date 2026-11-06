'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, ArrowDown, ArrowUp, ClipboardCheck, Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import {
  PROOF_MODES,
  promotionWindow,
  type ProofMode,
  type Promotion,
  type PromotionWindow,
  type SubmissionStatus,
} from '@/lib/rewards/catalog'
import { formatPoints } from '@/lib/referral-hq/program'
import {
  ApiError,
  ArtPicker,
  EditorActions,
  ErrorNote,
  Field,
  FieldGroup,
  Forbidden,
  INPUT_CLASS,
  Modal,
  Pill,
  Toggle,
  requestJson,
  useAction,
} from '@/components/admin/rewards'

type AdminPromotion = Promotion & { counts: Record<SubmissionStatus, number> }

const WINDOW: Record<PromotionWindow, { label: string; tone: 'purple' | 'green' | 'gray' }> = {
  upcoming: { label: 'Upcoming', tone: 'purple' },
  open: { label: 'Open', tone: 'green' },
  ended: { label: 'Ended', tone: 'gray' },
}

const MODE_LABEL: Record<ProofMode, string> = { off: 'Off', optional: 'Optional', required: 'Required' }

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function windowText(p: Promotion) {
  if (p.starts_at && p.ends_at) return `${dateTime(p.starts_at)} – ${dateTime(p.ends_at)}`
  if (p.starts_at) return `From ${dateTime(p.starts_at)}`
  if (p.ends_at) return `Until ${dateTime(p.ends_at)}`
  return 'No start or end date'
}

/** ISO → what a datetime-local input expects, in the browser's time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<AdminPromotion[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AdminPromotion | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ promotions: AdminPromotion[] }>('/api/admin/promotions')
      setPromotions(data.promotions)
      setError('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setForbidden(true)
      else setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (forbidden) return <Forbidden>Hunts are managed by admins only.</Forbidden>

  const pending = promotions.reduce((sum, p) => sum + p.counts.pending, 0)

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-1 font-headline text-2xl text-white">Hunts</h1>
          <p className="max-w-3xl text-sm text-[#A0A0A0]">
            Tasks members complete for points. Each Hunt says what proof it takes, and staff check every submission in
            the review queue before any points go out.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/admin/promotions/review"
            className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-white transition-colors hover:border-[#9B30FF]/60"
          >
            <ClipboardCheck className="h-4 w-4 text-[#9B30FF]" />
            Review queue
            <span
              className={cn(
                'rounded-full px-2 text-xs font-bold',
                pending ? 'bg-[#FFD700] text-black' : 'bg-[#2A2A2A] text-[#A0A0A0]'
              )}
            >
              {pending}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#9B30FF] hover:text-white"
          >
            <Plus className="h-4 w-4" />
            New Hunt
          </button>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#9B30FF]" />
        </div>
      ) : promotions.length === 0 ? (
        <p className="rounded-2xl border border-[#2A2A2A] bg-[#141414] px-5 py-8 text-sm text-[#A0A0A0]">
          No Hunts yet. Create the first one.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {promotions.map((p) => {
            const timing = WINDOW[promotionWindow(p)]
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setEditing(p)}
                className={cn(
                  'flex gap-4 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4 text-left transition-colors hover:border-[#9B30FF]/50',
                  !p.is_active && 'opacity-60'
                )}
              >
                <Image src={artSrc(p.icon, 'bullseye')} alt="" width={56} height={56} className="h-14 w-14 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-white">{p.title}</p>
                    <span className="shrink-0 font-semibold text-[#FFD700]">{formatPoints(p.points)} pts</span>
                  </div>
                  {p.summary && <p className="mt-1 line-clamp-2 text-xs text-[#A0A0A0]">{p.summary}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tone={timing.tone}>{timing.label}</Pill>
                    {p.is_active ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}
                    <Pill tone={p.counts.pending ? 'gold' : 'gray'}>{p.counts.pending} pending</Pill>
                    <Pill>{p.counts.approved} approved</Pill>
                    <Pill>{p.counts.rejected} rejected</Pill>
                  </div>
                  <p className="mt-2 text-[11px] text-[#666]">{windowText(p)}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {editing && (
        <PromotionEditor
          promotion={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

interface Draft {
  title: string
  slug: string
  summary: string
  instructions: string
  requirements: string[]
  review_checklist: string[]
  points: string
  url_mode: ProofMode
  image_mode: ProofMode
  text_mode: ProofMode
  url_label: string
  url_hosts: string
  icon: string | null
  starts_at: string
  ends_at: string
  max_per_member: string
  is_active: boolean
}

function toDraft(p: AdminPromotion | null): Draft {
  return {
    title: p?.title ?? '',
    slug: p?.slug ?? '',
    summary: p?.summary ?? '',
    instructions: p?.instructions ?? '',
    requirements: p?.requirements ?? [],
    review_checklist: p?.review_checklist ?? [],
    points: p ? String(p.points) : '',
    url_mode: p?.url_mode ?? 'required',
    image_mode: p?.image_mode ?? 'off',
    text_mode: p?.text_mode ?? 'off',
    url_label: p?.url_label ?? '',
    url_hosts: (p?.url_hosts ?? []).join(', '),
    icon: p?.icon ?? 'bullseye',
    starts_at: toLocalInput(p?.starts_at ?? null),
    ends_at: toLocalInput(p?.ends_at ?? null),
    max_per_member: String(p?.max_per_member ?? 1),
    is_active: p?.is_active ?? true,
  }
}

function PromotionEditor({
  promotion,
  onClose,
  onSaved,
}: {
  promotion: AdminPromotion | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [draft, setDraft] = useState(() => toDraft(promotion))
  const { busy, error, run } = useAction()
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const noProof = draft.url_mode === 'off' && draft.image_mode === 'off' && draft.text_mode === 'off'
  const submissions = promotion ? promotion.counts.pending + promotion.counts.approved + promotion.counts.rejected : 0

  const save = () =>
    run(async () => {
      await requestJson(promotion ? `/api/admin/promotions/${promotion.id}` : '/api/admin/promotions', {
        method: promotion ? 'PATCH' : 'POST',
        body: {
          ...draft,
          points: Number(draft.points),
          max_per_member: Number(draft.max_per_member),
          url_hosts: draft.url_hosts.split(/[\s,]+/).filter(Boolean),
          starts_at: fromLocalInput(draft.starts_at),
          ends_at: fromLocalInput(draft.ends_at),
        },
      })
      await onSaved()
    })

  const remove = () => {
    if (!promotion || !confirm(`Delete the “${promotion.title}” Hunt? This can’t be undone.`)) return
    run(async () => {
      await requestJson(`/api/admin/promotions/${promotion.id}`, { method: 'DELETE' })
      await onSaved()
    })
  }

  return (
    <Modal title={promotion ? 'Edit Hunt' : 'New Hunt'} onClose={() => !busy && onClose()} wide>
      <div className="space-y-5">
        <Field label="Title">
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={120} className={INPUT_CLASS} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field
            label="Slug"
            hint={
              promotion
                ? 'Used in links. Changing it breaks links already shared.'
                : 'Used in links. Leave blank to make one from the title.'
            }
          >
            <input
              value={draft.slug}
              onChange={(e) => set('slug', e.target.value)}
              maxLength={60}
              placeholder="fifty-like-hunt"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Points">
            <input
              type="number"
              min={1}
              step={1}
              value={draft.points}
              onChange={(e) => set('points', e.target.value)}
              placeholder="5000"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <Field label="Summary" hint="One or two sentences for the Hunt card.">
          <textarea
            value={draft.summary}
            onChange={(e) => set('summary', e.target.value)}
            rows={2}
            maxLength={300}
            className={cn(INPUT_CLASS, 'resize-none')}
          />
        </Field>
        <Field label="Instructions" hint="One step per line.">
          <textarea
            value={draft.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            rows={4}
            maxLength={4000}
            className={cn(INPUT_CLASS, 'resize-y')}
          />
        </Field>
        <FieldGroup label="Member rules" hint="Members confirm each one when they submit.">
          <ListEditor
            items={draft.requirements}
            onChange={(items) => set('requirements', items)}
            placeholder="My post is set to Public"
          />
        </FieldGroup>
        <FieldGroup label="Reviewer checklist" hint="Reviewers tick every item before they can approve.">
          <ListEditor
            items={draft.review_checklist}
            onChange={(items) => set('review_checklist', items)}
            placeholder="The link opens while signed out"
          />
        </FieldGroup>

        <FieldGroup label="Proof">
          <div className="space-y-2 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-3">
            <ProofControl label="Link" value={draft.url_mode} onChange={(m) => set('url_mode', m)} />
            <ProofControl label="Screenshot" value={draft.image_mode} onChange={(m) => set('image_mode', m)} />
            <ProofControl label="Note" value={draft.text_mode} onChange={(m) => set('text_mode', m)} />
          </div>
        </FieldGroup>
        {noProof && (
          <p className="flex gap-2 text-xs text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Turn on at least one kind of proof.
          </p>
        )}
        {draft.url_mode !== 'off' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link label" hint="What members are asked for.">
              <input
                value={draft.url_label}
                onChange={(e) => set('url_label', e.target.value)}
                maxLength={80}
                placeholder="Facebook post link"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Allowed link hosts" hint="Comma or space separated. Subdomains count. Blank: any https link.">
              <input
                value={draft.url_hosts}
                onChange={(e) => set('url_hosts', e.target.value)}
                placeholder="facebook.com, fb.com"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        )}

        <FieldGroup label="Icon">
          <ArtPicker value={draft.icon} onChange={(key) => set('icon', key)} />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" hint="Blank: open as soon as it’s active.">
            <input
              type="datetime-local"
              value={draft.starts_at}
              onChange={(e) => set('starts_at', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Ends" hint="Blank: no end date.">
            <input
              type="datetime-local"
              value={draft.ends_at}
              onChange={(e) => set('ends_at', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className="w-40">
            <Field label="Max per member">
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={draft.max_per_member}
                onChange={(e) => set('max_per_member', e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <div className="pb-2">
            <Toggle checked={draft.is_active} onChange={(v) => set('is_active', v)} label="Active (members can see it)" />
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <EditorActions
          busy={busy}
          onSave={save}
          onCancel={onClose}
          onDelete={promotion ? remove : undefined}
          deleteBlockedReason={
            submissions ? 'Members have sent proof for this Hunt, so it can only be deactivated.' : undefined
          }
        />
      </div>
    </Modal>
  )
}

function ProofControl({ label, value, onChange }: { label: string; value: ProofMode; onChange: (mode: ProofMode) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-white">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-[#2A2A2A] p-0.5">
        {PROOF_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value === mode}
            onClick={() => onChange(mode)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              value === mode
                ? mode === 'off'
                  ? 'bg-[#2A2A2A] text-white'
                  : 'bg-[#9B30FF] text-white'
                : 'text-[#A0A0A0] hover:text-white'
            )}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>
    </div>
  )
}

const MAX_LIST_ITEMS = 12

/** Rows of short text that can be added, removed and reordered. */
function ListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const move = (from: number, to: number) => {
    const next = [...items]
    next.splice(to, 0, ...next.splice(from, 1))
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={item}
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
            maxLength={200}
            placeholder={placeholder}
            className={cn(INPUT_CLASS, 'min-w-0 flex-1')}
          />
          <RowButton label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
            <ArrowUp className="h-4 w-4" />
          </RowButton>
          <RowButton label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
            <ArrowDown className="h-4 w-4" />
          </RowButton>
          <RowButton label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </RowButton>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        disabled={items.length >= MAX_LIST_ITEMS}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#2A2A2A] px-3 py-1.5 text-xs text-[#A0A0A0] transition-colors hover:border-[#9B30FF]/60 hover:text-white disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        {items.length >= MAX_LIST_ITEMS ? `${MAX_LIST_ITEMS} rows at most` : 'Add a row'}
      </button>
    </div>
  )
}

function RowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#A0A0A0] transition-colors hover:bg-[#1A1A1A] hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  )
}
