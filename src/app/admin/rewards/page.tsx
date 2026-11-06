'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { AlertTriangle, Check, Loader2, Plus, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import {
  REWARD_KINDS,
  formatValue,
  type ClaimStatus,
  type Milestone,
  type MilestoneClaim,
  type RewardItem,
  type RewardKind,
} from '@/lib/rewards/catalog'
import { compactPoints, formatPoints } from '@/lib/referral-hq/program'
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

type AdminItem = RewardItem & { milestone_count: number; claim_count: number }
type AdminMilestone = Milestone & { claim_count: number }
type AdminClaim = MilestoneClaim & {
  member: { email: string; first_name: string | null }
  milestone: { title: string; points: number }
}

type Tab = 'trail' | 'rewards' | 'claims'
const TABS: { value: Tab; label: string }[] = [
  { value: 'trail', label: 'Trail' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'claims', label: 'Claims' },
]

const KIND_LABEL = Object.fromEntries(REWARD_KINDS.map((k) => [k.value, k.label])) as Record<RewardKind, string>

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function AdminRewardsPage() {
  const [tab, setTab] = useState<Tab>('trail')
  const [milestones, setMilestones] = useState<AdminMilestone[]>([])
  const [items, setItems] = useState<AdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([
        requestJson<{ milestones: AdminMilestone[] }>('/api/admin/rewards/milestones'),
        requestJson<{ items: AdminItem[] }>('/api/admin/rewards/items'),
      ])
      setMilestones(m.milestones)
      setItems(i.items)
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

  if (forbidden) return <Forbidden>The Rewards Program is for admins only.</Forbidden>

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="mb-1 font-headline text-2xl text-white">Rewards Program</h1>
        <p className="max-w-3xl text-sm text-[#A0A0A0]">
          The points trail members climb, the rewards its milestones unlock, and the claims waiting to go out. The
          trail counts engagement points only (joining, friends, approved posts and Hunts), never purchases.
        </p>
      </div>

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-[#9B30FF]/15 text-[#C89BFF] ring-1 ring-[#9B30FF]/40'
                : 'text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {tab === 'claims' ? (
        <ClaimsTab />
      ) : loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#9B30FF]" />
        </div>
      ) : tab === 'trail' ? (
        <TrailTab milestones={milestones} items={items} onSaved={load} />
      ) : (
        <RewardsTab items={items} onSaved={load} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trail
// ---------------------------------------------------------------------------

function TrailTab({
  milestones,
  items,
  onSaved,
}: {
  milestones: AdminMilestone[]
  items: AdminItem[]
  onSaved: () => Promise<void>
}) {
  const [editing, setEditing] = useState<AdminMilestone | 'new' | null>(null)
  const maxRoot = Math.sqrt(Math.max(1, ...milestones.map((m) => m.points)))
  // Square-root scale: 2,500 and 200,000 both get room. 5–95% keeps end labels inside.
  const place = (points: number) => `${5 + (Math.sqrt(points) / maxRoot) * 90}%`

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg text-white">The trail</h2>
            <p className="text-xs text-[#A0A0A0]">
              Spaced on a square-root scale so early and late milestones both fit. Click a marker to edit it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#9B30FF] hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Add milestone
          </button>
        </div>

        {milestones.length === 0 ? (
          <p className="mt-6 text-sm text-[#A0A0A0]">No milestones yet. Add the first marker on the trail.</p>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto px-5 pb-2">
            <div className="relative h-[220px] min-w-[960px]">
              <div className="absolute left-[5%] right-[5%] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#9B30FF] to-[#FFD700] opacity-70" />
              <span className="absolute left-[5%] top-[calc(50%+12px)] -translate-x-1/2 text-[11px] text-[#666]">0</span>
              {milestones.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setEditing(m)}
                  title={m.is_active ? `Edit ${m.title}` : `Edit ${m.title} (inactive)`}
                  style={{ left: place(m.points) }}
                  className={cn(
                    'group absolute flex w-24 -translate-x-1/2 flex-col items-center gap-1.5 hover:z-10',
                    i % 2 ? 'top-[calc(50%-20px)]' : 'bottom-[calc(50%-20px)] flex-col-reverse',
                    !m.is_active && 'opacity-40'
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#9B30FF]/60 bg-[#0A0A0A] transition-transform group-hover:scale-110 group-hover:border-[#FFD700]">
                    <Image
                      src={artSrc(m.icon)}
                      alt=""
                      width={32}
                      height={32}
                      className={cn('h-8 w-8 object-contain', !m.is_active && 'grayscale')}
                    />
                  </span>
                  <span className="w-full text-center leading-tight">
                    <span className="block text-xs font-semibold text-[#FFD700]">{compactPoints(m.points)}</span>
                    <span className="block truncate text-[11px] text-white">{m.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {milestones.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#141414]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-[#2A2A2A] text-left text-xs uppercase tracking-wider text-[#666]">
                <tr>
                  <th className="px-5 py-3 font-medium">Points</th>
                  <th className="px-5 py-3 font-medium">Milestone</th>
                  <th className="px-5 py-3 font-medium">Reward</th>
                  <th className="px-5 py-3 font-medium">Claims</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {milestones.map((m) => (
                  <tr key={m.id} className={cn('hover:bg-[#1A1A1A]', !m.is_active && 'opacity-60')}>
                    <td className="px-5 py-3 font-semibold text-[#FFD700]">{formatPoints(m.points)}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setEditing(m)}
                        className="flex items-center gap-2 text-left text-white hover:text-[#C89BFF]"
                      >
                        <Image src={artSrc(m.icon)} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                        {m.title}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-[#A0A0A0]">
                      {m.reward ? `${m.reward.name} · ${formatValue(m.reward.value_cents)}` : 'Marker only'}
                      {m.reward && !m.reward.is_active && <span className="ml-1.5 text-amber-400">(inactive)</span>}
                    </td>
                    <td className="px-5 py-3 text-[#A0A0A0]">{m.claim_count}</td>
                    <td className="px-5 py-3">
                      {m.is_active ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <MilestoneEditor
          milestone={editing === 'new' ? null : editing}
          items={items}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await onSaved()
          }}
        />
      )}
    </div>
  )
}

function MilestoneEditor({
  milestone,
  items,
  onClose,
  onSaved,
}: {
  milestone: AdminMilestone | null
  items: AdminItem[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [points, setPoints] = useState(milestone ? String(milestone.points) : '')
  const [title, setTitle] = useState(milestone?.title ?? '')
  const [tagline, setTagline] = useState(milestone?.tagline ?? '')
  const [icon, setIcon] = useState<string | null>(milestone?.icon ?? 'first-tracks')
  const [rewardId, setRewardId] = useState(milestone?.reward_id ?? '')
  const [active, setActive] = useState(milestone?.is_active ?? true)
  const { busy, error, run } = useAction()

  const rewardOptions = [...items].sort((a, b) => a.value_cents - b.value_cents)
  const reward = items.find((item) => item.id === rewardId)
  const claimed = (milestone?.claim_count ?? 0) > 0

  const save = () =>
    run(async () => {
      await requestJson(milestone ? `/api/admin/rewards/milestones/${milestone.id}` : '/api/admin/rewards/milestones', {
        method: milestone ? 'PATCH' : 'POST',
        body: { points: Number(points), title, tagline, icon, reward_id: rewardId || null, is_active: active },
      })
      await onSaved()
    })

  const remove = () => {
    if (!milestone || !confirm(`Delete the “${milestone.title}” milestone? This can’t be undone.`)) return
    run(async () => {
      await requestJson(`/api/admin/rewards/milestones/${milestone.id}`, { method: 'DELETE' })
      await onSaved()
    })
  }

  return (
    <Modal title={milestone ? 'Edit milestone' : 'New milestone'} onClose={() => !busy && onClose()}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Points">
            <input
              type="number"
              min={1}
              step={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="25000"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={INPUT_CLASS} />
          </Field>
        </div>
        <Field label="Tagline" hint="One short line members see under the title.">
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} className={INPUT_CLASS} />
        </Field>
        <FieldGroup label="Icon">
          <ArtPicker value={icon} onChange={setIcon} />
        </FieldGroup>
        <Field label="Reward">
          <select value={rewardId} onChange={(e) => setRewardId(e.target.value)} className={INPUT_CLASS}>
            <option value="">No reward — marker only</option>
            {rewardOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({formatValue(item.value_cents)}){item.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </Field>
        {reward && !reward.is_active && (
          <p className="text-xs text-amber-400">
            That reward is inactive, so members who reach this milestone have nothing to claim.
          </p>
        )}
        <Toggle checked={active} onChange={setActive} label="Active (shown on the members’ trail)" />

        {error && <ErrorNote>{error}</ErrorNote>}

        <EditorActions
          busy={busy}
          onSave={save}
          onCancel={onClose}
          onDelete={milestone ? remove : undefined}
          deleteBlockedReason={claimed ? 'Members have claimed this milestone, so it can only be deactivated.' : undefined}
        />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Reward catalog
// ---------------------------------------------------------------------------

function RewardsTab({ items, onSaved }: { items: AdminItem[]; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState<AdminItem | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[#A0A0A0]">
          What milestones unlock. Each claim keeps a snapshot of its reward, so edits here never change past claims.
        </p>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#9B30FF] hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Add reward
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-[#2A2A2A] bg-[#141414] px-5 py-8 text-sm text-[#A0A0A0]">
          No rewards yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setEditing(item)}
              className={cn(
                'flex gap-4 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4 text-left transition-colors hover:border-[#9B30FF]/50',
                !item.is_active && 'opacity-60'
              )}
            >
              <Image src={artSrc(item.icon)} alt="" width={56} height={56} className="h-14 w-14 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white">{item.name}</p>
                  <span className="shrink-0 font-semibold text-[#FFD700]">{formatValue(item.value_cents)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Pill>{KIND_LABEL[item.kind]}</Pill>
                  {item.is_active ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}
                </div>
                <p className="mt-2 text-xs text-[#A0A0A0]">
                  Used by {plural(item.milestone_count, 'milestone')} · {plural(item.claim_count, 'claim')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <RewardEditor
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await onSaved()
          }}
        />
      )}
    </div>
  )
}

function RewardEditor({
  item,
  onClose,
  onSaved,
}: {
  item: AdminItem | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [kind, setKind] = useState<RewardKind>(item?.kind ?? 'merch')
  const [dollars, setDollars] = useState(item ? String(item.value_cents / 100) : '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [icon, setIcon] = useState<string | null>(item?.icon ?? 'hoodie')
  const [fulfillmentNote, setFulfillmentNote] = useState(item?.fulfillment_note ?? '')
  const [active, setActive] = useState(item?.is_active ?? true)
  const { busy, error, run } = useAction()

  const inUse = item ? item.milestone_count + item.claim_count > 0 : false

  const save = () =>
    run(async () => {
      await requestJson(item ? `/api/admin/rewards/items/${item.id}` : '/api/admin/rewards/items', {
        method: item ? 'PATCH' : 'POST',
        body: {
          name,
          kind,
          value_cents: Math.round(Number(dollars || 0) * 100),
          description,
          icon,
          fulfillment_note: fulfillmentNote,
          is_active: active,
        },
      })
      await onSaved()
    })

  const remove = () => {
    if (!item || !confirm(`Delete “${item.name}” from the catalog? This can’t be undone.`)) return
    run(async () => {
      await requestJson(`/api/admin/rewards/items/${item.id}`, { method: 'DELETE' })
      await onSaved()
    })
  }

  return (
    <Modal title={item ? 'Edit reward' : 'New reward'} onClose={() => !busy && onClose()}>
      <div className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={INPUT_CLASS} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value as RewardKind)} className={INPUT_CLASS}>
              {REWARD_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value (USD)" hint="Approximate retail value. Counts toward the yearly reward cap.">
            <input
              type="number"
              min={0}
              step="0.01"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              placeholder="25"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        {kind === 'gift_card' && (
          <p className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Gift cards count as cash equivalents. The legal review recommended merchandise only, so confirm gift cards
            with counsel before members can claim them.
          </p>
        )}
        <Field label="Description" hint="Shown to members.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={1000}
            className={cn(INPUT_CLASS, 'resize-none')}
          />
        </Field>
        <FieldGroup label="Icon">
          <ArtPicker value={icon} onChange={setIcon} />
        </FieldGroup>
        <Field label="Fulfillment note" hint="Staff only: how to fulfill it (brand, where to buy, who sends it).">
          <textarea
            value={fulfillmentNote}
            onChange={(e) => setFulfillmentNote(e.target.value)}
            rows={2}
            maxLength={2000}
            className={cn(INPUT_CLASS, 'resize-none')}
          />
        </Field>
        <Toggle checked={active} onChange={setActive} label="Active (members can claim it)" />

        {error && <ErrorNote>{error}</ErrorNote>}

        <EditorActions
          busy={busy}
          onSave={save}
          onCancel={onClose}
          onDelete={item ? remove : undefined}
          deleteBlockedReason={inUse ? 'A milestone uses this reward or members have claimed it, so it can only be deactivated.' : undefined}
        />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

const CLAIM_FILTERS: { value: ClaimStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

const CLAIM_TONE = { pending: 'gold', fulfilled: 'green', cancelled: 'gray' } as const

function ClaimsTab() {
  const [status, setStatus] = useState<ClaimStatus | 'all'>('pending')
  const [claims, setClaims] = useState<AdminClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await requestJson<{ claims: AdminClaim[] }>(`/api/admin/rewards/claims?status=${status}`)
      setClaims(data.claims)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CLAIM_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setClaims([])
              setStatus(f.value)
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              status === f.value
                ? 'border-[#9B30FF]/50 bg-[#9B30FF]/10 text-[#C89BFF]'
                : 'border-[#2A2A2A] text-[#A0A0A0] hover:text-white'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] px-5 py-3 text-xs uppercase tracking-wider text-[#666]">
          <span>{status === 'pending' ? 'Waiting to be sent, oldest first' : 'Claims, newest first'}</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {!loading && claims.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#A0A0A0]">
            {status === 'pending' ? 'Nothing to fulfill. Every claim has gone out.' : 'No claims here.'}
          </p>
        ) : (
          <ul className="divide-y divide-[#2A2A2A]">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} onDone={load} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ClaimRow({ claim, onDone }: { claim: AdminClaim; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'fulfill' | 'cancel' | null>(null)
  const [note, setNote] = useState('')
  const [emailMember, setEmailMember] = useState(true)
  const { busy, error, run } = useAction()

  const act = (action: 'fulfill' | 'cancel' | 'reopen') =>
    run(async () => {
      await requestJson(`/api/admin/rewards/claims/${claim.id}`, {
        method: 'PATCH',
        body: { action, note, notifyMember: emailMember },
      })
      await onDone()
    })

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-white">{claim.member.first_name || claim.member.email}</div>
          <div className="truncate text-xs text-[#A0A0A0]">{claim.member.email}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={CLAIM_TONE[claim.status]}>
              <span className="capitalize">{claim.status}</span>
            </Pill>
            <Pill tone="purple">
              {claim.milestone.title} · {compactPoints(claim.milestone.points)}
            </Pill>
            <Pill tone="gold">
              {claim.reward_name} · {formatValue(claim.value_cents)}
            </Pill>
            <Pill>{KIND_LABEL[claim.reward_kind] ?? claim.reward_kind}</Pill>
            <Pill>Ship to {claim.ship_state || '—'}</Pill>
            <Pill>Claimed {shortDate(claim.created_at)}</Pill>
            {claim.fulfilled_at && <Pill>Fulfilled {shortDate(claim.fulfilled_at)}</Pill>}
          </div>
          {claim.staff_note && <p className="mt-2 text-xs text-[#A0A0A0]">Note: {claim.staff_note}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {claim.status === 'pending' ? (
            <>
              <button
                type="button"
                onClick={() => setMode(mode === 'fulfill' ? null : 'fulfill')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-[#9B30FF] hover:text-white disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Fulfill
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'cancel' ? null : 'cancel')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] px-3.5 py-1.5 text-sm text-[#A0A0A0] transition-colors hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => act('reopen')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] px-3.5 py-1.5 text-sm text-[#A0A0A0] transition-colors hover:text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reopen
            </button>
          )}
        </div>
      </div>

      {mode && claim.status === 'pending' && (
        <div className="space-y-3 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={
              mode === 'fulfill'
                ? 'Gift card code, tracking number, or a note for the member (optional)'
                : 'Why it’s cancelled (optional)'
            }
            className={cn(INPUT_CLASS, 'resize-none')}
          />
          {mode === 'fulfill' && (
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={emailMember}
                onChange={(e) => setEmailMember(e.target.checked)}
                className="h-4 w-4 accent-[#9B30FF]"
              />
              Email the member (the note goes in the email)
            </label>
          )}
          <button
            type="button"
            onClick={() => act(mode)}
            disabled={busy}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
              mode === 'fulfill'
                ? 'bg-[#9B30FF] text-white hover:bg-[#7E22CE]'
                : 'border border-red-500/40 text-red-400 hover:bg-red-500/10'
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'fulfill' ? 'Mark fulfilled' : 'Cancel claim'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </li>
  )
}
