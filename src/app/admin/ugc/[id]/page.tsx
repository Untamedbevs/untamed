'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Globe,
  ImageDown,
  Loader2,
  Lock,
  Mail,
  MapPin,
  RefreshCw,
  Sparkles,
  Tag,
  Trophy,
  XCircle,
} from 'lucide-react'
import type {
  UgcStatus,
  UgcSubmissionAsset,
  UgcSubmissionWithAssets,
} from '@/lib/ugc/types'
import { UgcVideo } from '@/components/ugc/UgcVideo'
import { drinks } from '@/lib/drinks'

interface AdminSubmission extends UgcSubmissionWithAssets {
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

const STATUS_STYLES: Record<UgcStatus, { cls: string; Icon: React.ComponentType<{ className?: string }>; label: string }> = {
  pending: { cls: 'bg-[#FFFF00]/15 text-[#FFFF00] border-[#FFFF00]/30', Icon: AlertCircle, label: 'Pending review' },
  approved: { cls: 'bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/30', Icon: CheckCircle, label: 'Approved' },
  featured: { cls: 'bg-[#9B30FF]/15 text-[#9B30FF] border-[#9B30FF]/30', Icon: Sparkles, label: 'Featured' },
  rejected: { cls: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: XCircle, label: 'Rejected' },
}

export default function AdminUgcDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const [submission, setSubmission] = useState<AdminSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [customPoints, setCustomPoints] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/ugc/${id}`)
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

  async function performAction(payload: Record<string, unknown>, label: string) {
    setBusy(label)
    setError('')
    try {
      const res = await fetch(`/api/admin/ugc/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Action failed')
      }
      // Reload submission
      const detail = await fetch(`/api/admin/ugc/${id}`)
      const data = await detail.json()
      setSubmission(data.submission)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#A0A0A0]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }
  if (!submission) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
        {error || 'Not found'}
      </div>
    )
  }

  const status = STATUS_STYLES[submission.status]
  const StatusIcon = status.Icon
  const drink = drinks.find((d) => d.slug === submission.drink_slug)
  const customPointsNum = customPoints.trim() ? Number(customPoints) : undefined
  const isPending = submission.status === 'pending'
  const isApproved = submission.status === 'approved'
  const isFeatured = submission.status === 'featured'

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        href="/admin/ugc"
        className="text-sm text-[#A0A0A0] hover:text-white inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to queue
      </Link>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.cls}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#2A2A2A] text-[#A0A0A0]">
              {submission.contributor_type}
            </span>
            {submission.is_public ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30">
                <Globe className="w-3 h-3" />
                Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#2A2A2A] text-[#A0A0A0]">
                <Lock className="w-3 h-3" />
                Private
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {submission.assets.map((asset: UgcSubmissionAsset) => (
              <div
                key={asset.id}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden aspect-video"
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
                    processingStatus={asset.processing_status}
                    context="single"
                    fit="contain"
                    className="w-full h-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.url}
                    alt={submission.caption || 'UGC'}
                    className="w-full"
                  />
                )}
                <div className="px-3 py-2 text-xs text-[#A0A0A0] flex items-center justify-between">
                  <span>
                    {asset.asset_type} · {asset.processing_status}
                  </span>
                  {asset.width && asset.height && (
                    <span>
                      {asset.width}&times;{asset.height}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {submission.caption && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">
              <p className="text-white">{submission.caption}</p>
            </div>
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

          {submission.consent_signature && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 text-xs text-[#A0A0A0]">
              <strong className="text-white">Consent:</strong>{' '}
              Signed by &ldquo;{submission.consent_signature}&rdquo; on{' '}
              {submission.consent_at
                ? new Date(submission.consent_at).toLocaleString()
                : 'unknown date'}
            </div>
          )}

          {submission.rejection_reason && (
            <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-4 text-sm text-red-400">
              <strong>Rejection reason:</strong> {submission.rejection_reason}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-white">Contributor</h3>
            {submission.loyalty_member && (
              <Link
                href={`/admin/loyalty?member=${submission.loyalty_member.id}`}
                className="block bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#9B30FF] rounded-xl p-3 transition-colors"
              >
                <p className="text-sm text-white font-medium">
                  {submission.loyalty_member.first_name || 'Loyalty member'}
                </p>
                <p className="text-xs text-[#A0A0A0]">{submission.loyalty_member.email}</p>
                <div className="text-xs text-[#9B30FF] mt-1 inline-flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  {submission.loyalty_member.points_balance} pts
                </div>
              </Link>
            )}
            {submission.distributor_lead && (
              <Link
                href={`/admin/retail?lead=${submission.distributor_lead.id}`}
                className="block bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#FF8C2A] rounded-xl p-3 transition-colors"
              >
                <p className="text-sm text-white font-medium">
                  {submission.distributor_lead.business_name}
                </p>
                <p className="text-xs text-[#A0A0A0]">
                  {submission.distributor_lead.contact_name} · {submission.distributor_lead.email}
                </p>
              </Link>
            )}
            {submission.contributor_email && (
              <a
                href={`mailto:${submission.contributor_email}`}
                className="text-xs text-[#A0A0A0] hover:text-white inline-flex items-center gap-1"
              >
                <Mail className="w-3 h-3" />
                {submission.contributor_email}
              </a>
            )}
          </div>

          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-white">Review</h3>

            {isPending && (
              <>
                <div>
                  <label className="block text-xs text-[#A0A0A0] mb-1">
                    Custom points (optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={customPoints}
                    onChange={(e) => setCustomPoints(e.target.value)}
                    placeholder="50 default"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9B30FF]"
                  />
                </div>

                <button
                  onClick={() =>
                    performAction(
                      {
                        action: 'approve',
                        customPoints: customPointsNum,
                        promoteToLibrary: true,
                      },
                      'approve'
                    )
                  }
                  disabled={!!busy}
                  className="w-full bg-[#39FF14] text-black font-semibold rounded-full px-4 py-2.5 inline-flex items-center justify-center gap-2 hover:bg-[#39FF14]/80 transition-colors disabled:opacity-50"
                >
                  {busy === 'approve' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve + add to library
                </button>

                <button
                  onClick={() =>
                    performAction(
                      {
                        action: 'feature',
                        customPoints: customPointsNum,
                        promoteToLibrary: true,
                      },
                      'feature'
                    )
                  }
                  disabled={!!busy}
                  className="w-full bg-[#9B30FF] text-white font-semibold rounded-full px-4 py-2.5 inline-flex items-center justify-center gap-2 hover:bg-[#7E22CE] transition-colors disabled:opacity-50"
                >
                  {busy === 'feature' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Feature
                </button>

                <div className="space-y-2 pt-2 border-t border-[#2A2A2A]">
                  <label className="block text-xs text-[#A0A0A0] mb-1">
                    Reject with reason
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                    placeholder="Tell the contributor why..."
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 resize-none"
                  />
                  <button
                    onClick={() =>
                      performAction(
                        {
                          action: 'reject',
                          rejectionReason: rejectionReason.trim(),
                        },
                        'reject'
                      )
                    }
                    disabled={!!busy || !rejectionReason.trim()}
                    className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-semibold rounded-full px-4 py-2 inline-flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    {busy === 'reject' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Reject
                  </button>
                </div>
              </>
            )}

            {isApproved && (
              <button
                onClick={() =>
                  performAction({ action: 'feature' }, 'feature')
                }
                disabled={!!busy}
                className="w-full bg-[#9B30FF] text-white font-semibold rounded-full px-4 py-2.5 inline-flex items-center justify-center gap-2 hover:bg-[#7E22CE] transition-colors disabled:opacity-50"
              >
                {busy === 'feature' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Feature
              </button>
            )}

            {isFeatured && (
              <button
                onClick={() =>
                  performAction({ action: 'unfeature' }, 'unfeature')
                }
                disabled={!!busy}
                className="w-full bg-[#2A2A2A] text-white font-semibold rounded-full px-4 py-2.5 inline-flex items-center justify-center gap-2 hover:bg-[#3A3A3A] transition-colors disabled:opacity-50"
              >
                {busy === 'unfeature' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Remove from featured
              </button>
            )}

            {(isApproved || isFeatured) && (
              <>
                <button
                  onClick={() =>
                    performAction(
                      { action: 'set_public', isPublic: !submission.is_public },
                      'public'
                    )
                  }
                  disabled={!!busy}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm rounded-full px-4 py-2 inline-flex items-center justify-center gap-2 hover:border-[#9B30FF] transition-colors disabled:opacity-50"
                >
                  {busy === 'public' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : submission.is_public ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  {submission.is_public ? 'Hide from public gallery' : 'Show in public gallery'}
                </button>
                {submission.promoted_media_ids.length === 0 && (
                  <button
                    onClick={() =>
                      performAction(
                        { action: 'approve', promoteToLibrary: true, customPoints: 0 },
                        'promote'
                      )
                    }
                    disabled={!!busy}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm rounded-full px-4 py-2 inline-flex items-center justify-center gap-2 hover:border-[#9B30FF] transition-colors disabled:opacity-50"
                  >
                    {busy === 'promote' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImageDown className="w-4 h-4" />
                    )}
                    Add to media library
                  </button>
                )}
              </>
            )}
          </div>

          {submission.points_awarded > 0 && (
            <div className="bg-[#9B30FF]/10 border border-[#9B30FF]/30 rounded-2xl p-4 text-sm text-[#9B30FF]">
              <strong>+{submission.points_awarded} pts</strong> awarded for this submission.
            </div>
          )}

          {submission.assets.some(
            (a) =>
              a.asset_type === 'video' &&
              a.processing_status !== 'ready'
          ) && (
            <Link
              href="#"
              onClick={async (e) => {
                e.preventDefault()
                await fetch(`/api/admin/ugc/${id}/retry-processing`, {
                  method: 'POST',
                })
                router.refresh()
              }}
              className="block w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm rounded-full px-4 py-2 text-center hover:border-[#9B30FF] transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              Retry video processing
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
