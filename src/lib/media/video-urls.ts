/**
 * Helpers for working with MediaConvert-processed video outputs.
 *
 * Naming convention (from VibrationFit's pipeline, ported to Untamed):
 *  - {base}-1080p.mp4
 *  - {base}-720p.mp4
 *  - {base}-original.mp4
 *  - {base}-thumb.0000000.jpg   <- the auto-generated poster
 */

const RENDITION_REGEX = /-(1080p|720p|original)\.(mp4|mov|webm)$/i
const RAW_VIDEO_EXT_REGEX = /\.(mp4|mov|webm)$/i

/**
 * Derive the auto-generated thumbnail URL from a processed video URL.
 * Returns an empty string if the URL doesn't look like a MediaConvert output.
 */
export function getVideoThumbnailUrl(videoUrl: string): string {
  if (!videoUrl) return ''
  const isMediaConvertAsset =
    /\/site-assets\//.test(videoUrl) ||
    /\/user-uploads\/.*\/processed\//.test(videoUrl) ||
    RENDITION_REGEX.test(videoUrl)

  if (!isMediaConvertAsset) return ''

  if (RENDITION_REGEX.test(videoUrl)) {
    return videoUrl.replace(RENDITION_REGEX, '-thumb.0000000.jpg')
  }
  return videoUrl.replace(RAW_VIDEO_EXT_REGEX, '-thumb.0000000.jpg')
}

/**
 * Derive a sibling rendition URL from any processed video URL.
 * For example, given a 1080p URL, returns the 720p URL.
 */
export function getRenditionUrl(
  videoUrl: string,
  rendition: '1080p' | '720p' | 'original'
): string {
  if (!videoUrl) return ''
  if (RENDITION_REGEX.test(videoUrl)) {
    return videoUrl.replace(RENDITION_REGEX, `-${rendition}.$2`)
  }
  return ''
}

/** True if the URL points to a MediaConvert-processed file. */
export function isProcessedVideo(url: string): boolean {
  return RENDITION_REGEX.test(url)
}

/**
 * Pick the best rendition URL based on viewport width, falling back gracefully.
 */
export function pickRenditionForViewport(
  processed: { '1080p'?: string; '720p'?: string; original?: string } | null | undefined,
  fallbackUrl: string,
  viewportWidth?: number
): string {
  if (!processed) return fallbackUrl
  const w = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280)
  if (w >= 1280 && processed['1080p']) return processed['1080p']
  if (processed['720p']) return processed['720p']
  if (processed['1080p']) return processed['1080p']
  if (processed.original) return processed.original
  return fallbackUrl
}
