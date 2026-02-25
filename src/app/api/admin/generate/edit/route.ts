import { fal, saveGeneratedMedia } from '@/lib/fal'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRAND_KIT } from '@/lib/brand-kit'
import { NextRequest, NextResponse } from 'next/server'

const BRAND_STYLE_SUFFIX = `Style: ${BRAND_KIT.aesthetic.photography}. Color palette: ${BRAND_KIT.aesthetic.palette}. ${BRAND_KIT.aesthetic.mood}.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, image_url, flow_post_id } = body

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

    const modelId = 'fal-ai/flux/dev/image-to-image'

    const brandedPrompt = `${prompt} ${BRAND_STYLE_SUFFIX}`

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: brandedPrompt,
        image_url,
        strength: 0.75,
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
