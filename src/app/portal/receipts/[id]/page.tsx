'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Tag,
  Trash2,
} from 'lucide-react'
import type {
  LoyaltyReceiptStatus,
  LoyaltyReceiptWithAssets,
} from '@/lib/receipts/types'
import { drinks } from '@/lib/drinks'

const STATUS_STYLES: Record<
  LoyaltyReceiptStatus,
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: 'Pending review',
    cls: 'bg-[#FFFF00]/15 text-[#FFFF00] border-[#FFFF00]/30',
    Icon: Clock,
  },
  approved: {
    label: 'Approved',
    cls: 'bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/30',
    Icon: CheckCircle,
  },
  rejected: {
    label: 'Not approved',
    cls: 'bg-red-500/15 text-red-400 border-red-500/30',
    Icon: AlertCircle,
  },
}

export default function PortalReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const [receipt, setReceipt] = useState<LoyaltyReceiptWithAssets | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/portal/receipts/${id}`)
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (!cancelled) setReceipt(data.receipt)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this receipt? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/portal/receipts/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Delete failed')
      setDeleting(false)
      return
    }
    router.push('/portal/receipts')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#A0A0A0]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }
  if (error || !receipt) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error || 'Receipt not found.'}</span>
      </div>
    )
  }

  const status = STATUS_STYLES[receipt.status]
  const StatusIcon = status.Icon
  const drink = drinks.find((d) => d.slug === receipt.drink_slug)
  const galleryAssets =
    receipt.assets.length > 0
      ? receipt.assets
      : receipt.image_url
        ? [{ id: 'legacy', url: receipt.image_url } as { id: string; url: string }]
        : []

  return (
    <div className="space-y-6">
      <Link
        href="/portal/receipts"
        className="text-sm text-[#A0A0A0] hover:text-white inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to my receipts
      </Link>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[#2A2A2A] flex items-start justify-between gap-4">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}
            >
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            <p className="text-xs text-[#A0A0A0] mt-2">
              Submitted{' '}
              {new Date(receipt.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          {receipt.status === 'pending' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-400 hover:text-red-300 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>
          )}
        </div>

        {receipt.status === 'rejected' && receipt.admin_notes && (
          <div className="p-6 bg-red-500/5 border-b border-red-500/20">
            <p className="text-sm text-red-400">
              <strong>Reason:</strong> {receipt.admin_notes}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6">
          {galleryAssets.map((asset) => (
            <div
              key={asset.id}
              className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt="Receipt photo"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="p-6 space-y-4 border-t border-[#2A2A2A]">
          {receipt.claimed_items && receipt.claimed_items.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-[#666] mb-2">
                What you claimed
              </div>
              <div className="space-y-1.5">
                {receipt.claimed_items.map((item) => {
                  const drink = drinks.find((d) => d.slug === item.drinkSlug)
                  return (
                    <div
                      key={item.drinkSlug}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: drink?.color || '#666' }}
                        />
                        <span className="text-white truncate">
                          {drink?.name || item.drinkSlug}
                        </span>
                      </div>
                      <span className="text-[#A0A0A0] font-medium">
                        ×{item.quantity}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {drink && (!receipt.claimed_items || receipt.claimed_items.length === 0) && (
            <div className="flex flex-wrap gap-3 text-sm text-[#A0A0A0]">
              <span className="inline-flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                {drink.name}
              </span>
            </div>
          )}
          {receipt.points_awarded > 0 && (
            <div className="text-sm text-[#9B30FF] font-semibold">
              +{receipt.points_awarded} loyalty points awarded
            </div>
          )}
          {receipt.status === 'pending' && (
            <p className="text-xs text-[#666]">
              We&apos;ll review your receipt within 1-2 business days. Once
              approved, points will land in your balance automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
