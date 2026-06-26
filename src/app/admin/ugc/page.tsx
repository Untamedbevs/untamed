'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  Clock,
  FileImage,
  Loader2,
  Search,
  Sparkles,
  Video,
  XCircle,
} from 'lucide-react'
import type {
  UgcContributorType,
  UgcStatus,
  UgcSubmissionAsset,
  UgcSubmissionWithAssets,
} from '@/lib/ugc/types'
import { drinks } from '@/lib/drinks'
import { getVideoThumbnailUrl } from '@/lib/media/video-urls'

interface AdminUgcSubmission extends UgcSubmissionWithAssets {
  loyalty_member?: {
    id: string
    email: string
    first_name: string | null
    points_balance: number
  } | null
  distributor_lead?: {
    id: string
    business_name: string
    contact_name: string
    email: string
  } | null
}

const STATUS_TABS: { value: UgcStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'featured', label: 'Featured' },
  { value: 'rejected', label: 'Rejected' },
]

const STATUS_BADGES: Record<UgcStatus, { cls: string; Icon: React.ComponentType<{ className?: string }>; label: string }> = {
  pending: { cls: 'bg-[#FFFF00]/15 text-[#FFFF00] border-[#FFFF00]/30', Icon: Clock, label: 'Pending' },
  approved: { cls: 'bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/30', Icon: CheckCircle, label: 'Approved' },
  featured: { cls: 'bg-[#9B30FF]/15 text-[#9B30FF] border-[#9B30FF]/30', Icon: Sparkles, label: 'Featured' },
  rejected: { cls: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: XCircle, label: 'Rejected' },
}

export default function AdminUgcPage() {
  const [submissions, setSubmissions] = useState<AdminUgcSubmission[]>([])
  // Default to "All" so staff see every submission. Previously defaulted to
  // "Pending" which made the page look empty when older items had already
  // been approved or featured.
  const [tab, setTab] = useState<UgcStatus | 'all'>('all')
  const [contributorFilter, setContributorFilter] = useState<
    UgcContributorType | ''
  >('')
  const [drinkFilter, setDrinkFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: tab })
    if (contributorFilter) params.set('contributor_type', contributorFilter)
    if (drinkFilter) params.set('drink_slug', drinkFilter)
    const res = await fetch(`/api/admin/ugc?${params}`)
    const data = await res.json()
    setSubmissions(data.submissions || [])
    setLoading(false)
  }, [tab, contributorFilter, drinkFilter])

  useEffect(() => {
    load()
  }, [load])

  // Per-status counts (when the active tab is "all" the API returns every
  // submission, so we can derive counts client-side without an extra request).
  const counts = (() => {
    if (tab !== 'all') return null
    const out: Record<UgcStatus, number> = {
      pending: 0,
      approved: 0,
      featured: 0,
      rejected: 0,
    }
    for (const s of submissions) out[s.status]++
    return out
  })()

  const filtered = submissions.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (s.contributor_email || '').toLowerCase().includes(q) ||
      (s.contributor_display_name || '').toLowerCase().includes(q) ||
      (s.caption || '').toLowerCase().includes(q) ||
      (s.location || '').toLowerCase().includes(q) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline text-2xl text-white">User-Generated Content</h1>
          <p className="text-sm text-[#A0A0A0]">
            Review photo and video submissions from loyalty members and distributors.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-[#2A2A2A] overflow-x-auto">
        {STATUS_TABS.map((t) => {
          // When viewing "All", show a count next to each status tab so it's
          // obvious how the data is distributed without clicking through.
          const count =
            t.value === 'all'
              ? submissions.length
              : counts
                ? counts[t.value]
                : null
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 inline-flex items-center gap-2 ${
                tab === t.value
                  ? 'text-[#9B30FF] border-[#9B30FF]'
                  : 'text-[#A0A0A0] border-transparent hover:text-white'
              }`}
            >
              {t.label}
              {count !== null && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    tab === t.value
                      ? 'bg-[#9B30FF]/20 text-[#9B30FF]'
                      : 'bg-[#1A1A1A] text-[#A0A0A0]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, caption, tag..."
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF]"
          />
        </div>
        <select
          value={contributorFilter}
          onChange={(e) =>
            setContributorFilter(e.target.value as UgcContributorType | '')
          }
          className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#9B30FF]"
        >
          <option value="">All contributors</option>
          <option value="loyalty">Loyalty members</option>
          <option value="distributor">Distributors</option>
          <option value="staff">Staff</option>
        </select>
        <select
          value={drinkFilter}
          onChange={(e) => setDrinkFilter(e.target.value)}
          className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#9B30FF]"
        >
          <option value="">All drinks</option>
          {drinks.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[#A0A0A0]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#A0A0A0] bg-[#141414] border border-[#2A2A2A] rounded-2xl">
          No submissions matching this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((submission) => (
            <AdminUgcCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * HEIC files have MIME type `image/heic` (or sometimes `image/heif`). No
 * desktop browser can render them, so showing them in an <img> tag produces
 * a broken-image icon. Detect those upfront so we can render a friendly
 * placeholder instead.
 */
function isHeicImage(asset: UgcSubmissionAsset): boolean {
  if (asset.asset_type !== 'image') return false
  const mime = (asset.mime_type || '').toLowerCase()
  if (mime.includes('heic') || mime.includes('heif')) return true
  return /\.(heic|heif)(\?|$)/i.test(asset.url)
}

function AdminUgcCard({ submission }: { submission: AdminUgcSubmission }) {
  const status = STATUS_BADGES[submission.status]
  const StatusIcon = status.Icon
  const firstAsset: UgcSubmissionAsset | undefined = submission.assets[0]

  // Pull the processing status off the first video, if any -- drives the
  // "Awaiting processing" badge below.
  const firstVideo = submission.assets.find((a) => a.asset_type === 'video')
  const videoNotReady =
    firstVideo &&
    (firstVideo.processing_status === 'uploaded' ||
      firstVideo.processing_status === 'processing')
  const videoFailed = firstVideo?.processing_status === 'failed'

  const isHeic = firstAsset ? isHeicImage(firstAsset) : false

  const thumb =
    firstAsset?.processed_urls?.thumb ||
    (firstAsset?.asset_type === 'video'
      ? getVideoThumbnailUrl(firstAsset.url) || ''
      : !isHeic
        ? firstAsset?.url || ''
        : '')

  return (
    <Link
      href={`/admin/ugc/${submission.id}`}
      className="bg-[#141414] border border-[#2A2A2A] hover:border-[#9B30FF] rounded-2xl overflow-hidden transition-colors group"
    >
      <div className="aspect-square bg-[#0A0A0A] relative overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={submission.caption || 'UGC'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : isHeic ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#A0A0A0] p-3">
            <FileImage className="w-8 h-8" />
            <span className="text-[10px] uppercase tracking-wider">
              HEIC photo
            </span>
            <span className="text-[10px] text-[#666] text-center leading-tight">
              Open to view in full quality
            </span>
          </div>
        ) : firstAsset?.asset_type === 'video' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#A0A0A0] p-3">
            <Video className="w-8 h-8" />
            <span className="text-[10px] uppercase tracking-wider">
              Video
            </span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#666] text-xs">
            No preview
          </div>
        )}

        {/* Top-left: video / heic badges so staff can see at a glance */}
        {firstAsset?.asset_type === 'video' && thumb && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded inline-flex items-center gap-1">
            <Video className="w-3 h-3" /> Video
          </div>
        )}

        {/* Bottom-right: processing badge when applicable */}
        {videoNotReady && (
          <div className="absolute bottom-2 right-2 bg-[#FFFF00]/90 text-black text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Awaiting processing
          </div>
        )}
        {videoFailed && (
          <div className="absolute bottom-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            Processing failed
          </div>
        )}

        {/* Asset count chip if more than one */}
        {submission.assets.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
            +{submission.assets.length - 1}
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.cls}`}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
          <span className="text-[10px] text-[#666] uppercase font-medium">
            {submission.contributor_type}
          </span>
        </div>
        <p className="text-xs text-[#A0A0A0] truncate">
          {submission.contributor_display_name || submission.contributor_email}
        </p>
        {submission.caption && (
          <p className="text-sm text-white line-clamp-2">{submission.caption}</p>
        )}
        <p className="text-[10px] text-[#666]">
          {new Date(submission.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>
    </Link>
  )
}
