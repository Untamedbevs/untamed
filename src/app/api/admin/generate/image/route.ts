import { fal, saveGeneratedMedia } from '@/lib/fal'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRAND_KIT } from '@/lib/brand-kit'
import { NextRequest, NextResponse } from 'next/server'

const BRAND_STYLE_SUFFIX = `Style: ${BRAND_KIT.aesthetic.photography}. Color palette: ${BRAND_KIT.aesthetic.palette}. ${BRAND_KIT.aesthetic.mood}.`

type FalImageSize = 'square' | 'square_hd' | 'landscape_16_9' | 'portrait_16_9' | 'portrait_4_3' | 'landscape_4_3'

const SIZE_MAP: Record<string, FalImageSize> = {
  square_1_1: 'square',
  landscape_16_9: 'landscape_16_9',
  portrait_9_16: 'portrait_16_9',
  story_4_5: 'portrait_4_3',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, image_size = 'square_1_1', flow_post_id } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (flow_post_id) {
      await supabase
        .from('flow_posts')
        .update({ status: 'generating' })
        .eq('id', flow_post_id)
    }

    const falSize = SIZE_MAP[image_size] || 'square'
    const modelId = 'fal-ai/flux/dev'

    const brandedPrompt = `${prompt} ${BRAND_STYLE_SUFFIX}`

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: brandedPrompt,
        image_size: falSize,
        num_images: 1,
      },
      logs: false,
    })

    const images = (result.data as { images?: { url: string }[] }).images
    if (!images?.length) {
      throw new Error('No images returned from fal.ai')
    }

    const imageUrl = images[0].url
    const media = await saveGeneratedMedia(
      imageUrl,
      `generated-${Date.now()}.png`,
      'image',
      '/studio/generated'
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
    console.error('Image generation failed:', error)

    if (request.body) {
      try {
        const body = await request.clone().json()
        if (body.flow_post_id) {
          const supabase = createAdminClient()
          await supabase
            .from('flow_posts')
            .update({ status: 'pending' })
            .eq('id', body.flow_post_id)
        }
      } catch { /* ignore parse errors on error path */ }
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 500 })
  }
}
