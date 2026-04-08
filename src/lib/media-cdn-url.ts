/**
 * Public media URLs: prefer MEDIA_CDN_URL + s3_key over stored `url` so admin UI
 * stays correct when CloudFront domain changes or DB has legacy S3 hostnames.
 */
export function resolvePublicMediaUrl(row: {
  s3_key: string
  url: string
  is_private?: boolean | null
}): string {
  if (row.is_private) return row.url || ''
  const cdn = process.env.MEDIA_CDN_URL?.trim()
  if (cdn && row.s3_key) {
    const base = cdn.replace(/\/$/, '')
    const key = row.s3_key.replace(/^\/+/, '')
    return `${base}/${key}`
  }
  return row.url
}

export function withResolvedPublicMediaUrl<T extends { s3_key: string; url: string; is_private?: boolean | null }>(
  row: T
): T {
  return { ...row, url: resolvePublicMediaUrl(row) }
}

export function patchFlowPostMediaRefs<T extends Record<string, unknown>>(post: T): T {
  const keys = ['reference_media', 'end_reference_media', 'generated_media'] as const
  const out: Record<string, unknown> = { ...post }
  for (const k of keys) {
    const m = post[k]
    if (m && typeof m === 'object' && 's3_key' in m && typeof (m as { s3_key: unknown }).s3_key === 'string') {
      out[k] = withResolvedPublicMediaUrl(m as { s3_key: string; url: string; is_private?: boolean | null })
    }
  }
  return out as T
}
