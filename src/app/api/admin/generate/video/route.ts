import { fal, saveGeneratedMedia } from '@/lib/fal'
import { mirrorReferenceImageForFal } from '@/lib/fal-reference-mirror'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertVideoInputsValid, buildVideoFalInput } from '@/lib/flow/fal-video-input'
import { resolveFalVideoModel } from '@/lib/fal-generate-models'
import { NextRequest, NextResponse } from 'next/server'

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

    try {
      assertVideoInputsValid(modelId, imageUrl, endImageUrl)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid video inputs'
      if (msg.includes('start frame and an end frame')) {
        return NextResponse.json(
          {
            error:
              'This model needs a start frame and an end frame. Choose both from the queue or library, or pick another video model.',
          },
          { status: 400 }
        )
      }
      if (msg.includes('requires a start')) {
        return NextResponse.json(
          {
            error:
              'This model requires a start (reference) image. Pick an earlier queue output or library image, or use a text-to-video Veo model.',
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (flowPostId) {
      await supabase
        .from('flow_posts')
        .update({ status: 'generating' })
        .eq('id', flowPostId)
    }

    const mirroredStart = imageUrl ? await mirrorReferenceImageForFal(imageUrl) : undefined
    const mirroredEnd = endImageUrl ? await mirrorReferenceImageForFal(endImageUrl) : undefined

    const input = buildVideoFalInput(modelId, prompt, mirroredStart, mirroredEnd, targetSize)

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
