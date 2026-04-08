import { fal, saveGeneratedMedia } from '@/lib/fal'
import { mirrorReferenceImageForFal } from '@/lib/fal-reference-mirror'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRAND_KIT } from '@/lib/brand-kit'
import {
  isFlux2EditModel,
  isNanoBananaEditModel,
  isReduxEditModel,
  resolveFalEditModel,
  targetSizeToNanoAspectRatio,
} from '@/lib/fal-generate-models'
import { NextRequest, NextResponse } from 'next/server'

type FalImageSize = 'square' | 'square_hd' | 'landscape_16_9' | 'portrait_16_9' | 'portrait_4_3' | 'landscape_4_3'

const SIZE_MAP: Record<string, FalImageSize> = {
  square_1_1: 'square',
  landscape_16_9: 'landscape_16_9',
  portrait_9_16: 'portrait_16_9',
  story_4_5: 'portrait_4_3',
}

const BRAND_STYLE_SUFFIX = `Style: ${BRAND_KIT.aesthetic.photography}. Color palette: ${BRAND_KIT.aesthetic.palette}. ${BRAND_KIT.aesthetic.mood}.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, image_url, flow_post_id, fal_model: falModelRequested, image_size = 'square_1_1' } = body

    if (!prompt || !image_url) {
      return NextResponse.json({ error: 'Prompt and image_url are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (flow_post_id) {
      await supabase
        .from('flow_posts')
        .update({ status: 'generating' })
        .eq('id', flow_post_id)
    }

    const modelId = resolveFalEditModel(falModelRequested)
    const falSize = SIZE_MAP[image_size] || 'square'

    const brandedPrompt = `${prompt} ${BRAND_STYLE_SUFFIX}`
    const mirroredImageUrl = await mirrorReferenceImageForFal(image_url)

    let input: Record<string, unknown>
    if (isNanoBananaEditModel(modelId)) {
      input = {
        prompt: brandedPrompt,
        image_urls: [mirroredImageUrl],
        num_images: 1,
        aspect_ratio: targetSizeToNanoAspectRatio(image_size),
        output_format: 'png',
        safety_tolerance: '4',
      }
    } else if (isFlux2EditModel(modelId)) {
      input = {
        prompt: brandedPrompt,
        image_urls: [mirroredImageUrl],
        image_size: falSize,
        output_format: 'png',
        safety_tolerance: '5',
      }
    } else if (isReduxEditModel(modelId)) {
      input = {
        prompt: brandedPrompt,
        image_url: mirroredImageUrl,
        image_size: falSize,
        num_images: 1,
      }
    } else {
      input = {
        prompt: brandedPrompt,
        image_url: mirroredImageUrl,
        strength: 0.75,
        num_images: 1,
      }
    }

    const result = await fal.subscribe(modelId, {
      input,
      logs: false,
    })

    const images = (result.data as { images?: { url: string }[] }).images
    if (!images?.length) {
      throw new Error('No images returned from fal.ai')
    }

    const imageUrl = images[0].url
    const media = await saveGeneratedMedia(
      imageUrl,
      `edited-${Date.now()}.png`,
      'image',
      '/studio/edited'
    )

    if (flow_post_id) {
      await supabase
        .from('flow_posts')
        .update({
          generated_media_id: media.id,
          status: 'complete',
          fal_model: modelId,
          generation_metadata: { fal_result: result.data, request_id: result.requestId },
        })
        .eq('id', flow_post_id)
    }

    return NextResponse.json({
      media,
      fal_model: modelId,
      request_id: result.requestId,
    })
  } catch (error) {
    console.error('Image edit failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Image edit failed: ${message}` }, { status: 500 })
  }
}
