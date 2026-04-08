import { createAdminClient } from '@/lib/supabase/admin'
import { publishToFacebook, publishToInstagram, type PublishResult } from '@/lib/social/meta-publish'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: duePosts, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!duePosts || duePosts.length === 0) {
    return NextResponse.json({ published: 0 })
  }

  let publishedCount = 0

  for (const post of duePosts) {
    await supabase
      .from('scheduled_posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', post.id)

    const mediaIds: string[] = post.media_ids || []
    let mediaUrls: { id: string; url: string; file_type: string }[] = []

    if (mediaIds.length > 0) {
      const { data: rows } = await supabase
        .from('media')
        .select('id, url, file_type')
        .in('id', mediaIds)
      mediaUrls = rows || []
    }

    const platforms: string[] = post.platforms || []
    const caption = post.caption || ''
    const results: PublishResult[] = []

    const primaryImage = mediaUrls.find((m) => m.file_type === 'image')
    const primaryVideo = mediaUrls.find((m) => m.file_type === 'video')
    const allUrls = mediaUrls.map((m) => m.url)

    for (const platform of platforms) {
      if (platform === 'facebook') {
        results.push(
          await publishToFacebook({
            imageUrl: primaryImage?.url,
            videoUrl: primaryVideo?.url,
            caption,
          })
        )
      } else if (platform === 'instagram') {
        results.push(
          await publishToInstagram({
            imageUrl: primaryImage?.url,
            videoUrl: primaryVideo?.url,
            caption,
            carouselUrls: allUrls.length > 1 ? allUrls : undefined,
          })
        )
      } else {
        results.push({
          platform,
          success: false,
          error: `Manual posting required for ${platform}`,
        })
      }
    }

    const allOk = results.every((r) => r.success || r.error?.includes('Manual'))
    const status = allOk ? 'posted' : 'failed'

    await supabase
      .from('scheduled_posts')
      .update({
        status,
        posted_at: status === 'posted' ? new Date().toISOString() : null,
        publish_result: results,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)

    if (status === 'posted') publishedCount++
  }

  return NextResponse.json({ published: publishedCount, total: duePosts.length })
}
