'use client'

import Link from 'next/link'
import { CheckCircle, Clock, Sparkles, XCircle } from 'lucide-react'
import type {
  UgcSubmissionWithAssets,
  UgcStatus,
} from '@/lib/ugc/types'
import { getVideoThumbnailUrl } from '@/lib/media/video-urls'

const STATUS_STYLES: Record<UgcStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
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
  featured: {
    label: 'Featured',
    cls: 'bg-[#9B30FF]/15 text-[#9B30FF] border-[#9B30FF]/30',
    Icon: Sparkles,
  },
  rejected: {
    label: 'Not approved',
    cls: 'bg-red-500/15 text-red-400 border-red-500/30',
    Icon: XCircle,
  },
}

export function UgcSubmissionCard({
  submission,
}: {
  submission: UgcSubmissionWithAssets
}) {
  const status = STATUS_STYLES[submission.status]
  const StatusIcon = status.Icon
  const firstAsset = submission.assets[0]
  const thumb =
    firstAsset?.processed_urls?.thumb ||
    (firstAsset?.asset_type === 'video'
      ? getVideoThumbnailUrl(firstAsset.url) || ''
      : firstAsset?.url || '')

  return (
    <Link
      href={`/portal/ugc/${submission.id}`}
      className="group bg-[#141414] border border-[#2A2A2A] hover:border-[#9B30FF] rounded-2xl overflow-hidden transition-colors"
    >
      <div className="aspect-square bg-[#0A0A0A] relative overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={submission.caption || 'UGC submission'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#666] text-xs">
            Processing...
          </div>
        )}
        {firstAsset?.asset_type === 'video' && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            Video
          </div>
        )}
        {submission.assets.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            +{submission.assets.length - 1}
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
        {submission.caption && (
          <p className="text-sm text-white line-clamp-2">{submission.caption}</p>
        )}
        <div className="flex items-center justify-between text-xs text-[#A0A0A0]">
          <span>
            {new Date(submission.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {submission.points_awarded > 0 && (
            <span className="text-[#9B30FF] font-semibold">
              +{submission.points_awarded} pts
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
