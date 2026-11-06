'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import type { Promotion, PromotionSubmission, SubmissionStatus } from '@/lib/rewards/catalog'
import { formatPoints } from '@/lib/referral-hq/program'
import { ApiError, ErrorNote, Forbidden, INPUT_CLASS, Pill, requestJson, useAction } from '@/components/admin/rewards'

type Submission = PromotionSubmission & {
  proof_image_url: string | null
  promotion: Pick<Promotion, 'title' | 'points' | 'review_checklist' | 'requirements' | 'icon' | 'url_label'>
  member: { email: string; first_name: string | null; points_balance: number }
  reviewer: { full_name: string } | null
}

const FILTERS: { value: SubmissionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const MAX_POINTS = 100_000

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** The hostname of an http(s) link, or null for anything else (never render those as links). */
function linkHost(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.hostname : null
  } catch {
    return null
  }
}

export default function HuntReviewPage() {
  const [status, setStatus] = useState<SubmissionStatus>('pending')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await requestJson<{ submissions: Submission[] }>(`/api/admin/promotions/submissions?status=${status}`)
      setSubmissions(data.submissions)
      setError('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setForbidden(true)
      else setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  if (forbidden) return <Forbidden>The Hunt review queue needs access to member data.</Forbidden>

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/promotions" className="mb-3 inline-flex items-center gap-1.5 text-xs text-[#A0A0A0] hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Hunts
        </Link>
        <h1 className="mb-1 font-headline text-2xl text-white">Review queue</h1>
        <p className="max-w-3xl text-sm text-[#A0A0A0]">
          Check each member&apos;s proof against the Hunt&apos;s checklist. Approving adds the points and emails the
          member; rejecting emails them your note so they can fix it and send it again.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setSubmissions([])
              setStatus(f.value)
            }}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              status === f.value
                ? 'bg-[#9B30FF]/15 text-[#C89BFF] ring-1 ring-[#9B30FF]/40'
                : 'text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white'
            )}
          >
            {f.label}
          </button>
        ))}
        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-[#666]" />}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!loading && submissions.length === 0 ? (
        <p className="rounded-2xl border border-[#2A2A2A] bg-[#141414] px-5 py-8 text-sm text-[#A0A0A0]">
          {status === 'pending' ? 'All caught up. Nothing is waiting for review.' : 'Nothing here yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} onReviewed={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function SubmissionCard({ submission: s, onReviewed }: { submission: Submission; onReviewed: () => Promise<void> }) {
  const host = s.proof_url ? linkHost(s.proof_url) : null

  return (
    <article className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
      <header className="flex items-start gap-3">
        <Image src={artSrc(s.promotion.icon, 'bullseye')} alt="" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">{s.promotion.title}</h2>
          <p className="text-xs text-[#A0A0A0]">
            {formatPoints(s.promotion.points)} pts · submitted {dateTime(s.created_at)}
          </p>
        </div>
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="truncate text-sm font-medium text-white">{s.member.first_name || s.member.email}</p>
            <p className="truncate text-xs text-[#A0A0A0]">{s.member.email}</p>
            <p className="mt-0.5 text-[11px] text-[#666]">Balance {formatPoints(s.member.points_balance ?? 0)} pts</p>
          </div>

          {s.proof_url &&
            (host ? (
              <a
                href={s.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2.5 text-sm text-[#C89BFF] hover:border-[#9B30FF]/60"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {s.promotion.url_label || 'Link'} on <span className="font-semibold text-white">{host}</span>
                </span>
              </a>
            ) : (
              <p className="break-all text-xs text-[#A0A0A0]">Not a web link, so it isn’t clickable: {s.proof_url}</p>
            ))}

          {s.proof_image_url && (
            <a href={s.proof_image_url} target="_blank" rel="noopener noreferrer" className="block w-fit" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.proof_image_url}
                alt="Screenshot the member sent"
                className="max-h-56 max-w-full rounded-xl border border-[#2A2A2A] object-contain"
              />
            </a>
          )}

          {s.proof_text && (
            <blockquote className="whitespace-pre-wrap break-words rounded-xl border-l-2 border-[#9B30FF]/60 bg-[#0A0A0A] px-3 py-2 text-sm text-[#D0D0D0]">
              {s.proof_text}
            </blockquote>
          )}

          {s.attestations.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#666]">The member confirmed</p>
              <ul className="space-y-1">
                {s.attestations.map((rule, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[#D0D0D0]">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {s.status === 'pending' ? <ReviewForm submission={s} onReviewed={onReviewed} /> : <Outcome submission={s} />}
        </div>
      </div>
    </article>
  )
}

function ReviewForm({ submission: s, onReviewed }: { submission: Submission; onReviewed: () => Promise<void> }) {
  const checklist = s.promotion.review_checklist
  const [checked, setChecked] = useState<boolean[]>(() => checklist.map(() => false))
  const [points, setPoints] = useState(String(s.promotion.points))
  const [note, setNote] = useState('')
  const { busy, error, run } = useAction()

  const pointsValue = Number(points)
  const pointsValid = Number.isInteger(pointsValue) && pointsValue >= 1 && pointsValue <= MAX_POINTS
  const allChecked = checked.every(Boolean)
  const canReject = note.trim().length >= 3

  const review = (action: 'approve' | 'reject') =>
    run(async () => {
      await requestJson(`/api/admin/promotions/submissions/${s.id}`, {
        method: 'PATCH',
        body: action === 'approve' ? { action, note, points: pointsValue } : { action, note },
      })
      await onReviewed()
    })

  return (
    <div className="space-y-4 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4">
      {checklist.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-[#666]">Check before approving</p>
          <ul className="space-y-2">
            {checklist.map((item, i) => (
              <li key={i}>
                <label className="flex cursor-pointer gap-2.5 text-sm text-[#D0D0D0]">
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#9B30FF]"
                  />
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-xs text-[#A0A0A0]">Points to award</span>
        <input
          type="number"
          min={1}
          max={MAX_POINTS}
          step={1}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className={cn(INPUT_CLASS, 'w-40')}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs text-[#A0A0A0]">Note to the member</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Optional when approving. Required when rejecting: say what to fix."
          className={cn(INPUT_CLASS, 'resize-none')}
        />
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => review('approve')}
          disabled={busy || !allChecked || !pointsValid}
          title={!allChecked ? 'Tick every checklist item first' : undefined}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Approve{pointsValid ? ` +${formatPoints(pointsValue)}` : ''}
        </button>
        <button
          type="button"
          onClick={() => review('reject')}
          disabled={busy || !canReject}
          title={!canReject ? 'Add a note first' : undefined}
          className="inline-flex items-center gap-2 rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Reject
        </button>
      </div>
      {!allChecked && <p className="text-[11px] text-[#666]">Tick every checklist item to approve.</p>}
    </div>
  )
}

function Outcome({ submission: s }: { submission: Submission }) {
  const approved = s.status === 'approved'
  return (
    <div className="space-y-2 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={approved ? 'green' : 'red'}>{approved ? 'Approved' : 'Rejected'}</Pill>
        {approved && <span className="font-semibold text-[#FFD700]">+{formatPoints(s.points_awarded)} pts</span>}
      </div>
      <p className="text-xs text-[#A0A0A0]">
        {s.reviewer?.full_name ?? 'Staff'}
        {s.reviewed_at ? ` · ${dateTime(s.reviewed_at)}` : ''}
      </p>
      {s.review_note ? (
        <p className="whitespace-pre-wrap break-words text-[#D0D0D0]">“{s.review_note}”</p>
      ) : (
        <p className="text-xs text-[#666]">No note.</p>
      )}
    </div>
  )
}
