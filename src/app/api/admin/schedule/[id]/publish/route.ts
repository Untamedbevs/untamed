import { createAdminClient } from '@/lib/supabase/admin'
import { publishToFacebook, publishToInstagram, type PublishResult } from '@/lib/social/meta-publish'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: post, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !post) {
    return NextResponse.json({ error: 'Scheduled post not found' }, { status: 404 })
  }

  if (post.status === 'posted') {
    return NextResponse.json({ error: 'Already posted' }, { status: 400 })
  }

  await supabase
    .from('scheduled_posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', id)

  const mediaIds: string[] = post.media_ids || []
  let mediaUrls: { id: string; url: string; file_type: string }[] = []

  if (mediaIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('media')
      .select('id, url, file_type')
      .in('id', mediaIds)

    mediaUrls = mediaRows || []
  }

  const platforms: string[] = post.platforms || []
  const hashtags = (post.hashtags || []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')
  const captionParts = [post.title, post.caption, post.body, hashtags].filter(Boolean)
  const caption = captionParts.join('\n\n')
  const results: PublishResult[] = []

  const primaryImage = mediaUrls.find((m) => m.file_type === 'image')
  const primaryVideo = mediaUrls.find((m) => m.file_type === 'video')
  const allUrls = mediaUrls.map((m) => m.url)

  for (const platform of platforms) {
    if (platform === 'facebook') {
      const result = await publishToFacebook({
        imageUrl: primaryImage?.url,
        videoUrl: primaryVideo?.url,
        caption,
        scheduledAt: post.scheduled_at ? new Date(post.scheduled_at) : undefined,
      })
      results.push(result)
    } else if (platform === 'instagram') {
      const result = await publishToInstagram({
        imageUrl: primaryImage?.url,
        videoUrl: primaryVideo?.url,
        caption,
        carouselUrls: allUrls.length > 1 ? allUrls : undefined,
      })
      results.push(result)
    } else {
      results.push({
        platform,
        success: false,
        error: `Manual posting required for ${platform}. Download assets from the schedule page.`,
      })
    }
  }

  const allSucceeded = results.every((r) => r.success || r.error?.includes('Manual'))
  const finalStatus = allSucceeded ? 'posted' : 'failed'

  await supabase
    .from('scheduled_posts')
    .update({
      status: finalStatus,
      posted_at: finalStatus === 'posted' ? new Date().toISOString() : null,
      publish_result: results,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({ status: finalStatus, results })
}
