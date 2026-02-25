import { fal, saveGeneratedMedia } from '@/lib/fal'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRAND_KIT } from '@/lib/brand-kit'
import { NextRequest, NextResponse } from 'next/server'

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

    const modelId = 'fal-ai/kling-video/v2/master/image-to-video'

    const brandedPrompt = `${prompt} Mood: ${BRAND_KIT.aesthetic.mood}. Cinematic, slow motion, dramatic lighting.`

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: brandedPrompt,
        image_url,
        duration: '5',
      },
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
    console.error('Video generation failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Video generation failed: ${message}` }, { status: 500 })
  }
}
