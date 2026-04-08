import { BRAND_KIT } from '@/lib/brand-kit'
import {
  FAL_VIDEO_FIRST_LAST_MODEL,
  resolveFalVideoModel,
  videoModelRequiresFirstAndLastFrame,
  videoModelRequiresStartImage,
} from '@/lib/fal-generate-models'

const KLING_MODELS = new Set([
  'fal-ai/kling-video/v2/master/image-to-video',
  'fal-ai/kling-video/v2.1/master/image-to-video',
])

const VEO2_I2V = 'fal-ai/veo2/image-to-video'
const VEO2_T2V = 'fal-ai/veo2'

const VEO3_I2V = 'fal-ai/veo3/image-to-video'
const VEO31_I2V = 'fal-ai/veo3.1/image-to-video'
const VEO31_FIRST_LAST = FAL_VIDEO_FIRST_LAST_MODEL

const VEO3_T2V = new Set(['fal-ai/veo3', 'fal-ai/veo3/fast'])
const VEO31_T2V = 'fal-ai/veo3.1'

function veoAspectFromTargetSize(
  targetSize: string,
  mode: 'veo2_t2v' | 'veo3_t2v'
): string {
  switch (targetSize) {
    case 'landscape_16_9':
      return '16:9'
    case 'portrait_9_16':
    case 'story_4_5':
      return '9:16'
    case 'square_1_1':
      return mode === 'veo2_t2v' ? '1:1' : '16:9'
    default:
      return '16:9'
  }
}

function veo3FamilyI2vAspect(targetSize: string): 'auto' | '16:9' | '9:16' {
  switch (targetSize) {
    case 'landscape_16_9':
      return '16:9'
    case 'portrait_9_16':
    case 'story_4_5':
      return '9:16'
    default:
      return 'auto'
  }
}

export function buildVideoFalInput(
  modelId: string,
  prompt: string,
  imageUrl: string | undefined,
  endImageUrl: string | undefined,
  targetSize: string
): Record<string, unknown> {
  const brandedPrompt = `${prompt} Mood: ${BRAND_KIT.aesthetic.mood}. Cinematic, slow motion, dramatic lighting.`

  if (modelId === VEO31_FIRST_LAST) {
    if (!imageUrl || !endImageUrl) {
      throw new Error('First and last frame image URLs are required for Veo 3.1 first-last-frame')
    }
    return {
      prompt: brandedPrompt,
      first_frame_url: imageUrl,
      last_frame_url: endImageUrl,
      duration: '6s',
      aspect_ratio: veo3FamilyI2vAspect(targetSize),
      resolution: '720p',
      generate_audio: false,
      auto_fix: true,
      safety_tolerance: '4',
    }
  }

  if (KLING_MODELS.has(modelId)) {
    if (!imageUrl) throw new Error('Reference image is required for Kling image-to-video')
    return {
      prompt: brandedPrompt,
      image_url: imageUrl,
      duration: '5',
    }
  }

  if (modelId === VEO2_I2V) {
    if (!imageUrl) throw new Error('Reference image is required for Veo 2 image-to-video')
    return {
      prompt: brandedPrompt,
      image_url: imageUrl,
      duration: '6s',
    }
  }

  if (modelId === VEO3_I2V || modelId === VEO31_I2V) {
    if (!imageUrl) throw new Error('Reference image is required for Veo image-to-video')
    return {
      prompt: brandedPrompt,
      image_url: imageUrl,
      duration: '6s',
      aspect_ratio: veo3FamilyI2vAspect(targetSize),
      resolution: '720p',
      generate_audio: false,
      auto_fix: true,
      safety_tolerance: '4',
    }
  }

  if (modelId === VEO2_T2V) {
    return {
      prompt: brandedPrompt,
      aspect_ratio: veoAspectFromTargetSize(targetSize, 'veo2_t2v'),
      duration: '6s',
      auto_fix: true,
    }
  }

  if (VEO3_T2V.has(modelId)) {
    const aspectRatio = veoAspectFromTargetSize(targetSize, 'veo3_t2v') as '16:9' | '9:16'
    return {
      prompt: brandedPrompt,
      aspect_ratio: aspectRatio,
      duration: '6s',
      resolution: '720p',
      generate_audio: false,
      auto_fix: true,
      safety_tolerance: '2',
    }
  }

  if (modelId === VEO31_T2V) {
    const aspectRatio = veoAspectFromTargetSize(targetSize, 'veo3_t2v') as '16:9' | '9:16'
    return {
      prompt: brandedPrompt,
      aspect_ratio: aspectRatio,
      duration: '6s',
      resolution: '720p',
      generate_audio: false,
      auto_fix: true,
      safety_tolerance: '4',
    }
  }

  throw new Error(`Unsupported video model: ${modelId}`)
}

export function assertVideoInputsValid(
  modelId: string,
  imageUrl: string | undefined,
  endImageUrl: string | undefined
): void {
  const resolved = resolveFalVideoModel(modelId)
  if (videoModelRequiresFirstAndLastFrame(resolved)) {
    if (!imageUrl || !endImageUrl) {
      throw new Error('This model needs a start frame and an end frame')
    }
  } else if (videoModelRequiresStartImage(resolved) && !imageUrl) {
    throw new Error('This model requires a start (reference) image')
  }
}
