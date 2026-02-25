import { generateObject } from 'ai'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getBrandPromptContext } from '@/lib/brand-kit'

const postSchema = z.object({
  posts: z.array(
    z.object({
      sort_order: z.number(),
      concept: z.string().describe('What this post should convey to the audience'),
      prompt: z.string().describe('Detailed image generation prompt for fal.ai — describe the scene, subjects, lighting, mood, color palette, composition, and camera angle in vivid detail. Do NOT include text overlays in the prompt.'),
      generation_mode: z.enum(['generate', 'edit', 'video']),
      target_size: z.enum(['square_1_1', 'landscape_16_9', 'portrait_9_16', 'story_4_5']),
      caption_suggestion: z.string().describe('Social media caption matching brand voice — short, punchy, confident'),
      hashtag_suggestions: z.array(z.string()),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { concept, reference_media_urls, platform_targets, post_count, content_mix, model } = body

    if (!concept) {
      return NextResponse.json({ error: 'Campaign concept is required' }, { status: 400 })
    }

    const brandContext = getBrandPromptContext()

    const platformContext = platform_targets?.length
      ? `Target platforms: ${platform_targets.join(', ')}.`
      : ''

    const mediaContext = reference_media_urls?.length
      ? `The brand has ${reference_media_urls.length} reference image(s) available. For posts that should use existing brand imagery, set generation_mode to "edit". For fresh visuals, use "generate". For motion content, use "video".`
      : 'No reference images provided, so all posts should use generation_mode "generate" or "video".'

    const mixContext = content_mix === 'mixed'
      ? 'Include a mix of static images and 1-2 short video posts for variety. You may use generation_mode "video" for those.'
      : 'IMPORTANT: This is an images-only campaign. Set generation_mode to "generate" for ALL posts. Do NOT use "video" mode.'

    const sizeGuidance = `Size guidance by platform:
- Instagram feed: square_1_1
- Instagram/TikTok stories/reels: story_4_5 or portrait_9_16
- Facebook/X/YouTube: landscape_16_9
- General purpose: square_1_1`

    const result = await generateObject({
      model: model || 'google/gemini-2.5-flash',
      schema: postSchema,
      prompt: `You are a creative director working on a social media campaign. Here is the brand you are creating for:

${brandContext}

---

Create a sequence of ${post_count || 8} social media posts for this campaign concept:

"${concept}"

${platformContext}
${mediaContext}
${mixContext}
${sizeGuidance}

PROMPT WRITING RULES:
- Each image prompt must be a detailed visual description for an AI image generator (fal.ai Flux)
- Describe: subject, environment, lighting, color palette, camera angle, mood, texture, and style
- Always incorporate the brand's visual identity: deep blacks, neon accents, dramatic lighting, wet/reflective surfaces, smoke elements
- For drink-focused shots: describe the cocktail glass, liquid color, garnish, and setting in detail
- Do NOT include text/typography in image prompts — text gets added in post-production
- Style reference: high-end beverage advertising meets moody nightlife editorial photography

CAPTION RULES:
- Match the brand voice: confident, provocative, premium
- Short punchy lines, no exclamation marks
- Use predator/animal metaphors where natural
- Always include core hashtags (#Untamed #UntamedBevs) plus relevant secondary ones

SEQUENCE RULES:
- Tell a story across the posts — each one should build on the last
- If this is a teaser/whisper campaign, start abstract and mysterious, then gradually reveal the product
- Vary the visual compositions to keep the feed dynamic
- Mix close-up product shots with lifestyle/atmosphere shots`,
    })

    return NextResponse.json(result.object)
  } catch (error) {
    console.error('Plan generation failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Plan generation failed: ${message}` }, { status: 500 })
  }
}
