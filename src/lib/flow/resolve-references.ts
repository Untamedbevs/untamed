/**
 * Resolve reference image URLs for a flow post (prior segment outputs, library, external URL).
 */

export type FlowPostForRefs = {
  sort_order: number
  status: string
  reference_external_url?: string | null
  reference_source_sort_order?: number | null
  end_frame_source_sort_order?: number | null
  reference_media?: { url: string; file_type: string } | null
  end_reference_media?: { url: string; file_type: string } | null
  generated_media?: { url: string; file_type: string } | null
}

export type FlowPostsContext = { flow_posts: FlowPostForRefs[] }

export function resolvePrimaryReferenceUrl(
  flow: FlowPostsContext,
  post: FlowPostForRefs
): string | undefined {
  if (post.reference_source_sort_order != null) {
    const src = flow.flow_posts.find((p) => p.sort_order === post.reference_source_sort_order)
    if (!src || !['complete', 'approved'].includes(src.status)) return undefined
    const g = src.generated_media
    if (g?.file_type === 'image' && g.url) return g.url
    return undefined
  }
  const external = post.reference_external_url?.trim()
  if (external) return external
  return post.reference_media?.url ?? undefined
}

export function resolveEndFrameUrl(flow: FlowPostsContext, post: FlowPostForRefs): string | undefined {
  if (post.end_frame_source_sort_order != null) {
    const src = flow.flow_posts.find((p) => p.sort_order === post.end_frame_source_sort_order)
    if (!src || !['complete', 'approved'].includes(src.status)) return undefined
    const g = src.generated_media
    if (g?.file_type === 'image' && g.url) return g.url
    return undefined
  }
  return post.end_reference_media?.url ?? undefined
}
