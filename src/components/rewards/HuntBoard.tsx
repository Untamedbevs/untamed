'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, CheckCircle2, Clock, ImagePlus, Link2, Loader2, Send, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import { linkAllowed, type ProofMode, type Promotion, type PromotionSubmission, type PromotionWindow } from '@/lib/rewards/catalog'
import { formatPoints } from '@/lib/referral-hq/program'
import { ClawMarks } from './ClawMarks'
import './rewards.css'

export interface HuntView extends Promotion {
  window: PromotionWindow
  /** The member's submissions for this Hunt, newest first. */
  mine: PromotionSubmission[]
}

/**
 * Hunts: promotions members complete for points. Each card opens the steps,
 * the rules to confirm, and the proof the Hunt accepts. Staff review every
 * submission before points land.
 */
export function HuntBoard({
  hunts,
  canSubmit,
  blockedMessage,
}: {
  hunts: HuntView[]
  canSubmit: boolean
  blockedMessage?: string
}) {
  const [open, setOpen] = useState<HuntView | null>(null)
  const history = hunts
    .flatMap((h) => h.mine.map((s) => ({ ...s, hunt: h })))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-[28px] border border-[#2A2A2A] bg-[#111] p-6 sm:p-8">
        <ClawMarks animate className="absolute -right-4 -top-6 h-48 w-48 text-[#E87511]/20" />
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#A0A0A0]">Pack Rewards</div>
          <h1 className="font-wild cyber-brush-fix text-5xl leading-none text-white sm:text-6xl">Hunts</h1>
          <p className="mt-2 max-w-xl text-[#C8C8C8]">
            Missions from the Untamed crew. Complete one, send us the proof, and the points land on your trail once we
            check it.
          </p>
        </div>
      </header>

      {!canSubmit && blockedMessage && (
        <p className="rounded-2xl border border-[#9B30FF]/30 bg-[#9B30FF]/10 px-4 py-3 text-sm text-[#D8C2FF]">{blockedMessage}</p>
      )}

      {hunts.length === 0 ? (
        <p className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 text-sm text-[#A0A0A0]">
          No Hunts running right now. New ones drop often, so check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hunts.map((h, i) => (
            <HuntCard key={h.id} hunt={h} onOpen={() => setOpen(h)} delay={i * 80} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">Your proof</h2>
          <ul className="mt-4 divide-y divide-[#2A2A2A]">
            {history.map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-3">
                <Image src={artSrc(s.hunt.icon, 'bullseye')} alt="" width={36} height={36} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{s.hunt.title}</div>
                  <div className="text-xs text-[#888]">Sent {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  {s.status === 'rejected' && s.review_note && <p className="mt-1 text-xs text-red-300">“{s.review_note}”</p>}
                </div>
                <StatusPill submission={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && <HuntSheet hunt={open} canSubmit={canSubmit} blockedMessage={blockedMessage} onClose={() => setOpen(null)} />}
    </div>
  )
}

function remaining(h: HuntView) {
  return Math.max(0, h.max_per_member - h.mine.filter((s) => s.status !== 'rejected').length)
}

function timing(h: HuntView) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (h.window === 'upcoming' && h.starts_at) return `Starts ${fmt(h.starts_at)}`
  if (h.ends_at) {
    const days = Math.ceil((new Date(h.ends_at).getTime() - Date.now()) / 86_400_000)
    return days <= 1 ? 'Ends today' : days <= 7 ? `${days} days left` : `Ends ${fmt(h.ends_at)}`
  }
  return 'Always on'
}

function HuntCard({ hunt, onOpen, delay }: { hunt: HuntView; onOpen: () => void; delay: number }) {
  const latest = hunt.mine[0]
  const done = remaining(hunt) === 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rw-rise group relative flex flex-col overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#E87511]/50"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#E87511]/10 blur-3xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start gap-4">
        <Image src={artSrc(hunt.icon, 'bullseye')} alt="" width={72} height={72} className="shrink-0 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105" />
        <div className="min-w-0">
          <div className="inline-flex items-center rounded-full bg-[#FFD700] px-2.5 py-0.5 text-xs font-bold text-black">
            +{formatPoints(hunt.points)} pts
          </div>
          <h3 className="mt-2 font-headline text-xl uppercase leading-tight text-white">{hunt.title}</h3>
        </div>
      </div>
      {hunt.summary && <p className="relative mt-3 text-sm text-[#B8B8B8]">{hunt.summary}</p>}
      <div className="relative mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
        <span className="inline-flex items-center gap-1 text-[#A0A0A0]">
          <Clock className="h-3.5 w-3.5" />
          {timing(hunt)}
        </span>
        {latest ? <StatusPill submission={latest} /> : done ? null : <span className="font-semibold text-[#E87511]">Start the hunt →</span>}
      </div>
    </button>
  )
}

function StatusPill({ submission }: { submission: PromotionSubmission }) {
  if (submission.status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#39FF14]/30 px-2 py-0.5 text-[11px] font-semibold text-[#39FF14]">
        <CheckCircle2 className="h-3 w-3" /> +{formatPoints(submission.points_awarded)}
      </span>
    )
  }
  if (submission.status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 px-2 py-0.5 text-[11px] font-semibold text-red-400">
        <XCircle className="h-3 w-3" /> Not approved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#FFD700]/30 px-2 py-0.5 text-[11px] font-semibold text-[#FFD700]">
      <Clock className="h-3 w-3" /> In review
    </span>
  )
}

function HuntSheet({
  hunt,
  canSubmit,
  blockedMessage,
  onClose,
}: {
  hunt: HuntView
  canSubmit: boolean
  blockedMessage?: string
  onClose: () => void
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState<{ key: string; preview: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const left = remaining(hunt)
  const open = hunt.window === 'open' && left > 0
  const steps = (hunt.instructions || '').split('\n').map((s) => s.trim()).filter(Boolean)
  const urlBad = url.trim() !== '' && !linkAllowed(url.trim(), hunt.url_hosts)
  const ready =
    hunt.requirements.every((r) => confirmed.has(r)) &&
    (hunt.url_mode !== 'required' || url.trim()) &&
    (hunt.image_mode !== 'required' || image) &&
    (hunt.text_mode !== 'required' || text.trim()) &&
    (url.trim() || image || text.trim()) &&
    !urlBad

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const res = await fetch('/api/portal/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, folder: 'promotions/proofs' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Upload failed')
      const put = await fetch(data.presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) throw new Error('Upload failed')
      setImage({ key: data.s3Key, preview: URL.createObjectURL(file) })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/portal/hunts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promotionId: hunt.id,
          proofUrl: url.trim() || undefined,
          proofImageKey: image?.key,
          proofText: text.trim() || undefined,
          confirmed: [...confirmed],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Something went wrong')
      setSent(true)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={hunt.title}
        className="rw-rise relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#2A2A2A] bg-[#141414] p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-[#666] hover:text-white" aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        {sent ? (
          <div className="py-6 text-center">
            <Image src={artSrc('verified-claw')} alt="" width={110} height={110} className="rw-pop mx-auto" />
            <h3 className="mt-3 font-headline text-2xl uppercase text-white">Proof sent</h3>
            <p className="mt-1 text-sm text-[#A0A0A0]">
              We’ll check it and add <span className="text-[#FFD700]">{formatPoints(hunt.points)} points</span> to your trail once it’s approved.
              We’ll email you either way.
            </p>
            <button type="button" onClick={onClose} className="mt-5 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black">
              Back to Hunts
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 pr-6">
              <Image src={artSrc(hunt.icon, 'bullseye')} alt="" width={64} height={64} className="shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#FFD700]">+{formatPoints(hunt.points)} points</div>
                <h3 className="font-headline text-2xl uppercase leading-tight text-white">{hunt.title}</h3>
              </div>
            </div>

            {steps.length > 0 && (
              <ol className="mt-5 space-y-2">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#D0D0D0]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E87511]/15 text-xs font-bold text-[#E87511]">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            )}

            {!open ? (
              <p className="mt-6 rounded-2xl border border-[#2A2A2A] bg-black/30 p-4 text-sm text-[#A0A0A0]">
                {hunt.window === 'upcoming' ? 'This Hunt hasn’t started yet.' : 'You’ve already sent proof for this Hunt.'}
              </p>
            ) : !canSubmit ? (
              <p className="mt-6 rounded-2xl border border-[#9B30FF]/30 bg-[#9B30FF]/10 p-4 text-sm text-[#D8C2FF]">{blockedMessage}</p>
            ) : (
              <>
                {hunt.requirements.length > 0 && (
                  <div className="mt-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">Before you send</div>
                    <div className="mt-2 space-y-1.5">
                      {hunt.requirements.map((r) => {
                        const on = confirmed.has(r)
                        return (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setConfirmed((c) => {
                                const next = new Set(c)
                                if (on) next.delete(r)
                                else next.add(r)
                                return next
                              })
                            }
                            className={cn(
                              'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                              on ? 'border-[#39FF14]/30 bg-[#39FF14]/[0.06] text-white' : 'border-[#2A2A2A] text-[#C8C8C8] hover:border-[#444]'
                            )}
                          >
                            <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-[#39FF14] bg-[#39FF14]' : 'border-[#555]')}>
                              {on && <Check className="h-3 w-3 text-black" />}
                            </span>
                            {r}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {hunt.url_mode !== 'off' && (
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
                        {hunt.url_label || 'Link'} <Optional mode={hunt.url_mode} />
                      </span>
                      <div className="relative mt-1.5">
                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
                        <input
                          type="url"
                          inputMode="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder={hunt.url_hosts[0] ? `https://www.${hunt.url_hosts[0]}/…` : 'https://…'}
                          className={cn(
                            'w-full rounded-xl border bg-black/50 py-3 pl-9 pr-3 text-sm text-white placeholder-[#555] focus:outline-none',
                            urlBad ? 'border-red-500/60' : 'border-[#2A2A2A] focus:border-[#E87511]'
                          )}
                        />
                      </div>
                      {urlBad && (
                        <span className="mt-1 block text-xs text-red-400">
                          Paste an https link{hunt.url_hosts.length ? ` from ${hunt.url_hosts.join(' or ')}` : ''}.
                        </span>
                      )}
                    </label>
                  )}

                  {hunt.image_mode !== 'off' && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
                        Screenshot <Optional mode={hunt.image_mode} />
                      </span>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                      />
                      {image ? (
                        <div className="relative mt-1.5 overflow-hidden rounded-xl border border-[#2A2A2A]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.preview} alt="Your screenshot" className="max-h-56 w-full object-contain bg-black" />
                          <button
                            type="button"
                            onClick={() => setImage(null)}
                            className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                            aria-label="Remove screenshot"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          disabled={uploading}
                          className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#3A3A3A] py-5 text-sm text-[#A0A0A0] hover:border-[#E87511]/60 hover:text-white"
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                          {uploading ? 'Uploading…' : 'Add a screenshot'}
                        </button>
                      )}
                    </div>
                  )}

                  {hunt.text_mode !== 'off' && (
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
                        Note <Optional mode={hunt.text_mode} />
                      </span>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="mt-1.5 w-full rounded-xl border border-[#2A2A2A] bg-black/50 p-3 text-sm text-white focus:border-[#E87511] focus:outline-none"
                      />
                    </label>
                  )}
                </div>

                {error && (
                  <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!ready || sending || uploading}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E87511] to-[#FFD700] px-6 py-3 text-sm font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send my proof
                </button>
                <p className="mt-2 text-center text-[11px] text-[#666]">Our team checks every Hunt before points are added.</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Optional({ mode }: { mode: ProofMode }) {
  return mode === 'optional' ? <span className="normal-case tracking-normal text-[#666]">(optional)</span> : null
}
