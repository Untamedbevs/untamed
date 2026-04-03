import { fal, saveGeneratedMedia } from '@/lib/fal'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRAND_KIT } from '@/lib/brand-kit'
import {
  FAL_VIDEO_FIRST_LAST_MODEL,
  resolveFalVideoModel,
  videoModelRequiresFirstAndLastFrame,
  videoModelRequiresStartImage,
} from '@/lib/fal-generate-models'
import { NextRequest, NextResponse } from 'next/server'

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

function buildVideoInput(
  modelId: string,
  brandedPrompt: string,
  imageUrl: string | undefined,
  endImageUrl: string | undefined,
  targetSize: string
): Record<string, unknown> {
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

export async function POST(request: NextRequest) {
  let flowPostId: string | undefined

  try {
    const body = await request.json()
    const {
      prompt,
      image_url: imageUrl,
      end_image_url: endImageUrl,
      flow_post_id,
      fal_model: falModelRequested,
      target_size: targetSize = 'square_1_1',
    } = body

    flowPostId = flow_post_id

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const modelId = resolveFalVideoModel(falModelRequested)

    if (videoModelRequiresFirstAndLastFrame(modelId)) {
      if (!imageUrl || !endImageUrl) {
        return NextResponse.json(
          {
            error:
              'This model needs a start frame and an end frame. Choose both from the queue or library, or pick another video model.',
          },
          { status: 400 }
        )
      }
    } else if (videoModelRequiresStartImage(modelId) && !imageUrl) {
      return NextResponse.json(
        {
          error:
            'This model requires a start (reference) image. Pick an earlier queue output or library image, or use a text-to-video Veo model.',
        },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    if (flowPostId) {
      await supabase
        .from('flow_posts')
        .update({ status: 'generating' })
        .eq('id', flowPostId)
    }

    const brandedPrompt = `${prompt} Mood: ${BRAND_KIT.aesthetic.mood}. Cinematic, slow motion, dramatic lighting.`

    const input = buildVideoInput(modelId, brandedPrompt, imageUrl, endImageUrl, targetSize)

    const result = await fal.subscribe(modelId, {
      input,
      logs: false,
    })

    const video = (result.data as { video?: { url: string } }).video
    if (!video?.url) {
      throw new Error('No video returned from fal.ai')
    }

    const media = await saveGeneratedMedia(
      video.url,
      `video-${Date.now()}.mp4`,
      'video',
      '/studio/videos'
    )

    if (flowPostId) {
      await supabase
        .from('flow_posts')
        .update({
          generated_media_id: media.id,
          status: 'complete',
          fal_model: modelId,
          generation_metadata: { fal_result: result.data, request_id: result.requestId },
        })
        .eq('id', flowPostId)
    }

    return NextResponse.json({
      media,
      fal_model: modelId,
      request_id: result.requestId,
    })
  } catch (error) {
    console.error('Video generation failed:', error)

    if (flowPostId) {
      try {
        const supabase = createAdminClient()
        await supabase
          .from('flow_posts')
          .update({ status: 'pending' })
          .eq('id', flowPostId)
      } catch {
        /* ignore */
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Video generation failed: ${message}` }, { status: 500 })
  }
}
