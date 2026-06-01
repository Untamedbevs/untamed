'use client'

import Link from 'next/link'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import type {
  LoyaltyReceiptStatus,
  LoyaltyReceiptWithAssets,
} from '@/lib/receipts/types'

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

export function ReceiptCard({
  receipt,
}: {
  receipt: LoyaltyReceiptWithAssets
}) {
  const status = STATUS_STYLES[receipt.status]
  const StatusIcon = status.Icon
  const cover = receipt.assets[0]?.url || receipt.image_url
  const extraCount = Math.max(0, receipt.assets.length - 1)

  return (
    <Link
      href={`/portal/receipts/${receipt.id}`}
      className="group bg-[#141414] border border-[#2A2A2A] hover:border-[#9B30FF] rounded-2xl overflow-hidden transition-colors"
    >
      <div className="aspect-square bg-[#0A0A0A] relative overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt="Receipt"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#666] text-xs">
            No image
          </div>
        )}
        {extraCount > 0 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            +{extraCount}
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.cls}`}
        >
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </span>
        <div className="flex items-center justify-between text-xs text-[#A0A0A0]">
          <span>
            {new Date(receipt.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {receipt.points_awarded > 0 && (
            <span className="text-[#9B30FF] font-semibold">
              +{receipt.points_awarded} pts
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
