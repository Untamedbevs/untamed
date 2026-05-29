'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getVideoThumbnailUrl } from '@/lib/media/video-urls'

export type VideoQualityRendition = '720p' | '1080p' | 'original'

const ALL_QUALITIES: VideoQualityRendition[] = ['720p', '1080p', 'original']

function orderedQualities(preferred: VideoQualityRendition): VideoQualityRendition[] {
  return [preferred, ...ALL_QUALITIES.filter((q) => q !== preferred)]
}

/**
 * Build CDN URLs for MediaConvert outputs:
 *   {base}-720p.mp4 / -1080p.mp4 / -original.mp4
 *
 * Falls back to the input URL if it doesn't look like a MediaConvert path.
 */
export function buildAdaptiveVideoUrlCandidates(
  url: string,
  preferredQuality: VideoQualityRendition
): string[] {
  if (!url) return []
  if (url.endsWith('.webm')) return [url]

  // Already-rendition pattern: ".../base-1080p.mp4"
  const suffixed = url.match(/^(.*)-(720p|1080p|original)(\.(mp4|mov))$/i)
  if (suffixed) {
    const base = suffixed[1]
    const ext = suffixed[3]
    const out: string[] = []
    const seen = new Set<string>()
    for (const q of orderedQualities(preferredQuality)) {
      const candidate = `${base}-${q}${ext}`
      if (!seen.has(candidate)) {
        seen.add(candidate)
        out.push(candidate)
      }
    }
    return out
  }

  // Untransformed file inside /processed/ -- swap renditions
  if (url.includes('/processed/')) {
    const out: string[] = []
    const seen = new Set<string>()
    for (const q of orderedQualities(preferredQuality)) {
      const candidate = url.replace(/\.(mp4|mov)$/i, `-${q}.mp4`)
      if (!seen.has(candidate)) {
        seen.add(candidate)
        out.push(candidate)
      }
    }
    return out
  }

  return [url]
}

interface UgcVideoProps {
  src: string
  poster?: string
  /** When in a list context, lazy-load via IntersectionObserver. */
  lazy?: boolean
  /** Preload + autoplay defaults vary with this. */
  context?: 'list' | 'single' | 'hero'
  className?: string
  controls?: boolean
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  /** Optional pre-resolved processed URLs (skips heuristics). */
  processedUrls?: {
    '1080p'?: string
    '720p'?: string
    original?: string
    thumb?: string
  } | null
}

/**
 * UgcVideo
 *
 * Adaptive-quality video player for MediaConvert-processed UGC.
 * - Picks 720p / 1080p / original based on viewport width
 * - Falls back through other renditions if the first errors
 * - Auto-derives the poster from `-thumb.0000000.jpg` when not provided
 * - Lazy mounts the <video> tag when `lazy` is true
 */
export function UgcVideo({
  src,
  poster,
  lazy = false,
  context = 'single',
  className = '',
  controls = true,
  autoplay = false,
  muted = false,
  loop = false,
  processedUrls,
}: UgcVideoProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(!lazy)
  const [quality, setQuality] = useState<VideoQualityRendition>('1080p')
  const [candidateIndex, setCandidateIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Pick a primary URL: prefer the explicit processed map if available.
  const primarySrc = useMemo(() => {
    if (processedUrls) {
      if (quality === '1080p' && processedUrls['1080p']) return processedUrls['1080p']
      if (quality === '720p' && processedUrls['720p']) return processedUrls['720p']
      if (quality === 'original' && processedUrls.original) return processedUrls.original
      return (
        processedUrls['1080p'] ||
        processedUrls['720p'] ||
        processedUrls.original ||
        src
      )
    }
    return src
  }, [src, processedUrls, quality])

  const candidates = useMemo(
    () => buildAdaptiveVideoUrlCandidates(primarySrc, quality),
    [primarySrc, quality]
  )

  const activeSrc =
    candidates[Math.min(candidateIndex, candidates.length - 1)] ?? primarySrc

  useEffect(() => {
    setCandidateIndex(0)
  }, [primarySrc, quality])

  useEffect(() => {
    if (!lazy || !mounted || !containerRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setIsVisible(true)
      },
      { rootMargin: '200px' }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [lazy, mounted])

  useEffect(() => {
    if (!mounted) return
    function update() {
      const w = window.innerWidth
      if (w < 768) setQuality('720p')
      else if (w < 1440) setQuality('1080p')
      else setQuality('original')
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    type ConnectionLike = {
      effectiveType?: string
      addEventListener?: (e: string, h: () => void) => void
      removeEventListener?: (e: string, h: () => void) => void
    }
    const nav = navigator as Navigator & {
      connection?: ConnectionLike
      mozConnection?: ConnectionLike
      webkitConnection?: ConnectionLike
    }
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection
    if (!conn) return
    function update() {
      const t = conn?.effectiveType
      if (t === '3g' || t === '2g' || t === 'slow-2g') setQuality('720p')
    }
    update()
    conn.addEventListener?.('change', update)
    return () => conn.removeEventListener?.('change', update)
  }, [mounted])

  const handleError = useCallback(() => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((i) => i + 1)
    }
  }, [candidateIndex, candidates.length])

  const preload: 'none' | 'metadata' | 'auto' =
    context === 'hero' ? 'auto' : context === 'single' ? 'metadata' : 'none'

  const effectiveAutoplay = context === 'hero' ? true : autoplay
  const effectiveMuted = context === 'hero' ? true : muted
  const effectiveLoop = context === 'hero' ? true : loop
  const effectiveControls = context === 'hero' ? false : controls

  const resolvedPoster =
    poster || processedUrls?.thumb || getVideoThumbnailUrl(primarySrc) || undefined

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? (
        <video
          key={activeSrc}
          src={activeSrc}
          poster={resolvedPoster}
          preload={preload}
          controls={effectiveControls}
          autoPlay={effectiveAutoplay}
          muted={effectiveMuted}
          loop={effectiveLoop}
          playsInline
          onError={handleError}
          className="w-full bg-black rounded-xl"
        />
      ) : (
        <div
          className="w-full aspect-video bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl flex items-center justify-center overflow-hidden"
          style={{ minHeight: '200px' }}
        >
          {resolvedPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedPoster}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[#A0A0A0] text-sm">Loading video...</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Helper for non-component callers that just need a single optimized URL.
 */
export function getOptimizedVideoUrl(
  url: string,
  preferredQuality?: VideoQualityRendition
): string {
  const q: VideoQualityRendition =
    preferredQuality ||
    (typeof window !== 'undefined' && window.innerWidth < 768
      ? '720p'
      : typeof window !== 'undefined' && window.innerWidth < 1440
        ? '1080p'
        : 'original')
  const list = buildAdaptiveVideoUrlCandidates(url, q)
  return list[0] ?? url
}
