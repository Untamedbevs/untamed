'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Layers,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  HelpCircle,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import { collectFlowAssets, type FlowAssetEntry } from '@/lib/flow/collect-assets'
import { PLATFORMS } from '@/lib/constants/platforms'

interface MediaRef {
  id: string
  filename: string
  url: string
  file_type: string
}

interface FlowPostRow {
  id: string
  flow_id: string
  sort_order: number
  concept: string
  prompt: string
  generation_mode: string
  target_size: string
  status: string
  fal_model: string | null
  generation_metadata?: { request_id?: string; fal_result?: unknown } | null
  reference_external_url?: string | null
  reference_media?: MediaRef | null
  end_reference_media?: MediaRef | null
  generated_media?: MediaRef | null
}

interface FlowDetail {
  id: string
  title: string
  concept: string | null
  status: string
  platform_targets: string[]
  created_at?: string
  flow_posts: FlowPostRow[]
}

function shortId(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

function CopyUrlButton({ url }: { url: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-2.5 py-1 text-xs text-[#A0A0A0] hover:border-[#9B30FF]/50 hover:text-white transition-colors"
      title="Copy URL"
    >
      {done ? <Check className="w-3.5 h-3.5 text-[#4A7C0F]" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? 'Copied' : 'Copy URL'}
    </button>
  )
}

function EditablePrompt({
  postId,
  flowId,
  prompt,
  onSaved,
}: {
  postId: string
  flowId: string
  prompt: string
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(prompt)
  const [saving, setSaving] = useState(false)

  function open() {
    setValue(prompt)
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/posts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, prompt: value }),
      })
      if (res.ok) {
        setEditing(false)
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="group/prompt flex items-start gap-1">
        <details className="flex-1">
          <summary className="text-[#A0A0A0] text-xs truncate max-w-[300px] cursor-pointer hover:text-white transition-colors">
            {prompt ? prompt.slice(0, 60) + (prompt.length > 60 ? '\u2026' : '') : '\u2014'}
          </summary>
          <p className="mt-1 text-[11px] text-[#CCC] leading-relaxed whitespace-pre-wrap break-words bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-2">
            {prompt}
          </p>
        </details>
        <button
          type="button"
          onClick={open}
          className="shrink-0 opacity-0 group-hover/prompt:opacity-100 p-1 text-[#666] hover:text-[#9B30FF] transition-all"
          title="Edit prompt"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className="w-full text-[11px] text-white bg-[#0A0A0A] border border-[#9B30FF]/50 rounded-lg p-2 resize-y focus:outline-none focus:border-[#9B30FF]"
        autoFocus
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg bg-[#9B30FF] px-2 py-0.5 text-[10px] text-white font-medium hover:bg-[#BF5FFF] disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A2A] px-2 py-0.5 text-[10px] text-[#888] hover:text-white"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  )
}

function SegmentActions({
  post,
  flowId,
  busy,
  onUpdate,
  onRegenerate,
}: {
  post: FlowPostRow
  flowId: string
  busy: boolean
  onUpdate: () => void
  onRegenerate: () => void
}) {
  const [updating, setUpdating] = useState(false)

  async function setStatus(status: string) {
    setUpdating(true)
    try {
      const payload: Record<string, unknown> = { id: post.id, status }
      if (status === 'pending') {
        payload.generated_media_id = null
        payload.generation_metadata = null
      }
      await fetch(`/api/admin/flows/${flowId}/posts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onUpdate()
    } finally {
      setUpdating(false)
    }
  }

  const isComplete = post.status === 'complete'
  const isApproved = post.status === 'approved'
  const isRejected = post.status === 'rejected'
  const isPending = post.status === 'pending'
  const isMaybe = post.status === 'maybe'
  const hasOutput = !!post.generated_media?.url
  const canApprove = (isComplete || isMaybe) && hasOutput && !isApproved
  const canMarkMaybe = (isComplete || isApproved) && hasOutput && !isMaybe
  const canRejectReset = isComplete || isApproved || isMaybe

  return (
    <div className="flex items-center gap-1">
      {isApproved && (
        <span className="text-[10px] text-[#4A7C0F] font-medium bg-[#4A7C0F]/10 border border-[#4A7C0F]/30 rounded-full px-2 py-0.5">
          Approved
        </span>
      )}
      {isMaybe && (
        <span className="text-[10px] text-[#E8C547] font-medium bg-[#C9A227]/10 border border-[#C9A227]/30 rounded-full px-2 py-0.5">
          Maybe
        </span>
      )}
      {canApprove && (
        <button
          type="button"
          disabled={updating || busy}
          onClick={() => setStatus('approved')}
          className="p-1.5 rounded-lg text-[#4A7C0F] hover:bg-[#4A7C0F]/10 transition-colors disabled:opacity-40"
          title="Approve"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
      )}
      {canMarkMaybe && (
        <button
          type="button"
          disabled={updating || busy}
          onClick={() => setStatus('maybe')}
          className="p-1.5 rounded-lg text-[#E8C547] hover:bg-[#C9A227]/20 transition-colors disabled:opacity-40"
          title="Maybe (tentative, keep asset)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      )}
      {canRejectReset && (
        <button
          type="button"
          disabled={updating || busy}
          onClick={() => setStatus('pending')}
          className="p-1.5 rounded-lg text-[#FF0040] hover:bg-[#FF0040]/10 transition-colors disabled:opacity-40"
          title="Reject (reset to pending)"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      )}
      {(isPending || isRejected || isMaybe) && (
        <button
          type="button"
          disabled={updating || busy}
          onClick={onRegenerate}
          className="p-1.5 rounded-lg text-[#E87511] hover:bg-[#E87511]/10 transition-colors disabled:opacity-40"
          title="Regenerate this segment"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      {updating && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#888]" />}
    </div>
  )
}

function CopyIdButton({ id, label = 'Copy id' }: { id: string; label?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(id)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A2A] px-2 py-0.5 text-[11px] text-[#A0A0A0] hover:border-[#9B30FF]/50 hover:text-white transition-colors"
      title={label}
    >
      {done ? <Check className="w-3 h-3 text-[#4A7C0F]" /> : <Copy className="w-3 h-3" />}
      {done ? 'Copied' : label}
    </button>
  )
}

export default function AdminFlowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const flowId = typeof params.id === 'string' ? params.id : ''

  const [flow, setFlow] = useState<FlowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queueBusy, setQueueBusy] = useState(false)
  const [queueLog, setQueueLog] = useState<string | null>(null)
  const [idCopied, setIdCopied] = useState(false)
  const [confirmDeleteFlow, setConfirmDeleteFlow] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showQueuePanel, setShowQueuePanel] = useState(false)
  const [queuePlatforms, setQueuePlatforms] = useState<string[]>(['instagram', 'facebook'])
  const [queueDate, setQueueDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  )
  const [queueCaption, setQueueCaption] = useState('')
  const [queueSelectedMedia, setQueueSelectedMedia] = useState<string[]>([])
  const [queueAdding, setQueueAdding] = useState(false)
  const [queueSuccess, setQueueSuccess] = useState(false)

  const refresh = useCallback(async () => {
    if (!flowId) return
    const res = await fetch(`/api/admin/flows/${flowId}`)
    if (!res.ok) {
      setError('Flow not found')
      setFlow(null)
      return
    }
    const data = (await res.json()) as FlowDetail
    if (data.flow_posts) {
      data.flow_posts.sort((a, b) => a.sort_order - b.sort_order)
    }
    setFlow(data)
    setError(null)
  }, [flowId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  async function runQueue(maxSteps: number) {
    if (!flowId) return
    setQueueBusy(true)
    setQueueLog(null)
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/queue/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSteps }),
      })
      const j = await res.json()
      if (!res.ok) {
        setQueueLog(j.error || 'Queue run failed')
        return
      }
      const parts: string[] = []
      for (const s of j.steps || []) {
        if (s.kind === 'ran' && s.error) {
          parts.push(`Segment ${s.sortOrder + 1}: error — ${s.error}`)
        } else if (s.kind === 'ran') {
          const rid = s.falRequestId ? ` fal_request=${s.falRequestId}` : ''
          const mod = s.falModel ? ` model=${s.falModel}` : ''
          parts.push(`Segment ${s.sortOrder + 1}: ok${rid}${mod}`)
        } else if (s.kind === 'blocked') {
          parts.push(`Blocked: ${s.message}`)
        } else if (s.kind === 'idle') {
          parts.push(s.message)
        }
      }
      if (j.flowComplete) parts.push('Flow generation complete (reviewing).')
      setQueueLog(parts.join(' '))
      await refresh()
    } finally {
      setQueueBusy(false)
    }
  }

  async function resetStuck() {
    if (!flowId) return
    setQueueBusy(true)
    setQueueLog(null)
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/queue/reset-stuck`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok) {
        setQueueLog(j.error || 'Reset failed')
        return
      }
      setQueueLog(`Reset ${j.resetCount ?? 0} stuck segment(s) to pending.`)
      await refresh()
    } finally {
      setQueueBusy(false)
    }
  }

  const assets: FlowAssetEntry[] = flow
    ? collectFlowAssets(flow.flow_posts as Parameters<typeof collectFlowAssets>[0])
    : []

  const hasApproved =
    flow &&
    flow.flow_posts.length > 0 &&
    flow.flow_posts.some((p) => p.status === 'approved')

  async function regenerateSegment(postId: string) {
    if (!flowId) return
    setQueueBusy(true)
    setQueueLog(null)
    try {
      await fetch(`/api/admin/flows/${flowId}/posts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, status: 'pending', generated_media_id: null, generation_metadata: null }),
      })
      const res = await fetch(`/api/admin/flows/${flowId}/queue/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSteps: 1 }),
      })
      const j = await res.json()
      if (!res.ok) {
        setQueueLog(j.error || 'Regeneration failed')
      } else {
        setQueueLog('Regenerated segment.')
      }
      await refresh()
    } finally {
      setQueueBusy(false)
    }
  }

  function openQueuePanel() {
    if (!flow) return
    const approvedMediaIds = flow.flow_posts
      .filter((p) => p.status === 'approved' && p.generated_media?.id)
      .map((p) => p.generated_media!.id)
    setQueueSelectedMedia(approvedMediaIds)
    setQueueCaption(flow.title || '')
    setQueueSuccess(false)
    setShowQueuePanel(true)
  }

  async function addToQueue() {
    if (!flowId || queueSelectedMedia.length === 0) return
    setQueueAdding(true)
    try {
      const posts = queueSelectedMedia.map((mediaId, i) => ({
        flow_id: flowId,
        media_ids: [mediaId],
        platforms: queuePlatforms,
        caption: queueCaption,
        scheduled_at: new Date(queueDate).toISOString(),
        sort_order: i,
      }))
      const res = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posts),
      })
      if (res.ok) {
        setQueueSuccess(true)
        setTimeout(() => {
          setShowQueuePanel(false)
          setQueueSuccess(false)
        }, 2000)
      }
    } finally {
      setQueueAdding(false)
    }
  }

  async function copyFlowId() {
    if (!flow?.id) return
    await navigator.clipboard.writeText(flow.id)
    setIdCopied(true)
    setTimeout(() => setIdCopied(false), 2000)
  }

  async function deleteThisFlow() {
    if (!flowId) return
    setDeleteBusy(true)
    try {
      const res = await fetch(`/api/admin/flows/${flowId}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setQueueLog(j.error || 'Delete failed')
        return
      }
      router.push('/admin/flows')
      router.refresh()
    } finally {
      setDeleteBusy(false)
      setConfirmDeleteFlow(false)
    }
  }

  if (!flowId) {
    return <p className="text-[#888] text-sm">Invalid flow id.</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/flows"
          className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All flows
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[#888] text-sm py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {flow && !loading && (
        <>
          <header className="space-y-3">
            <div className="flex items-start gap-3">
              <Layers className="w-8 h-8 text-[#9B30FF] shrink-0 mt-1" />
              <div className="min-w-0 flex-1">
                <h1 className="font-condensed text-2xl font-bold uppercase tracking-wider text-white">
                  {flow.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#666]">
                  <span className="uppercase tracking-wide">Flow id</span>
                  <code className="text-[#A0A0A0] bg-[#1A1A1A] px-2 py-0.5 rounded">{shortId(flow.id)}</code>
                  <button
                    type="button"
                    onClick={copyFlowId}
                    className="inline-flex items-center gap-1 text-[#9B30FF] hover:text-[#BF5FFF]"
                  >
                    {idCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {idCopied ? 'Copied full id' : 'Copy full id'}
                  </button>
                  <span className="text-[#444]">|</span>
                  <span className="capitalize">status: {flow.status}</span>
                </div>
                {flow.concept && (
                  <p className="text-sm text-[#888] mt-3 leading-relaxed max-w-3xl">{flow.concept}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={queueBusy}
                onClick={() => runQueue(1)}
                className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-4 py-2 text-sm hover:bg-[#9B30FF] hover:text-white transition-colors disabled:opacity-40"
              >
                {queueBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run queue (1 step)
              </button>
              <button
                type="button"
                disabled={queueBusy}
                onClick={() => runQueue(20)}
                className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#A0A0A0] hover:border-[#9B30FF] hover:text-[#9B30FF] transition-colors disabled:opacity-40"
              >
                Run batch (20 jobs)
              </button>
              <button
                type="button"
                disabled={queueBusy}
                onClick={resetStuck}
                className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#A0A0A0] hover:border-[#E87511] hover:text-[#E87511] transition-colors disabled:opacity-40"
              >
                <RefreshCw className="w-4 h-4" />
                Reset stuck
              </button>
              <Link
                href="/admin/studio"
                className="inline-flex items-center gap-2 rounded-full border border-[#9B30FF]/30 px-4 py-2 text-sm text-[#BF5FFF] hover:bg-[#9B30FF]/10"
              >
                Studio
              </Link>
              {hasApproved && (
                <button
                  type="button"
                  onClick={() => showQueuePanel ? setShowQueuePanel(false) : openQueuePanel()}
                  className={`inline-flex items-center gap-2 rounded-full font-semibold px-4 py-2 text-sm transition-colors ${
                    showQueuePanel
                      ? 'bg-[#4A7C0F]/20 text-[#4A7C0F] border border-[#4A7C0F]/40'
                      : 'bg-[#4A7C0F] text-white hover:bg-[#5A9C1F]'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  {showQueuePanel ? 'Close Queue Panel' : 'Add to Posting Queue'}
                </button>
              )}
              <button
                type="button"
                disabled={queueBusy || deleteBusy}
                onClick={() => setConfirmDeleteFlow(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[#FF0040]/35 px-4 py-2 text-sm text-[#FF6B8A] hover:bg-[#FF0040]/10 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
                Delete flow
              </button>
            </div>
            {showQueuePanel && flow && (
              <div className="rounded-2xl border border-[#4A7C0F]/30 bg-[#0F1A0A] px-5 py-4 space-y-4 max-w-2xl">
                {queueSuccess ? (
                  <div className="flex items-center gap-2 text-[#4A7C0F] text-sm font-medium py-2">
                    <Check className="w-5 h-5" />
                    Added to posting queue!
                    <Link href="/admin/schedule" className="text-[#9B30FF] hover:text-[#BF5FFF] ml-2 underline">
                      View queue
                    </Link>
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-white">Add approved assets to posting queue</h3>

                    <div>
                      <label className="text-xs text-[#888] block mb-1.5">Select media</label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {flow.flow_posts
                          .filter((p) => p.generated_media?.id)
                          .map((p) => {
                            const m = p.generated_media!
                            const selected = queueSelectedMedia.includes(m.id)
                            const isApproved = p.status === 'approved'
                            const isVideo = m.file_type === 'video'
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() =>
                                  setQueueSelectedMedia(
                                    selected
                                      ? queueSelectedMedia.filter((id) => id !== m.id)
                                      : [...queueSelectedMedia, m.id]
                                  )
                                }
                                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                                  selected
                                    ? 'border-[#4A7C0F] ring-2 ring-[#4A7C0F]/30'
                                    : 'border-[#2A2A2A] hover:border-[#444]'
                                } ${!isApproved ? 'opacity-40' : ''}`}
                                title={`Segment ${p.sort_order + 1} — ${p.status}`}
                              >
                                {isVideo ? (
                                  <video src={m.url} preload="metadata" className="w-full aspect-square object-cover" />
                                ) : (
                                  <img src={m.url} alt="" className="w-full aspect-square object-cover" />
                                )}
                                {selected && (
                                  <div className="absolute top-1 right-1 bg-[#4A7C0F] rounded-full p-0.5">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                                <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-white px-1 py-0.5 text-center truncate">
                                  #{p.sort_order + 1} {p.status}
                                </span>
                              </button>
                            )
                          })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[#888] block mb-1.5">Platforms</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {PLATFORMS.map((p) => {
                            const active = queuePlatforms.includes(p.id)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  setQueuePlatforms(
                                    active
                                      ? queuePlatforms.filter((id) => id !== p.id)
                                      : [...queuePlatforms, p.id]
                                  )
                                }
                                className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                                  active
                                    ? 'border-[#4A7C0F] text-[#4A7C0F] bg-[#4A7C0F]/10'
                                    : 'border-[#2A2A2A] text-[#888] hover:border-[#444]'
                                }`}
                              >
                                {p.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-[#888] block mb-1.5">Schedule for</label>
                        <input
                          type="datetime-local"
                          value={queueDate}
                          onChange={(e) => setQueueDate(e.target.value)}
                          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4A7C0F]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[#888] block mb-1.5">Caption</label>
                      <textarea
                        value={queueCaption}
                        onChange={(e) => setQueueCaption(e.target.value)}
                        rows={2}
                        className="w-full text-sm text-white bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 resize-y focus:outline-none focus:border-[#4A7C0F]"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={queueAdding || queueSelectedMedia.length === 0}
                        onClick={addToQueue}
                        className="inline-flex items-center gap-2 rounded-full bg-[#4A7C0F] text-white font-semibold px-5 py-2 text-sm hover:bg-[#5A9C1F] transition-colors disabled:opacity-40"
                      >
                        {queueAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                        Add {queueSelectedMedia.length} post{queueSelectedMedia.length !== 1 ? 's' : ''} to queue
                      </button>
                      <span className="text-[11px] text-[#666]">
                        {queueSelectedMedia.length} of {flow.flow_posts.filter((p) => p.generated_media?.id).length} selected
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
            {confirmDeleteFlow && (
              <div
                role="dialog"
                aria-labelledby="delete-flow-title"
                className="rounded-2xl border border-[#FF0040]/35 bg-[#1A0A0A] px-4 py-3 space-y-3 max-w-lg"
              >
                <p id="delete-flow-title" className="text-sm text-[#FFB3C0]">
                  Delete this flow and all segments? Media files remain in S3; only database rows for the flow and line
                  items are removed.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => deleteThisFlow()}
                    className="rounded-full bg-[#FF0040] text-white font-medium px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40"
                  >
                    {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Delete forever
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => setConfirmDeleteFlow(false)}
                    className="rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#A0A0A0] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-[#666] max-w-2xl">
              Segments always run in order (by line number): each job finishes (Fal + S3) before the next starts, so chained
              references always see the previous output. On the Flows list, many flows can run at once; each flow still
              respects this order.
            </p>
            {queueLog && (
              <p className="text-xs text-[#A0A0A0] bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 whitespace-pre-wrap">
                {queueLog}
              </p>
            )}
            <p className="text-[11px] text-[#555] max-w-2xl">
              Each successful segment logs <span className="text-[#888]">fal_request=…</span> from Fal&apos;s API. The same
              id is stored on the segment as generation metadata; use it in the Fal dashboard request history if needed.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Segments</h2>
            <div className="border border-[#2A2A2A] rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-[#141414] text-left text-[#888]">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Segment id</th>
                    <th className="px-3 py-2 font-medium">Concept</th>
                    <th className="px-3 py-2 font-medium">Prompt</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                    <th className="px-3 py-2 font-medium min-w-[140px]">Fal request</th>
                    <th className="px-3 py-2 font-medium">Output</th>
                  </tr>
                </thead>
                <tbody>
                  {flow.flow_posts.map((p) => {
                    const falRid =
                      p.generation_metadata &&
                      typeof p.generation_metadata === 'object' &&
                      'request_id' in p.generation_metadata &&
                      typeof (p.generation_metadata as { request_id?: unknown }).request_id === 'string'
                        ? (p.generation_metadata as { request_id: string }).request_id
                        : null
                    return (
                    <tr key={p.id} className="border-t border-[#2A2A2A]">
                      <td className="px-3 py-2 text-[#A0A0A0]">{p.sort_order + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <code className="text-[11px] text-[#888]">{shortId(p.id)}</code>
                          <CopyIdButton id={p.id} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-white max-w-[200px] truncate" title={p.concept}>
                        {p.concept}
                      </td>
                      <td className="px-3 py-2 max-w-[320px]">
                        <EditablePrompt
                          postId={p.id}
                          flowId={flowId}
                          prompt={p.prompt}
                          onSaved={refresh}
                        />
                      </td>
                      <td className="px-3 py-2 text-[#A0A0A0] capitalize">{p.generation_mode}</td>
                      <td className="px-3 py-2 text-[11px] text-[#888]" title={p.fal_model || ''}>
                        {p.fal_model ? p.fal_model.replace('fal-ai/', '') : '—'}
                      </td>
                      <td className="px-3 py-2 text-[#A0A0A0] capitalize">{p.status}</td>
                      <td className="px-3 py-2">
                        <SegmentActions
                          post={p}
                          flowId={flowId}
                          busy={queueBusy}
                          onUpdate={refresh}
                          onRegenerate={() => regenerateSegment(p.id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {falRid ? (
                          <div className="flex flex-col gap-1">
                            <code className="text-[10px] text-[#666] break-all max-w-[200px]" title={falRid}>
                              {shortId(falRid)}
                            </code>
                            <CopyIdButton id={falRid} label="Fal req" />
                          </div>
                        ) : (
                          <span className="text-[#555] text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.generated_media?.url ? (
                          <div className="flex flex-col gap-1.5">
                            {p.generated_media.file_type === 'video' ? (
                              <video
                                src={p.generated_media.url}
                                controls
                                preload="metadata"
                                className="rounded-lg border border-[#2A2A2A] w-[180px] max-h-[120px] bg-black"
                              />
                            ) : (
                              <a href={p.generated_media.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={p.generated_media.url}
                                  alt={p.concept}
                                  className="rounded-lg border border-[#2A2A2A] w-[180px] max-h-[120px] object-cover hover:border-[#9B30FF]/50 transition-colors"
                                />
                              </a>
                            )}
                            <CopyUrlButton url={p.generated_media.url} />
                          </div>
                        ) : (
                          <span className="text-[#555]">—</span>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#666]">
              Copy id stores the full segment UUID. Asset URLs (below) are for reuse in Fal, editors, or other flows.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">All assets</h2>
            <p className="text-sm text-[#888] max-w-2xl">
              Every reference and generated file tied to this flow.
            </p>
            {assets.length === 0 ? (
              <p className="text-sm text-[#666] py-8 text-center border border-dashed border-[#2A2A2A] rounded-2xl">
                No asset URLs yet. Run the queue or add references in Studio.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((a) => {
                  const isVideo = /\.(mp4|mov|webm)$/i.test(a.url)
                  return (
                    <div
                      key={`${a.url}-${a.kind}`}
                      className="rounded-2xl bg-[#141414] border border-[#2A2A2A] overflow-hidden"
                    >
                      <div className="relative bg-black">
                        {isVideo ? (
                          <video
                            src={a.url}
                            controls
                            preload="metadata"
                            className="w-full aspect-video object-contain"
                          />
                        ) : (
                          <a href={a.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={a.url}
                              alt={a.label}
                              className="w-full aspect-video object-contain hover:opacity-90 transition-opacity"
                            />
                          </a>
                        )}
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-[#9B30FF] font-medium capitalize">{a.kind.replace(/_/g, ' ')}</span>
                          <CopyUrlButton url={a.url} />
                        </div>
                        <p className="text-xs text-[#888] leading-snug">{a.label}</p>
                        <p className="text-[10px] text-[#555] break-all font-mono">{a.url}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
