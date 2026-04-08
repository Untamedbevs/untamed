/**
 * Static files under `public/` (e.g. /images/...) need an HTTPS origin for Fal and other remote fetchers.
 * Set NEXT_PUBLIC_SITE_ASSET_BASE_URL to your CDN/S3 public base (e.g. .../site-assets) after syncing assets (see scripts/sync-public-assets-to-s3.mjs).
 */

function normalizeBase(base: string): string {
  return base.replace(/\/$/, '')
}

/**
 * Absolute URL for a site path like `/images/can.png`.
 * 1) Already-absolute URLs pass through.
 * 2) If NEXT_PUBLIC_SITE_ASSET_BASE_URL is set, use that origin (local dev + Fal).
 * 3) Otherwise use fallbackOrigin (e.g. window.location.origin or NEXT_PUBLIC_SITE_URL).
 */
export function siteAssetAbsoluteUrl(assetPath: string, fallbackOrigin?: string): string {
  const trimmed = assetPath.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  const envBase =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_ASSET_BASE_URL
      ? normalizeBase(process.env.NEXT_PUBLIC_SITE_ASSET_BASE_URL)
      : ''
  if (envBase) {
    return `${envBase}${path}`
  }

  const fb = (fallbackOrigin || '').trim()
  if (fb) {
    return `${normalizeBase(fb)}${path}`
  }

  return path
}
