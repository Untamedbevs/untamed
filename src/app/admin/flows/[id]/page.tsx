'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Copy,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Link2,
  Trash2,
} from 'lucide-react'
import { collectFlowAssets, type FlowAssetEntry } from '@/lib/flow/collect-assets'

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
                <h1 className="font-[var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white">
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
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Status</th>
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
                      <td className="px-3 py-2 text-[#A0A0A0] capitalize">{p.generation_mode}</td>
                      <td className="px-3 py-2 text-[#A0A0A0] capitalize">{p.status}</td>
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
                          <a
                            href={p.generated_media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00BFFF] hover:underline text-xs inline-flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3" />
                            Open
                          </a>
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
            <h2 className="text-lg font-semibold text-white">All assets (URLs)</h2>
            <p className="text-sm text-[#888] max-w-2xl">
              Every reference and generated file tied to this flow. URLs point at your S3/CDN after generation.
            </p>
            {assets.length === 0 ? (
              <p className="text-sm text-[#666] py-8 text-center border border-dashed border-[#2A2A2A] rounded-2xl">
                No asset URLs yet. Run the queue or add references in Studio.
              </p>
            ) : (
              <ul className="space-y-2">
                {assets.map((a) => (
                  <li
                    key={`${a.url}-${a.kind}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#9B30FF] font-medium capitalize">{a.kind.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-[#888] mt-0.5">{a.label}</div>
                      <div className="text-[11px] text-[#666] mt-1 break-all font-mono">{a.url}</div>
                    </div>
                    <CopyUrlButton url={a.url} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
