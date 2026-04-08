'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  GripVertical,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Send,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import { PLATFORMS, PLATFORMS_MAP } from '@/lib/constants/platforms'

interface FlowMedia {
  id: string
  filename: string
  url: string
  file_type: string
}

interface ScheduledPost {
  id: string
  flow_id: string
  media_ids: string[]
  platforms: string[]
  caption: string | null
  hashtags: string[]
  scheduled_at: string
  status: string
  posted_at: string | null
  publish_result: unknown
  sort_order: number
  flow?: { id: string; title: string; concept: string | null; status: string } | null
  flow_media?: FlowMedia[]
}

interface ApprovedFlow {
  id: string
  title: string
  concept: string | null
  flow_posts: { id: string; status: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  publishing: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  posted: 'text-[#4A7C0F] bg-[#4A7C0F]/10 border-[#4A7C0F]/30',
  failed: 'text-[#FF0040] bg-[#FF0040]/10 border-[#FF0040]/30',
  cancelled: 'text-[#888] bg-[#888]/10 border-[#888]/30',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function PlatformBadge({ platformId }: { platformId: string }) {
  const p = PLATFORMS_MAP[platformId]
  if (!p) return <span className="text-[10px] text-[#888]">{platformId}</span>
  const Icon = p.icon
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 border"
      style={{ color: p.color, borderColor: `${p.color}40`, backgroundColor: `${p.color}10` }}
    >
      <Icon className="w-3 h-3" />
      {p.name}
    </span>
  )
}

function AssetPicker({
  allMedia,
  selectedIds,
  onChange,
}: {
  allMedia: FlowMedia[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  if (allMedia.length === 0) {
    return <p className="text-xs text-[#666]">No media available</p>
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {allMedia.map((m) => {
        const selected = selectedIds.includes(m.id)
        const isVideo = /\.(mp4|mov|webm)$/i.test(m.url) || m.file_type === 'video'
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              onChange(
                selected
                  ? selectedIds.filter((id) => id !== m.id)
                  : [...selectedIds, m.id]
              )
            }}
            className={`relative rounded-xl overflow-hidden border-2 transition-all ${
              selected
                ? 'border-[#9B30FF] ring-2 ring-[#9B30FF]/30'
                : 'border-[#2A2A2A] hover:border-[#444]'
            }`}
          >
            {isVideo ? (
              <video
                src={m.url}
                preload="metadata"
                className="w-full aspect-square object-cover"
              />
            ) : (
              <img src={m.url} alt={m.filename} className="w-full aspect-square object-cover" />
            )}
            {selected && (
              <div className="absolute top-1 right-1 bg-[#9B30FF] rounded-full p-0.5">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white px-1 py-0.5 truncate">
              {m.file_type}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ScheduleCard({
  post,
  onUpdate,
  onDelete,
  onPublish,
  dragHandlers,
  isDragOver,
}: {
  post: ScheduledPost
  onUpdate: (id: string, data: Partial<ScheduledPost>) => void
  onDelete: (id: string) => void
  onPublish: (id: string) => void
  dragHandlers: {
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
  isDragOver: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [editCaption, setEditCaption] = useState(false)
  const [captionValue, setCaptionValue] = useState(post.caption || '')
  const [editDate, setEditDate] = useState(false)
  const [dateValue, setDateValue] = useState(
    post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ''
  )
  const [busy, setBusy] = useState(false)
  const [editPlatforms, setEditPlatforms] = useState(false)

  const statusClass = STATUS_COLORS[post.status] || STATUS_COLORS.scheduled

  function saveCaption() {
    onUpdate(post.id, { caption: captionValue })
    setEditCaption(false)
  }

  function saveDate() {
    onUpdate(post.id, { scheduled_at: new Date(dateValue).toISOString() })
    setEditDate(false)
  }

  function togglePlatform(pid: string) {
    const current = post.platforms || []
    const next = current.includes(pid)
      ? current.filter((p) => p !== pid)
      : [...current, pid]
    onUpdate(post.id, { platforms: next })
    setEditPlatforms(false)
  }

  return (
    <div
      draggable
      {...dragHandlers}
      className={`rounded-2xl border transition-all ${
        isDragOver
          ? 'border-[#9B30FF] bg-[#9B30FF]/5'
          : 'border-[#2A2A2A] bg-[#141414] hover:border-[#333]'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="cursor-grab active:cursor-grabbing text-[#555] hover:text-[#888] mt-1">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/flows/${post.flow_id}`}
              className="text-sm font-medium text-white hover:text-[#9B30FF] transition-colors truncate max-w-[200px]"
            >
              {post.flow?.title || 'Untitled'}
            </Link>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${statusClass}`}>
              {post.status}
            </span>
          </div>

          {/* Media thumbnails */}
          {post.flow_media && post.flow_media.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {post.flow_media
                .filter((m) => (post.media_ids || []).includes(m.id))
                .map((m) => {
                  const isVideo = m.file_type === 'video'
                  return (
                    <div key={m.id} className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-[#2A2A2A]">
                      {isVideo ? (
                        <video src={m.url} preload="metadata" className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )
                })}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {(post.platforms || []).map((pid) => (
              <PlatformBadge key={pid} platformId={pid} />
            ))}
            <button
              type="button"
              onClick={() => setEditPlatforms(!editPlatforms)}
              className="text-[10px] text-[#888] hover:text-[#9B30FF] transition-colors"
            >
              <Pencil className="w-3 h-3 inline" />
            </button>
          </div>

          {editPlatforms && (
            <div className="flex gap-1.5 flex-wrap">
              {PLATFORMS.map((p) => {
                const active = (post.platforms || []).includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`text-[10px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
                      active
                        ? 'border-[#9B30FF] text-[#9B30FF] bg-[#9B30FF]/10'
                        : 'border-[#2A2A2A] text-[#888] hover:border-[#444]'
                    }`}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-[#888]">
            <Clock className="w-3.5 h-3.5" />
            {editDate ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="datetime-local"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#9B30FF]"
                />
                <button type="button" onClick={saveDate} className="text-[#9B30FF] hover:text-[#BF5FFF]">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setEditDate(false)} className="text-[#888] hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditDate(true)}
                className="hover:text-white transition-colors"
              >
                {formatDateTime(post.scheduled_at)}
              </button>
            )}
          </div>

          {editCaption ? (
            <div className="space-y-1.5">
              <textarea
                value={captionValue}
                onChange={(e) => setCaptionValue(e.target.value)}
                rows={3}
                className="w-full text-[11px] text-white bg-[#0A0A0A] border border-[#9B30FF]/50 rounded-lg p-2 resize-y focus:outline-none focus:border-[#9B30FF]"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={saveCaption}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#9B30FF] px-2 py-0.5 text-[10px] text-white font-medium hover:bg-[#BF5FFF]"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditCaption(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A2A] px-2 py-0.5 text-[10px] text-[#888] hover:text-white"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              className="text-xs text-[#A0A0A0] line-clamp-2 cursor-pointer hover:text-white transition-colors"
              onClick={() => {
                setCaptionValue(post.caption || '')
                setEditCaption(true)
              }}
            >
              {post.caption || 'No caption'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-[#888] hover:text-white hover:bg-[#1A1A1A] transition-colors"
            title="Expand"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {post.status === 'scheduled' && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onPublish(post.id)
                setBusy(false)
              }}
              className="p-1.5 rounded-lg text-[#4A7C0F] hover:bg-[#4A7C0F]/10 transition-colors disabled:opacity-40"
              title="Post Now"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(post.id)}
            className="p-1.5 rounded-lg text-[#FF0040] hover:bg-[#FF0040]/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#2A2A2A] p-4 space-y-3">
          <h4 className="text-xs font-medium text-[#888] uppercase tracking-wide">Select assets</h4>
          <AssetPicker
            allMedia={post.flow_media || []}
            selectedIds={post.media_ids || []}
            onChange={(ids) => onUpdate(post.id, { media_ids: ids })}
          />

          {post.publish_result && (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-[#888] uppercase tracking-wide mb-1">Publish results</h4>
              <pre className="text-[10px] text-[#A0A0A0] bg-[#0A0A0A] rounded-lg p-2 overflow-x-auto">
                {JSON.stringify(post.publish_result, null, 2)}
              </pre>
            </div>
          )}

          {post.flow_media && post.flow_media.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {post.flow_media
                .filter((m) => (post.media_ids || []).includes(m.id))
                .map((m) => (
                  <a
                    key={m.id}
                    href={m.url}
                    download
                    className="inline-flex items-center gap-1 text-[10px] text-[#9B30FF] hover:text-[#BF5FFF] transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    {m.filename || m.file_type}
                  </a>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminSchedulePage() {
  const searchParams = useSearchParams()
  const addFlowId = searchParams.get('add_flow')

  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showBatch, setShowBatch] = useState(false)
  const [approvedFlows, setApprovedFlows] = useState<ApprovedFlow[]>([])
  const [loadingFlows, setLoadingFlows] = useState(false)

  // Batch scheduling state
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>(addFlowId ? [addFlowId] : [])
  const [batchPlatforms, setBatchPlatforms] = useState<string[]>(['instagram', 'facebook'])
  const [batchStart, setBatchStart] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  )
  const [batchInterval, setBatchInterval] = useState(24)
  const [batchCaption, setBatchCaption] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)

  const [showCadence, setShowCadence] = useState(false)
  const [cadenceStart, setCadenceStart] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  )
  const [cadenceInterval, setCadenceInterval] = useState(24)
  const [cadenceBusy, setCadenceBusy] = useState(false)

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/schedule')
    if (res.ok) {
      const data = await res.json()
      setPosts(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (addFlowId) {
      setShowBatch(true)
      loadApprovedFlows()
    }
  }, [addFlowId])

  async function loadApprovedFlows() {
    setLoadingFlows(true)
    const res = await fetch('/api/admin/flows')
    if (res.ok) {
      const data = await res.json()
      const approved = (data as ApprovedFlow[]).filter((f) =>
        f.flow_posts.length > 0 && f.flow_posts.some((p) => p.status === 'approved')
      )
      setApprovedFlows(approved)
    }
    setLoadingFlows(false)
  }

  async function updatePost(id: string, data: Partial<ScheduledPost>) {
    await fetch('/api/admin/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    refresh()
  }

  async function deletePost(id: string) {
    await fetch(`/api/admin/schedule?id=${id}`, { method: 'DELETE' })
    refresh()
  }

  async function publishNow(id: string) {
    await fetch(`/api/admin/schedule/${id}/publish`, { method: 'POST' })
    refresh()
  }

  async function submitBatch() {
    if (selectedFlowIds.length === 0) return
    setBatchBusy(true)
    try {
      await fetch('/api/admin/schedule/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow_ids: selectedFlowIds,
          platforms: batchPlatforms,
          cadence: {
            start: new Date(batchStart).toISOString(),
            interval_hours: batchInterval,
          },
          caption_template: batchCaption || undefined,
        }),
      })
      setShowBatch(false)
      setSelectedFlowIds([])
      refresh()
    } finally {
      setBatchBusy(false)
    }
  }

  function handleDragStart(idx: number) {
    return (e: React.DragEvent) => {
      setDragIdx(idx)
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  function handleDragOver(idx: number) {
    return (e: React.DragEvent) => {
      e.preventDefault()
      setOverIdx(idx)
    }
  }

  function handleDrop(idx: number) {
    return (e: React.DragEvent) => {
      e.preventDefault()
      if (dragIdx === null || dragIdx === idx) {
        setDragIdx(null)
        setOverIdx(null)
        return
      }
      const reordered = [...posts]
      const [moved] = reordered.splice(dragIdx, 1)
      reordered.splice(idx, 0, moved)

      const updates = reordered.map((p, i) => ({ id: p.id, sort_order: i }))
      setPosts(reordered)
      setDragIdx(null)
      setOverIdx(null)

      fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    }
  }

  function handleDragEnd() {
    setDragIdx(null)
    setOverIdx(null)
  }

  async function applyCadence() {
    if (scheduled.length === 0) return
    setCadenceBusy(true)
    try {
      const startMs = new Date(cadenceStart).getTime()
      const intervalMs = cadenceInterval * 60 * 60 * 1000
      const updates = scheduled.map((p, i) => ({
        id: p.id,
        scheduled_at: new Date(startMs + i * intervalMs).toISOString(),
      }))
      await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      await refresh()
    } finally {
      setCadenceBusy(false)
    }
  }

  const scheduled = posts.filter((p) => p.status === 'scheduled')
  const past = posts.filter((p) => p.status !== 'scheduled')

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-[var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white">
            Posting Queue
          </h1>
          <p className="text-sm text-[#888] mt-1">
            Schedule, order, and publish content across platforms.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowBatch(!showBatch)
              if (!showBatch && approvedFlows.length === 0) loadApprovedFlows()
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[#9B30FF] text-white font-semibold px-4 py-2 text-sm hover:bg-[#BF5FFF] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Batch Schedule
          </button>
        </div>
      </header>

      {showBatch && (
        <section className="rounded-2xl border border-[#9B30FF]/30 bg-[#141414] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Batch Schedule Approved Flows</h2>
            <button
              type="button"
              onClick={() => setShowBatch(false)}
              className="text-[#888] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingFlows ? (
            <div className="flex items-center gap-2 text-[#888] text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading approved flows...
            </div>
          ) : approvedFlows.length === 0 ? (
            <p className="text-sm text-[#888] py-4">
              No fully-approved flows found. Approve all segments in a flow first.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#888] block mb-1.5">Select flows to schedule</label>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {approvedFlows.map((f) => {
                    const selected = selectedFlowIds.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setSelectedFlowIds(
                            selected
                              ? selectedFlowIds.filter((id) => id !== f.id)
                              : [...selectedFlowIds, f.id]
                          )
                        }
                        className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                          selected
                            ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-white'
                            : 'border-[#2A2A2A] text-[#A0A0A0] hover:border-[#444]'
                        }`}
                      >
                        <Layers className="w-4 h-4 shrink-0" />
                        <span className="truncate">{f.title || 'Untitled flow'}</span>
                        {selected && <Check className="w-4 h-4 text-[#9B30FF] ml-auto shrink-0" />}
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
                      const active = batchPlatforms.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setBatchPlatforms(
                              active
                                ? batchPlatforms.filter((id) => id !== p.id)
                                : [...batchPlatforms, p.id]
                            )
                          }
                          className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                            active
                              ? 'border-[#9B30FF] text-[#9B30FF] bg-[#9B30FF]/10'
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
                  <label className="text-xs text-[#888] block mb-1.5">Start date & time</label>
                  <input
                    type="datetime-local"
                    value={batchStart}
                    onChange={(e) => setBatchStart(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9B30FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#888] block mb-1.5">Post every (hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={batchInterval}
                    onChange={(e) => setBatchInterval(Number(e.target.value))}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9B30FF]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1.5">Caption template (optional)</label>
                  <input
                    type="text"
                    value={batchCaption}
                    onChange={(e) => setBatchCaption(e.target.value)}
                    placeholder="Use {{title}} for flow title"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#9B30FF]"
                  />
                </div>
              </div>

              {selectedFlowIds.length > 0 && (
                <div className="rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] p-3">
                  <p className="text-xs text-[#888] mb-2">Preview: {selectedFlowIds.length} posts</p>
                  {selectedFlowIds.map((fid, i) => {
                    const f = approvedFlows.find((af) => af.id === fid)
                    const date = new Date(
                      new Date(batchStart).getTime() + i * batchInterval * 60 * 60 * 1000
                    )
                    return (
                      <div key={fid} className="flex items-center justify-between text-xs py-1 text-[#A0A0A0]">
                        <span className="truncate max-w-[200px]">{f?.title || fid}</span>
                        <span className="text-[#888]">{formatDateTime(date.toISOString())}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                disabled={selectedFlowIds.length === 0 || batchBusy}
                onClick={submitBatch}
                className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-5 py-2.5 text-sm hover:bg-[#9B30FF] hover:text-white transition-colors disabled:opacity-40"
              >
                {batchBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Schedule {selectedFlowIds.length} post{selectedFlowIds.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[#888] text-sm py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading schedule...
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#9B30FF]" />
                Upcoming ({scheduled.length})
              </h2>
              {scheduled.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCadence(!showCadence)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    showCadence
                      ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                      : 'border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#9B30FF] hover:text-[#9B30FF]'
                  }`}
                >
                  <Timer className="w-4 h-4" />
                  Apply Cadence
                </button>
              )}
            </div>

            {showCadence && scheduled.length > 0 && (
              <div className="rounded-2xl border border-[#9B30FF]/30 bg-[#141414] p-4 space-y-3">
                <p className="text-xs text-[#888]">
                  Set a start date and interval, then apply. Dates will be assigned to all {scheduled.length} scheduled posts in their current drag-and-drop order.
                </p>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="text-xs text-[#888] block mb-1">Start date & time</label>
                    <input
                      type="datetime-local"
                      value={cadenceStart}
                      onChange={(e) => setCadenceStart(e.target.value)}
                      className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9B30FF]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#888] block mb-1">Every (hours)</label>
                    <input
                      type="number"
                      min={1}
                      value={cadenceInterval}
                      onChange={(e) => setCadenceInterval(Number(e.target.value))}
                      className="w-24 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9B30FF]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={cadenceBusy}
                    onClick={applyCadence}
                    className="inline-flex items-center gap-2 rounded-full bg-[#9B30FF] text-white font-semibold px-5 py-2 text-sm hover:bg-[#BF5FFF] transition-colors disabled:opacity-40"
                  >
                    {cadenceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Timer className="w-4 h-4" />}
                    Apply to {scheduled.length} posts
                  </button>
                </div>
                <div className="rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] p-3">
                  <p className="text-[10px] text-[#666] mb-1.5 uppercase tracking-wide">Preview</p>
                  {scheduled.map((p, i) => {
                    const date = new Date(
                      new Date(cadenceStart).getTime() + i * cadenceInterval * 60 * 60 * 1000
                    )
                    return (
                      <div key={p.id} className="flex items-center justify-between text-xs py-0.5 text-[#A0A0A0]">
                        <span className="truncate max-w-[250px]">{p.flow?.title || 'Untitled'}</span>
                        <span className="text-[#888] shrink-0 ml-3">{formatDateTime(date.toISOString())}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {scheduled.length === 0 ? (
              <p className="text-sm text-[#666] py-8 text-center border border-dashed border-[#2A2A2A] rounded-2xl">
                No scheduled posts. Use Batch Schedule to add approved flows.
              </p>
            ) : (
              <div className="space-y-2">
                {scheduled.map((post, idx) => (
                  <ScheduleCard
                    key={post.id}
                    post={post}
                    onUpdate={updatePost}
                    onDelete={deletePost}
                    onPublish={publishNow}
                    isDragOver={overIdx === idx}
                    dragHandlers={{
                      onDragStart: handleDragStart(idx),
                      onDragOver: handleDragOver(idx),
                      onDrop: handleDrop(idx),
                      onDragEnd: handleDragEnd,
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#888]" />
                History ({past.length})
              </h2>
              <div className="space-y-2">
                {past.map((post, idx) => (
                  <ScheduleCard
                    key={post.id}
                    post={post}
                    onUpdate={updatePost}
                    onDelete={deletePost}
                    onPublish={publishNow}
                    isDragOver={false}
                    dragHandlers={{
                      onDragStart: handleDragStart(scheduled.length + idx),
                      onDragOver: handleDragOver(scheduled.length + idx),
                      onDrop: handleDrop(scheduled.length + idx),
                      onDragEnd: handleDragEnd,
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
