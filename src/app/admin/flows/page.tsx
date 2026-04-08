'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Layers, Loader2, ChevronRight, Trash2, Moon } from 'lucide-react'

interface FlowListItem {
  id: string
  title: string
  status: string
  created_at: string
  flow_posts?: { id: string; status: string }[]
}

function shortId(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

export default function AdminFlowsPage() {
  const [flows, setFlows] = useState<FlowListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /** When set, show delete confirmation for exactly these flow ids (independent of checkbox selection). */
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionLog, setActionLog] = useState<string | null>(null)

  const loadFlows = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/admin/flows')
    if (!res.ok) {
      setError('Could not load flows')
      return
    }
    const data = await res.json()
    setFlows(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadFlows().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadFlows])

  const allSelected = useMemo(() => {
    if (flows.length === 0) return false
    return flows.every((f) => selected.has(f.id))
  }, [flows, selected])

  const someSelected = selected.size > 0

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(flows.map((f) => f.id)))
    }
  }

  async function deleteByIds(ids: string[]) {
    if (ids.length === 0) return
    setActionBusy(true)
    setActionLog(null)
    try {
      const res = await fetch('/api/admin/flows/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const j = await res.json()
      if (!res.ok) {
        setActionLog(j.error || 'Delete failed')
        return
      }
      setSelected((prev) => {
        const n = new Set(prev)
        ids.forEach((id) => n.delete(id))
        return n
      })
      await loadFlows()
      setActionLog(`Deleted ${j.deletedCount ?? ids.length} flow(s) and their segments.`)
    } finally {
      setActionBusy(false)
      setConfirmDeleteIds(null)
    }
  }

  async function confirmDelete() {
    if (confirmDeleteIds?.length) await deleteByIds(confirmDeleteIds)
  }

  /**
   * For each selected flow, run queue in chunks until complete, blocked, or error.
   * One flow at a time so Fal stays predictable overnight.
   */
  async function runQueueOnSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    setActionBusy(true)
    setActionLog('Starting…')
    try {
      const lines: string[] = []
      for (let i = 0; i < ids.length; i++) {
        const fid = ids[i]
        lines.push(`Flow ${i + 1}/${ids.length} ${shortId(fid)}`)
        setActionLog(lines.join('\n'))

        let iterations = 0
        while (iterations < 500) {
          iterations += 1
          const res = await fetch(`/api/admin/flows/${fid}/queue/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxSteps: 40 }),
          })
          const j = await res.json()
          if (!res.ok) {
            lines.push(`  error: ${j.error || res.statusText}`)
            break
          }
          if (j.flowComplete) {
            lines.push('  done (complete).')
            break
          }
          const steps = j.steps || []
          const blocked = steps.find((s: { kind: string }) => s.kind === 'blocked') as
            | { kind: 'blocked'; message?: string }
            | undefined
          if (blocked) {
            lines.push(`  paused: ${blocked.message || 'blocked'}`)
            break
          }
          const failed = steps.find(
            (s: { kind: string; error?: string }) => s.kind === 'ran' && s.error
          ) as { error?: string } | undefined
          if (failed?.error) {
            lines.push(`  error: ${failed.error}`)
            break
          }
          const last = steps[steps.length - 1]
          if (last?.kind === 'idle') {
            lines.push('  done.')
            break
          }
          if (steps.length === 0) {
            lines.push('  no steps returned; stopping.')
            break
          }
        }
        if (iterations >= 500) {
          lines.push('  stopped: max iterations (safety).')
        }
        setActionLog(lines.join('\n'))
      }
      lines.push('Finished run.')
      setActionLog(lines.join('\n'))
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Layers className="w-7 h-7 text-[#9B30FF]" />
            Flows
          </h1>
          <p className="text-sm text-[#888] mt-2 max-w-xl">
            Select flows, delete in bulk (segments cascade), or run queues sequentially for overnight runs. Open a flow for
            single-flow controls and asset URLs.
          </p>
        </div>
        <Link
          href="/admin/studio"
          className="shrink-0 rounded-full border border-[#9B30FF]/40 bg-[#9B30FF]/10 px-4 py-2 text-sm font-medium text-[#BF5FFF] hover:bg-[#9B30FF]/20 transition-colors"
        >
          New in Studio
        </Link>
      </div>

      {!loading && flows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={actionBusy || !someSelected}
            onClick={runQueueOnSelected}
            className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-4 py-2 text-sm hover:bg-[#9B30FF] hover:text-white transition-colors disabled:opacity-40"
          >
            {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Moon className="w-4 h-4" />}
            Run queue on selected
          </button>
          <span className="text-[11px] text-[#666] max-w-xs">
            Each request runs up to 40 segment jobs with parallel waves where dependencies allow. Flows run one after another.
          </span>
          <button
            type="button"
            disabled={actionBusy || !someSelected}
            onClick={() => setConfirmDeleteIds([...selected])}
            className="inline-flex items-center gap-2 rounded-full border border-[#FF0040]/40 text-[#FF6B8A] px-4 py-2 text-sm hover:bg-[#FF0040]/10 transition-colors disabled:opacity-40 ml-auto sm:ml-0"
          >
            <Trash2 className="w-4 h-4" />
            Delete selected ({selected.size})
          </button>
        </div>
      )}

      {confirmDeleteIds && confirmDeleteIds.length > 0 && (
        <div
          role="dialog"
          aria-labelledby="bulk-delete-title"
          className="rounded-2xl border border-[#FF0040]/35 bg-[#1A0A0A] px-4 py-3 space-y-3 max-w-lg"
        >
          <p id="bulk-delete-title" className="text-sm text-[#FFB3C0]">
            Delete {confirmDeleteIds.length} flow{confirmDeleteIds.length === 1 ? '' : 's'} and all associated segments?
            Generated media files stay in S3; only flow and segment records are removed.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => confirmDelete()}
              className="rounded-full bg-[#FF0040] text-white font-medium px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40"
            >
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Delete forever
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setConfirmDeleteIds(null)}
              className="rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#A0A0A0] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {actionLog && (
        <pre className="text-[11px] text-[#A0A0A0] bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
          {actionLog}
        </pre>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[#888] text-sm py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading flows…
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && flows.length === 0 && (
        <p className="text-sm text-[#666] py-12 text-center border border-dashed border-[#2A2A2A] rounded-2xl">
          No flows yet. Create one from Studio.
        </p>
      )}

      {!loading && flows.length > 0 && (
        <div className="border border-[#2A2A2A] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#141414] text-left text-[#888]">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-[#444] bg-[#0A0A0A] text-[#9B30FF] focus:ring-[#9B30FF]"
                    title="Select all"
                  />
                </th>
                <th className="px-2 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Segments</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-2 py-3 w-24 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => {
                const n = f.flow_posts?.length ?? 0
                const isSel = selected.has(f.id)
                return (
                  <tr key={f.id} className="border-t border-[#2A2A2A] hover:bg-[#141414]/80">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(f.id)}
                        className="rounded border-[#444] bg-[#0A0A0A] text-[#9B30FF] focus:ring-[#9B30FF]"
                        aria-label={`Select ${f.title}`}
                      />
                    </td>
                    <td className="px-2 py-3 text-white font-medium">
                      <Link href={`/admin/flows/${f.id}`} className="hover:text-[#9B30FF] hover:underline">
                        {f.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#A0A0A0] capitalize">{f.status}</td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{n}</td>
                    <td className="px-4 py-3 text-[#666]">
                      {f.created_at ? new Date(f.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/flows/${f.id}`}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#9B30FF] hover:bg-[#9B30FF]/10"
                          title="Open flow"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => setConfirmDeleteIds([f.id])}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#888] hover:text-[#FF0040] hover:bg-[#FF0040]/10 disabled:opacity-40"
                          title="Delete flow"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
