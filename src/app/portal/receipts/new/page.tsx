'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle,
  ImageIcon,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import { drinks } from '@/lib/drinks'
import { POINTS } from '@/lib/loyalty/constants'
import {
  getUploadErrorMessage,
  uploadUserFile,
  type UserUploadResult,
} from '@/lib/storage/user-uploads'

interface QueueItem {
  id: string
  file: File
  previewUrl: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  result?: UserUploadResult
}

const MAX_FILES = 10
const MAX_FILE_SIZE_MB = 25
const MAX_QUANTITY_PER_ITEM = 100

export default function NewReceiptPage() {
  const router = useRouter()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(drinks.map((d) => [d.slug, 0]))
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      queue.forEach((q) => URL.revokeObjectURL(q.previewUrl))
    }
  }, [queue])

  function addFiles(filesList: FileList | File[]) {
    const files = Array.from(filesList)
    const remaining = MAX_FILES - queue.length
    const accepted = files.slice(0, remaining)

    const newItems: QueueItem[] = accepted
      .filter((f) => f.type.startsWith('image/'))
      .filter((f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024)
      .map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      }))

    if (newItems.length === 0 && accepted.length > 0) {
      setError(
        `Some files were skipped (only images under ${MAX_FILE_SIZE_MB}MB are accepted).`
      )
    } else {
      setError('')
    }

    setQueue((prev) => [...prev, ...newItems])
  }

  function removeItem(id: string) {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((q) => q.id !== id)
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  async function uploadAll(): Promise<QueueItem[]> {
    const updated: QueueItem[] = []
    for (const item of queue) {
      if (item.status === 'success' && item.result) {
        updated.push(item)
        continue
      }
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: 'uploading', progress: 0, error: undefined }
            : q
        )
      )
      try {
        const result = await uploadUserFile('receipts', item.file, (progress) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress } : q))
          )
        })
        const success: QueueItem = {
          ...item,
          status: 'success',
          progress: 100,
          result,
        }
        updated.push(success)
        setQueue((prev) => prev.map((q) => (q.id === item.id ? success : q)))
      } catch (err) {
        const message = getUploadErrorMessage(err)
        const failed: QueueItem = {
          ...item,
          status: 'error',
          error: message,
        }
        updated.push(failed)
        setQueue((prev) => prev.map((q) => (q.id === item.id ? failed : q)))
        throw new Error(message)
      }
    }
    return updated
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (queue.length === 0) {
      setError('Add at least one receipt photo.')
      return
    }

    setSubmitting(true)

    let uploaded: QueueItem[]
    try {
      uploaded = await uploadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setSubmitting(false)
      return
    }

    const successful = uploaded.filter((u) => u.status === 'success' && u.result)
    if (successful.length === 0) {
      setError('No files uploaded successfully. Please retry.')
      setSubmitting(false)
      return
    }

    try {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([drinkSlug, quantity]) => ({ drinkSlug, quantity }))

      const res = await fetch('/api/portal/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          assets: successful.map((u, i) => ({
            s3Key: u.result!.s3Key,
            url: u.result!.url,
            mimeType: u.file.type || 'application/octet-stream',
            width: u.result!.width,
            height: u.result!.height,
            fileSizeBytes: u.result!.fileSize,
            displayOrder: i,
          })),
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const detail = errBody.details ? ` (${errBody.details})` : ''
        throw new Error(`${errBody.error || 'Submission failed'}${detail}`)
      }

      router.push('/portal/receipts?submitted=1')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  const allUploaded =
    queue.length > 0 && queue.every((q) => q.status === 'success')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl text-white">Upload in-store receipt</h1>
          <p className="text-sm text-[#A0A0A0]">
            Bought Untamed in a store or at an event? Earn {POINTS.PER_RECEIPT}{' '}
            points per pack. Add multiple photos if your purchase spans more than
            one receipt. (Online shop orders are credited automatically.)
          </p>
        </div>
        <Link
          href="/portal/receipts"
          className="text-sm text-[#A0A0A0] hover:text-white"
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          className={`bg-[#141414] border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
            dragOver
              ? 'border-[#9B30FF] bg-[#9B30FF]/5'
              : 'border-[#2A2A2A] hover:border-[#9B30FF]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
          <Receipt className="w-10 h-10 text-[#9B30FF] mx-auto mb-3" />
          <p className="text-white font-medium mb-1">
            Drag & drop or click to add receipt photos
          </p>
          <p className="text-xs text-[#A0A0A0] mb-4">
            Images only · up to {MAX_FILE_SIZE_MB}MB each · {MAX_FILES} max
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors"
          >
            <UploadIcon className="w-4 h-4" />
            Choose photos
          </button>
        </div>

        {queue.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className="relative group bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden aspect-square"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />

                <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  {Math.max(1, Math.round(item.file.size / 1024 / 1024))}MB
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={item.status === 'uploading'}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>

                {item.status === 'uploading' && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5">
                    <div className="flex items-center gap-2 text-xs text-white">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {item.progress}%
                    </div>
                    <div className="h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-[#9B30FF] transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {item.status === 'success' && (
                  <div className="absolute top-1.5 right-9 w-6 h-6 rounded-full bg-[#39FF14] flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-black" />
                  </div>
                )}

                {item.status === 'error' && (
                  <div className="absolute inset-x-0 bottom-0 bg-red-500/90 px-2 py-1 text-[10px] text-white truncate">
                    {item.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-white mb-1">
              What did you buy?
            </h3>
            <p className="text-xs text-[#A0A0A0] mb-4">
              Tell us how many packs of each. We&apos;ll verify against your
              receipts during review.
            </p>
            <div className="space-y-2">
              {drinks.map((d) => (
                <QuantityRow
                  key={d.slug}
                  label={d.name}
                  flavor={d.flavor}
                  color={d.color}
                  quantity={quantities[d.slug] || 0}
                  onChange={(next) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [d.slug]: clamp(next, 0, MAX_QUANTITY_PER_ITEM),
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <EstimatedPoints quantities={quantities} />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/portal/receipts"
            className="text-sm text-[#A0A0A0] hover:text-white px-4 py-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || queue.length === 0}
            className="bg-[#9B30FF] text-white font-semibold rounded-full px-6 py-3 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UploadIcon className="w-4 h-4" />
            )}
            {submitting
              ? allUploaded
                ? 'Saving...'
                : 'Uploading...'
              : 'Submit receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quantity stepper row
// ---------------------------------------------------------------------------
function QuantityRow({
  label,
  flavor,
  color,
  quantity,
  onChange,
}: {
  label: string
  flavor: string
  color: string
  quantity: number
  onChange: (next: number) => void
}) {
  const active = quantity > 0
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
        active
          ? 'border-[#9B30FF] bg-[#9B30FF]/5'
          : 'border-[#2A2A2A] bg-[#0A0A0A]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{label}</div>
          <div className="text-[11px] text-[#A0A0A0] truncate">{flavor}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, quantity - 1))}
          disabled={quantity <= 0}
          aria-label={`Decrease ${label}`}
          className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-white flex items-center justify-center hover:border-[#9B30FF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_QUANTITY_PER_ITEM}
          value={quantity}
          onChange={(e) => {
            const next = Math.floor(Number(e.target.value) || 0)
            onChange(clamp(next, 0, MAX_QUANTITY_PER_ITEM))
          }}
          aria-label={`${label} quantity`}
          className="w-12 bg-transparent text-center text-white font-semibold text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(MAX_QUANTITY_PER_ITEM, quantity + 1))}
          disabled={quantity >= MAX_QUANTITY_PER_ITEM}
          aria-label={`Increase ${label}`}
          className="w-8 h-8 rounded-full bg-[#9B30FF] text-white flex items-center justify-center hover:bg-[#7E22CE] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estimated points footer
// ---------------------------------------------------------------------------
function EstimatedPoints({ quantities }: { quantities: Record<string, number> }) {
  const totalUnits = Object.values(quantities).reduce((sum, q) => sum + q, 0)
  const estimated = totalUnits * POINTS.PER_RECEIPT
  return (
    <div className="flex items-center justify-between border-t border-[#2A2A2A] pt-4">
      <span className="text-xs text-[#A0A0A0]">
        {totalUnits === 0
          ? 'Bump a counter when you add a pack to a receipt.'
          : `${totalUnits} pack${totalUnits === 1 ? '' : 's'} \u00b7 estimated points after review`}
      </span>
      <span
        className={`text-sm font-semibold ${
          estimated > 0 ? 'text-[#9B30FF]' : 'text-[#666]'
        }`}
      >
        {estimated > 0 ? `~${estimated.toLocaleString()} pts` : '—'}
      </span>
    </div>
  )
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}
