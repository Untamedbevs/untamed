'use client'

import { useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import type { UgcSubmissionAsset } from '@/lib/ugc/types'
import { UgcVideo } from '@/components/ugc/UgcVideo'

/** Best-quality URL for viewing/downloading an asset. */
export function bestAssetUrl(asset: UgcSubmissionAsset): string {
  if (asset.asset_type === 'video') {
    const processed = asset.processed_urls as
      | { '1080p'?: string; '720p'?: string; original?: string }
      | null
    return processed?.original || processed?.['1080p'] || asset.url
  }
  return asset.url
}

/** Admin download URL that forces a save-as via presigned S3 redirect. */
export function assetDownloadHref(asset: UgcSubmissionAsset, filename?: string): string {
  const url = bestAssetUrl(asset)
  const params = new URLSearchParams({ url })
  if (filename) params.set('filename', filename)
  return `/api/admin/ugc/download?${params.toString()}`
}

interface UgcAssetLightboxProps {
  assets: UgcSubmissionAsset[]
  index: number
  onChange: (index: number) => void
  onClose: () => void
  downloadFilename?: (asset: UgcSubmissionAsset, index: number) => string
}

export function UgcAssetLightbox({
  assets,
  index,
  onChange,
  onClose,
  downloadFilename,
}: UgcAssetLightboxProps) {
  const asset = assets[index]
  const hasMultiple = assets.length > 1

  const goPrev = useCallback(
    () => onChange((index - 1 + assets.length) % assets.length),
    [index, assets.length, onChange]
  )
  const goNext = useCallback(
    () => onChange((index + 1) % assets.length),
    [index, assets.length, onChange]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasMultiple) goPrev()
      else if (e.key === 'ArrowRight' && hasMultiple) goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext, hasMultiple])

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!asset) return null

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm text-[#A0A0A0]">
          {hasMultiple && `${index + 1} / ${assets.length}`}
          {asset.width && asset.height && (
            <span className="ml-3">
              {asset.width}&times;{asset.height}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={assetDownloadHref(asset, downloadFilename?.(asset, index))}
            className="inline-flex items-center gap-2 bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-4 py-2 hover:bg-[#7E22CE] transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#2A2A2A] text-white hover:bg-[#3A3A3A] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Prev / next */}
      {hasMultiple && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[#2A2A2A]/80 text-white hover:bg-[#3A3A3A] transition-colors z-10"
            aria-label="Previous asset"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[#2A2A2A]/80 text-white hover:bg-[#3A3A3A] transition-colors z-10"
            aria-label="Next asset"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Asset */}
      <div
        className="max-w-[92vw] max-h-[84vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {asset.asset_type === 'video' ? (
          <div
            style={
              asset.width && asset.height
                ? {
                    width: `min(92vw, calc(84vh * ${asset.width / asset.height}))`,
                    aspectRatio: `${asset.width} / ${asset.height}`,
                  }
                : { width: 'min(92vw, 1024px)', aspectRatio: '16 / 9' }
            }
          >
            <UgcVideo
              key={asset.id}
              src={asset.url}
              processedUrls={
                (asset.processed_urls as
                  | { '1080p'?: string; '720p'?: string; original?: string; thumb?: string }
                  | null) || null
              }
              processingStatus={asset.processing_status}
              context="single"
              fit="contain"
              className="w-full h-full"
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt=""
            className="max-w-[92vw] max-h-[84vh] object-contain rounded-lg"
          />
        )}
      </div>
    </div>
  )
}
