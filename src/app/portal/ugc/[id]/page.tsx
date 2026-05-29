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
  MapPin,
  Sparkles,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react'
import type { UgcStatus, UgcSubmissionWithAssets } from '@/lib/ugc/types'
import { UgcVideo } from '@/components/ugc/UgcVideo'
import { drinks } from '@/lib/drinks'

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

export default function PortalUgcDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const [submission, setSubmission] = useState<UgcSubmissionWithAssets | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/portal/ugc/${id}`)
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (!cancelled) setSubmission(data.submission)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
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
    if (!confirm('Delete this submission? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/portal/ugc/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Delete failed')
      setDeleting(false)
      return
    }
    router.push('/portal/ugc')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#A0A0A0]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }
  if (error || !submission) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error || 'Submission not found.'}</span>
      </div>
    )
  }

  const status = STATUS_STYLES[submission.status]
  const StatusIcon = status.Icon
  const drink = drinks.find((d) => d.slug === submission.drink_slug)

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/portal/ugc"
        className="text-sm text-[#A0A0A0] hover:text-white inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to my submissions
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
              {new Date(submission.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          {submission.status === 'pending' && (
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

        {submission.status === 'rejected' && submission.rejection_reason && (
          <div className="p-6 bg-red-500/5 border-b border-red-500/20">
            <p className="text-sm text-red-400">
              <strong>Reason:</strong> {submission.rejection_reason}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6">
          {submission.assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden aspect-square"
            >
              {asset.asset_type === 'video' ? (
                <UgcVideo
                  src={asset.url}
                  processedUrls={
                    (asset.processed_urls as
                      | {
                          '1080p'?: string
                          '720p'?: string
                          original?: string
                          thumb?: string
                        }
                      | null) || null
                  }
                  context="single"
                  className="w-full h-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.url}
                  alt={submission.caption || 'UGC submission'}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-6 space-y-4 border-t border-[#2A2A2A]">
          {submission.caption && (
            <p className="text-white">{submission.caption}</p>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-[#A0A0A0]">
            {drink && (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                {drink.name}
              </span>
            )}
            {submission.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {submission.location}
              </span>
            )}
            {submission.tags.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                {submission.tags.join(', ')}
              </span>
            )}
          </div>
          {submission.points_awarded > 0 && (
            <div className="text-sm text-[#9B30FF] font-semibold">
              +{submission.points_awarded} loyalty points awarded
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
