import { formatFalClientError } from '@/lib/fal-error'
import { fal, saveGeneratedMedia } from '@/lib/fal'
import { BRAND_KIT } from '@/lib/brand-kit'
import {
  defaultFalModelForMode,
  isNanoBanana2ImageModel,
  isNanoBananaEditModel,
  isReduxEditModel,
  resolveFalEditModel,
  resolveFalImageModel,
  resolveFalVideoModel,
  targetSizeToNanoAspectRatio,
  videoModelRequiresFirstAndLastFrame,
  videoModelRequiresStartImage,
} from '@/lib/fal-generate-models'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertVideoInputsValid, buildVideoFalInput } from '@/lib/flow/fal-video-input'
import {
  resolveEndFrameSource,
  resolveEndFrameUrl,
  resolvePrimaryReferenceSource,
  resolvePrimaryReferenceUrl,
} from '@/lib/flow/resolve-references'
import { mirrorReferenceImageForFal } from '@/lib/fal-reference-mirror'
import { patchFlowPostMediaRefs } from '@/lib/media-cdn-url'

type AdminClient = ReturnType<typeof createAdminClient>

const BRAND_STYLE_SUFFIX = `Style: ${BRAND_KIT.aesthetic.photography}. Color palette: ${BRAND_KIT.aesthetic.palette}. ${BRAND_KIT.aesthetic.mood}.`

type FalImageSize = 'square' | 'square_hd' | 'landscape_16_9' | 'portrait_16_9' | 'portrait_4_3' | 'landscape_4_3'

const SIZE_MAP: Record<string, FalImageSize> = {
  square_1_1: 'square',
  landscape_16_9: 'landscape_16_9',
  portrait_9_16: 'portrait_16_9',
  story_4_5: 'portrait_4_3',
}

export type FlowPostJoined = {
  id: string
  flow_id: string
  sort_order: number
  concept: string
  prompt: string
  generation_mode: 'generate' | 'edit' | 'video'
  target_size: string
  reference_media_id: string | null
  reference_external_url?: string | null
  end_reference_media_id?: string | null
  reference_source_sort_order?: number | null
  end_frame_source_sort_order?: number | null
  generated_media_id: string | null
  status: string
  fal_model: string | null
  reference_media?: { id: string; url: string; file_type: string; s3_key?: string | null } | null
  end_reference_media?: { id: string; url: string; file_type: string; s3_key?: string | null } | null
  generated_media?: {
    id: string
    url: string
    file_type: string
    mime_type?: string | null
    s3_key?: string | null
  } | null
}

export type GenerateFlowPostOk = {
  ok: true
  media: { id: string; url: string; filename: string; file_type: string }
  fal_model: string
  request_id?: string
}

export type GenerateFlowPostErr = { ok: false; error: string }

export function sortFlowPosts(posts: FlowPostJoined[]): FlowPostJoined[] {
  return [...posts].sort((a, b) => a.sort_order - b.sort_order)
}

/** True when prior-segment deps are satisfied and model-specific inputs exist. */
/** Segment already finished with a stored asset URL (S3/CDN via media). */
const SEGMENT_HAS_OUTPUT = ['complete', 'approved', 'maybe'] as const

export function isPostCompleteWithOutput(post: FlowPostJoined): boolean {
  return (
    (SEGMENT_HAS_OUTPUT as readonly string[]).includes(post.status) &&
    !!post.generated_media_id &&
    !!post.generated_media?.url
  )
}

export function segmentDependenciesReady(post: FlowPostJoined, all: FlowPostJoined[]): boolean {
  const ctx = { flow_posts: all }

  if (post.reference_source_sort_order != null) {
    const src = all.find((p) => p.sort_order === post.reference_source_sort_order)
    if (!src || !(SEGMENT_HAS_OUTPUT as readonly string[]).includes(src.status)) return false
    const g = src.generated_media
    if (!g?.url || g.file_type !== 'image') return false
  }

  if (post.end_frame_source_sort_order != null) {
    const src = all.find((p) => p.sort_order === post.end_frame_source_sort_order)
    if (!src || !(SEGMENT_HAS_OUTPUT as readonly string[]).includes(src.status)) return false
    const g = src.generated_media
    if (!g?.url || g.file_type !== 'image') return false
  }

  const primary = resolvePrimaryReferenceUrl(ctx, post)
  const end = resolveEndFrameUrl(ctx, post)
  const mode = post.generation_mode
  const videoModel = resolveFalVideoModel(post.fal_model ?? defaultFalModelForMode('video'))

  if (mode === 'generate') {
    return true
  }
  if (mode === 'edit') {
    return !!primary
  }
  if (mode === 'video') {
    if (videoModelRequiresFirstAndLastFrame(videoModel)) return !!primary && !!end
    if (videoModelRequiresStartImage(videoModel)) return !!primary
    return true
  }
  return false
}

/** All pending/rejected segments whose dependencies are satisfied (sorted). Queue uses only the first for strict order. */
export function pickAllRunnablePosts(all: FlowPostJoined[]): FlowPostJoined[] {
  const sorted = sortFlowPosts(all)
  return sorted.filter(
    (p) =>
      (p.status === 'pending' || p.status === 'rejected') && segmentDependenciesReady(p, all)
  )
}

export function pickNextRunnablePost(all: FlowPostJoined[]): FlowPostJoined | null {
  const runnables = pickAllRunnablePosts(all)
  return runnables[0] ?? null
}

export function flowGenerationComplete(all: FlowPostJoined[]): boolean {
  return all.every((p) => (SEGMENT_HAS_OUTPUT as readonly string[]).includes(p.status))
}

export function countPendingOrRejected(all: FlowPostJoined[]): number {
  return all.filter((p) => p.status === 'pending' || p.status === 'rejected').length
}

/**
 * Run Fal + S3 + DB for one flow post. Caller must ensure dependencies are ready.
 */
export async function generateFlowPostJoined(
  supabase: AdminClient,
  post: FlowPostJoined,
  allPosts: FlowPostJoined[]
): Promise<GenerateFlowPostOk | GenerateFlowPostErr> {
  const ctx = { flow_posts: allPosts }

  await supabase.from('flow_posts').update({ status: 'generating' }).eq('id', post.id)

  try {
    const primarySource = resolvePrimaryReferenceSource(ctx, post)
    const endSource = post.generation_mode === 'video' ? resolveEndFrameSource(ctx, post) : undefined

    const primaryRef = primarySource
      ? await mirrorReferenceImageForFal(primarySource.url, { s3Key: primarySource.s3_key })
      : undefined
    const endRef =
      endSource != null
        ? await mirrorReferenceImageForFal(endSource.url, { s3Key: endSource.s3_key })
        : undefined

    if (post.generation_mode === 'generate') {
      if (primaryRef) {
        return await runEditPipeline(supabase, post, primaryRef)
      }
      return await runImagePipeline(supabase, post)
    }
    if (post.generation_mode === 'edit') {
      if (!primaryRef) {
        throw new Error('Edit mode requires a reference image (library, external URL, or completed prior segment)')
      }
      return await runEditPipeline(supabase, post, primaryRef)
    }
    if (post.generation_mode === 'video') {
      return await runVideoPipeline(supabase, post, primaryRef, endRef)
    }
    throw new Error(`Unknown generation_mode: ${post.generation_mode}`)
  } catch (e) {
    const message = formatFalClientError(e)
    await supabase.from('flow_posts').update({ status: 'pending' }).eq('id', post.id)
    return { ok: false, error: message }
  }
}

async function runImagePipeline(
  supabase: AdminClient,
  post: FlowPostJoined
): Promise<GenerateFlowPostOk | GenerateFlowPostErr> {
  const modelId = resolveFalImageModel(post.fal_model)
  const brandedPrompt = `${post.prompt} ${BRAND_STYLE_SUFFIX}`
  const falSize = SIZE_MAP[post.target_size] || 'square'

  const result = isNanoBanana2ImageModel(modelId)
    ? await fal.subscribe(modelId, {
        input: {
          prompt: brandedPrompt,
          num_images: 1,
          aspect_ratio: targetSizeToNanoAspectRatio(post.target_size),
          output_format: 'png',
          safety_tolerance: '4',
          resolution: '0.5K',
        },
        logs: false,
      })
    : await fal.subscribe(modelId, {
        input: {
          prompt: brandedPrompt,
          image_size: falSize,
          num_images: 1,
        },
        logs: false,
      })

  const images = (result.data as { images?: { url: string }[] }).images
  if (!images?.length) throw new Error('No images returned from fal.ai')

  const media = await saveGeneratedMedia(
    images[0].url,
    `generated-${Date.now()}.png`,
    'image',
    '/studio/generated'
  )

  await supabase
    .from('flow_posts')
    .update({
      generated_media_id: media.id,
      status: 'complete',
      fal_model: modelId,
      generation_metadata: { fal_result: result.data, request_id: result.requestId },
    })
    .eq('id', post.id)

  return { ok: true, media, fal_model: modelId, request_id: result.requestId }
}

async function runEditPipeline(
  supabase: AdminClient,
  post: FlowPostJoined,
  imageUrl: string
): Promise<GenerateFlowPostOk | GenerateFlowPostErr> {
  const modelId = resolveFalEditModel(post.fal_model)
  const brandedPrompt = `${post.prompt} ${BRAND_STYLE_SUFFIX}`
  const falSize = SIZE_MAP[post.target_size] || 'square'

  const input = isNanoBananaEditModel(modelId)
    ? {
        prompt: brandedPrompt,
        image_urls: [imageUrl],
        num_images: 1,
        aspect_ratio: targetSizeToNanoAspectRatio(post.target_size),
        output_format: 'png',
        safety_tolerance: '4',
      }
    : isReduxEditModel(modelId)
      ? {
          prompt: brandedPrompt,
          image_url: imageUrl,
          image_size: falSize,
          num_images: 1,
        }
      : {
          prompt: brandedPrompt,
          image_url: imageUrl,
          strength: 0.75,
          num_images: 1,
        }

  const result = await fal.subscribe(modelId, { input, logs: false })

  const images = (result.data as { images?: { url: string }[] }).images
  if (!images?.length) throw new Error('No images returned from fal.ai')

  const media = await saveGeneratedMedia(
    images[0].url,
    `edited-${Date.now()}.png`,
    'image',
    '/studio/edited'
  )

  await supabase
    .from('flow_posts')
    .update({
      generated_media_id: media.id,
      status: 'complete',
      fal_model: modelId,
      generation_metadata: { fal_result: result.data, request_id: result.requestId },
    })
    .eq('id', post.id)

  return { ok: true, media, fal_model: modelId, request_id: result.requestId }
}

async function runVideoPipeline(
  supabase: AdminClient,
  post: FlowPostJoined,
  primaryRef: string | undefined,
  endRef: string | undefined
): Promise<GenerateFlowPostOk | GenerateFlowPostErr> {
  const modelId = resolveFalVideoModel(post.fal_model)
  assertVideoInputsValid(modelId, primaryRef, endRef)

  const usePrimary = videoModelRequiresStartImage(modelId) || videoModelRequiresFirstAndLastFrame(modelId)
  const imageUrl = usePrimary ? primaryRef : undefined
  const endImageUrl = videoModelRequiresFirstAndLastFrame(modelId) ? endRef : undefined

  const input = buildVideoFalInput(modelId, post.prompt, imageUrl, endImageUrl, post.target_size)

  const result = await fal.subscribe(modelId, { input, logs: false })

  const video = (result.data as { video?: { url: string } }).video
  if (!video?.url) throw new Error('No video returned from fal.ai')

  const media = await saveGeneratedMedia(
    video.url,
    `video-${Date.now()}.mp4`,
    'video',
    '/studio/videos'
  )

  await supabase
    .from('flow_posts')
    .update({
      generated_media_id: media.id,
      status: 'complete',
      fal_model: modelId,
      generation_metadata: { fal_result: result.data, request_id: result.requestId },
    })
    .eq('id', post.id)

  return { ok: true, media, fal_model: modelId, request_id: result.requestId }
}

export async function loadFlowPostsJoined(
  supabase: AdminClient,
  flowId: string
): Promise<FlowPostJoined[]> {
  const { data, error } = await supabase
    .from('flow_posts')
    .select(
      `
      *,
      reference_media:media!flow_posts_reference_media_id_fkey(id, filename, url, file_type, s3_key, is_private),
      end_reference_media:media!flow_posts_end_reference_media_id_fkey(id, filename, url, file_type, s3_key, is_private),
      generated_media:media!flow_posts_generated_media_id_fkey(id, filename, url, file_type, mime_type, s3_key, is_private)
    `
    )
    .eq('flow_id', flowId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as FlowPostJoined[]
  return rows.map((p) => patchFlowPostMediaRefs(p as Record<string, unknown>) as FlowPostJoined)
}
