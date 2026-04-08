/**
 * Allowed fal.ai endpoints for studio generation. IDs are validated server-side.
 */

export const FAL_DEFAULT_IMAGE_MODEL = 'fal-ai/nano-banana-2'
export const FAL_DEFAULT_EDIT_MODEL = 'fal-ai/nano-banana-pro/edit'
export const FAL_DEFAULT_VIDEO_MODEL = 'fal-ai/kling-video/v2/master/image-to-video'

export const NANO_BANANA_2_MODEL_ID = 'fal-ai/nano-banana-2' as const
export const NANO_BANANA_EDIT_MODEL_ID = 'fal-ai/nano-banana/edit' as const
export const NANO_BANANA_PRO_EDIT_MODEL_ID = 'fal-ai/nano-banana-pro/edit' as const

/** Map studio `target_size` to Nano Banana `aspect_ratio` enum values. */
export function targetSizeToNanoAspectRatio(imageSize: string): string {
  const map: Record<string, string> = {
    square_1_1: '1:1',
    landscape_16_9: '16:9',
    portrait_9_16: '9:16',
    story_4_5: '4:5',
  }
  return map[imageSize] ?? '1:1'
}

export function isNanoBanana2ImageModel(modelId: string): boolean {
  return modelId === NANO_BANANA_2_MODEL_ID
}

export function isNanoBananaEditModel(modelId: string): boolean {
  return (
    modelId === NANO_BANANA_EDIT_MODEL_ID ||
    modelId === NANO_BANANA_PRO_EDIT_MODEL_ID
  )
}

export const FAL_IMAGE_MODELS = [
  { id: 'fal-ai/flux-2-pro', label: 'Flux 2 Pro' },
  { id: 'fal-ai/flux-2', label: 'Flux 2 Dev' },
  { id: 'fal-ai/flux/dev', label: 'Flux 1 Dev (legacy)' },
  { id: 'fal-ai/flux-pro/v1.1', label: 'Flux Pro 1.1 (legacy)' },
  { id: NANO_BANANA_2_MODEL_ID, label: 'Nano Banana 2 (fast / cheap test)' },
] as const

export const FAL_EDIT_MODELS = [
  { id: 'fal-ai/flux-2-pro/edit', label: 'Flux 2 Pro Edit' },
  { id: 'fal-ai/flux/dev/image-to-image', label: 'Flux 1 Dev (image to image, legacy)' },
  { id: 'fal-ai/flux-pro/v1.1/redux', label: 'Flux Pro 1.1 Redux (legacy)' },
  { id: NANO_BANANA_EDIT_MODEL_ID, label: 'Nano Banana edit (cheap test)' },
  { id: NANO_BANANA_PRO_EDIT_MODEL_ID, label: 'Nano Banana Pro edit' },
] as const

export const FAL_VIDEO_MODELS = [
  { id: 'fal-ai/kling-video/v2/master/image-to-video', label: 'Kling 2.0 Master (image to video)' },
  { id: 'fal-ai/kling-video/v2.1/master/image-to-video', label: 'Kling 2.1 Master (image to video)' },
  { id: 'fal-ai/veo2/image-to-video', label: 'Google Veo 2 (image to video)' },
  { id: 'fal-ai/veo3/image-to-video', label: 'Google Veo 3 (image to video)' },
  { id: 'fal-ai/veo3.1/image-to-video', label: 'Google Veo 3.1 (image to video)' },
  {
    id: 'fal-ai/veo3.1/first-last-frame-to-video',
    label: 'Google Veo 3.1 (first and last frame)',
  },
  { id: 'fal-ai/veo2', label: 'Google Veo 2 (text to video)' },
  { id: 'fal-ai/veo3', label: 'Google Veo 3 (text to video)' },
  { id: 'fal-ai/veo3/fast', label: 'Google Veo 3 Fast (text to video)' },
  { id: 'fal-ai/veo3.1', label: 'Google Veo 3.1 (text to video)' },
] as const

/** Single start-image image-to-video (Kling, Veo i2v). */
const VIDEO_SINGLE_START_I2V_MODEL_IDS = new Set<string>([
  'fal-ai/kling-video/v2/master/image-to-video',
  'fal-ai/kling-video/v2.1/master/image-to-video',
  'fal-ai/veo2/image-to-video',
  'fal-ai/veo3/image-to-video',
  'fal-ai/veo3.1/image-to-video',
])

const VIDEO_TEXT_TO_VIDEO_ONLY_MODEL_IDS = new Set<string>([
  'fal-ai/veo2',
  'fal-ai/veo3',
  'fal-ai/veo3/fast',
  'fal-ai/veo3.1',
])

export const FAL_VIDEO_FIRST_LAST_MODEL = 'fal-ai/veo3.1/first-last-frame-to-video'

/** True if the model needs a first (start) frame URL. */
export function videoModelRequiresStartImage(modelId: string): boolean {
  return (
    VIDEO_SINGLE_START_I2V_MODEL_IDS.has(modelId) || modelId === FAL_VIDEO_FIRST_LAST_MODEL
  )
}

/** True if the model needs both first and last frame URLs. */
export function videoModelRequiresFirstAndLastFrame(modelId: string): boolean {
  return modelId === FAL_VIDEO_FIRST_LAST_MODEL
}

/** Prompt-only video models (no frame URLs). */
export function videoModelIsTextToVideoOnly(modelId: string): boolean {
  return VIDEO_TEXT_TO_VIDEO_ONLY_MODEL_IDS.has(modelId)
}

/** @deprecated Use videoModelRequiresStartImage */
export function videoModelRequiresReferenceImage(modelId: string): boolean {
  return videoModelRequiresStartImage(modelId)
}

const ALLOWED_IMAGE = new Set<string>(FAL_IMAGE_MODELS.map((m) => m.id))
const ALLOWED_EDIT = new Set<string>(FAL_EDIT_MODELS.map((m) => m.id))
const ALLOWED_VIDEO = new Set<string>(FAL_VIDEO_MODELS.map((m) => m.id))

export function resolveFalImageModel(requested?: string | null): string {
  if (requested && ALLOWED_IMAGE.has(requested)) return requested
  return FAL_DEFAULT_IMAGE_MODEL
}

export function resolveFalEditModel(requested?: string | null): string {
  if (requested && ALLOWED_EDIT.has(requested)) return requested
  return FAL_DEFAULT_EDIT_MODEL
}

export function resolveFalVideoModel(requested?: string | null): string {
  if (requested && ALLOWED_VIDEO.has(requested)) return requested
  return FAL_DEFAULT_VIDEO_MODEL
}

export function defaultFalModelForMode(mode: 'generate' | 'edit' | 'video'): string {
  if (mode === 'edit') return FAL_DEFAULT_EDIT_MODEL
  if (mode === 'video') return FAL_DEFAULT_VIDEO_MODEL
  return FAL_DEFAULT_IMAGE_MODEL
}

export function isReduxEditModel(modelId: string): boolean {
  return modelId === 'fal-ai/flux-pro/v1.1/redux'
}

export function isFlux2Model(modelId: string): boolean {
  return modelId.startsWith('fal-ai/flux-2')
}

export function isFlux2EditModel(modelId: string): boolean {
  return modelId === 'fal-ai/flux-2-pro/edit'
}
