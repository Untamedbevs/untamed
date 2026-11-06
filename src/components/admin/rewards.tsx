'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Lock, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ART_OPTIONS, type ArtOption } from '@/lib/rewards/art'

/** Pieces shared by the staff rewards pages: Rewards Program, Hunts and the Hunt review queue. */

export const INPUT_CLASS =
  'w-full rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-[#666] transition-colors focus:border-[#9B30FF] focus:outline-none'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** JSON fetch that throws the API's `{ error }` message on failure. */
export async function requestJson<T = unknown>(url: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(
    url,
    init && {
      method: init.method,
      headers: { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong', res.status)
  return data as T
}

/** Busy and error state around one async action (save, delete, review). */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function Forbidden({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-xl rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 text-sm text-[#A0A0A0]">
      <Lock className="mb-3 h-5 w-5 text-[#9B30FF]" />
      {children}
    </div>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{children}</div>
}

const PILL_TONES = {
  gray: 'border-[#2A2A2A] text-[#A0A0A0]',
  purple: 'border-[#9B30FF]/40 bg-[#9B30FF]/10 text-[#C89BFF]',
  gold: 'border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]/90',
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  red: 'border-red-500/30 bg-red-500/10 text-red-400',
}

export function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: keyof typeof PILL_TONES }) {
  return <span className={cn('rounded-full border px-2 py-0.5 text-[11px]', PILL_TONES[tone])}>{children}</span>
}

/** A labelled text input, select or textarea. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[#A0A0A0]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#666]">{hint}</span>}
    </label>
  )
}

/** Like Field, for controls made of several buttons (a label element would click the first one). */
export function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-[#A0A0A0]">{label}</p>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[#666]">{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-white">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#9B30FF]/60',
          checked ? 'bg-[#9B30FF]' : 'bg-[#2A2A2A]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </span>
      {label}
    </label>
  )
}

export function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[#2A2A2A] bg-[#141414] p-5 sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-headline text-xl text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#A0A0A0] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Save / Cancel, plus Delete when editing (disabled, with the reason, when the row is in use). */
export function EditorActions({
  busy,
  onSave,
  onCancel,
  onDelete,
  deleteBlockedReason,
}: {
  busy: boolean
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  deleteBlockedReason?: string
}) {
  return (
    <div className="space-y-2 border-t border-[#2A2A2A] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy || !!deleteBlockedReason}
            title={deleteBlockedReason}
            className="inline-flex items-center gap-2 rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm text-[#A0A0A0] transition-colors hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-[#9B30FF] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7E22CE] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
      {onDelete && deleteBlockedReason && <p className="text-[11px] text-[#666]">{deleteBlockedReason}</p>}
    </div>
  )
}

const ART_GROUPS =ART_OPTIONS.reduce<[ArtOption['group'], ArtOption[]][]>((groups, art) => {
  const group = groups.find(([name]) => name === art.group)
  if (group) group[1].push(art)
  else groups.push([art.group, [art]])
  return groups
}, [])

/** Visual picker over every art option, grouped like ART_OPTIONS. */
export function ArtPicker({ value, onChange }: { value: string | null; onChange: (key: string) => void }) {
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-3">
      {ART_GROUPS.map(([group, options]) => (
        <div key={group}>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#666]">{group}</p>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
            {options.map((art) => (
              <button
                key={art.key}
                type="button"
                title={art.label}
                aria-label={art.label}
                aria-pressed={value === art.key}
                onClick={() => onChange(art.key)}
                className={cn(
                  'aspect-square rounded-lg border p-1 transition-colors',
                  value === art.key
                    ? 'border-[#FFD700] bg-[#FFD700]/10'
                    : 'border-[#2A2A2A] hover:border-[#9B30FF]/60'
                )}
              >
                <Image src={art.src} alt="" width={48} height={48} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
