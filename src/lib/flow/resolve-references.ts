/**
 * Resolve reference image URLs for a flow post (prior segment outputs, library, external URL).
 */

export type MediaRef = {
  url: string
  file_type: string
  s3_key?: string | null
}

export type FlowPostForRefs = {
  sort_order: number
  status: string
  reference_external_url?: string | null
  reference_source_sort_order?: number | null
  end_frame_source_sort_order?: number | null
  reference_media?: MediaRef | null
  end_reference_media?: MediaRef | null
  generated_media?: MediaRef | null
}

export type FlowPostsContext = { flow_posts: FlowPostForRefs[] }

export type ReferenceImageSource = { url: string; s3_key?: string | null }

export function resolvePrimaryReferenceSource(
  flow: FlowPostsContext,
  post: FlowPostForRefs
): ReferenceImageSource | undefined {
  if (post.reference_source_sort_order != null) {
    const src = flow.flow_posts.find((p) => p.sort_order === post.reference_source_sort_order)
    if (!src || !['complete', 'approved'].includes(src.status)) return undefined
    const g = src.generated_media
    if (g?.file_type === 'image' && g.url) return { url: g.url, s3_key: g.s3_key }
    return undefined
  }
  const external = post.reference_external_url?.trim()
  if (external) return { url: external }
  const rm = post.reference_media
  if (rm?.url) return { url: rm.url, s3_key: rm.s3_key }
  return undefined
}

export function resolveEndFrameSource(
  flow: FlowPostsContext,
  post: FlowPostForRefs
): ReferenceImageSource | undefined {
  if (post.end_frame_source_sort_order != null) {
    const src = flow.flow_posts.find((p) => p.sort_order === post.end_frame_source_sort_order)
    if (!src || !['complete', 'approved'].includes(src.status)) return undefined
    const g = src.generated_media
    if (g?.file_type === 'image' && g.url) return { url: g.url, s3_key: g.s3_key }
    return undefined
  }
  const em = post.end_reference_media
  if (em?.url) return { url: em.url, s3_key: em.s3_key }
  return undefined
}

export function resolvePrimaryReferenceUrl(
  flow: FlowPostsContext,
  post: FlowPostForRefs
): string | undefined {
  return resolvePrimaryReferenceSource(flow, post)?.url
}

export function resolveEndFrameUrl(flow: FlowPostsContext, post: FlowPostForRefs): string | undefined {
  return resolveEndFrameSource(flow, post)?.url
}
