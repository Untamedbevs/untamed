import { createAdminClient } from '@/lib/supabase/admin'
import { publishToFacebook, publishToInstagram, type PublishResult } from '@/lib/social/meta-publish'
import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'

/**
 * Statuses staff may publish from (the route has always allowed everything
 * but 'posted'). 'publishing' is left out: that row is being posted right
 * now, by the cron or another click.
 */
const PUBLISHABLE_STATUSES = ['scheduled', 'failed', 'cancelled']
/**
 * A 'publishing' row untouched this long is treated as stuck (its run died
 * before recording a result), so staff can still publish it as before. The
 * cron runs every 15 minutes and posts at most 10 items per run.
 */
const STUCK_PUBLISHING_MS = 60 * 60 * 1000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Claim atomically, like the cron: only the request that moves the row into
  // 'publishing' posts it, so a click racing the cron (or a second click)
  // cannot post the same item twice.
  const claimedAt = new Date().toISOString()
  const claim = await supabase
    .from('scheduled_posts')
    .update({ status: 'publishing', updated_at: claimedAt })
    .eq('id', id)
    .in('status', PUBLISHABLE_STATUSES)
    .select('id')
  if (claim.error) {
    console.error('[admin/schedule/publish] claim failed', id, claim.error.message)
    return NextResponse.json({ error: 'Could not publish' }, { status: 500 })
  }
  let claimed = (claim.data || []).length > 0
  if (!claimed && post.status === 'publishing') {
    const stuck = await supabase
      .from('scheduled_posts')
      .update({ status: 'publishing', updated_at: claimedAt })
      .eq('id', id)
      .eq('status', 'publishing')
      .lt('updated_at', new Date(Date.now() - STUCK_PUBLISHING_MS).toISOString())
      .select('id')
    if (stuck.error) {
      console.error('[admin/schedule/publish] claim failed', id, stuck.error.message)
      return NextResponse.json({ error: 'Could not publish' }, { status: 500 })
    }
    claimed = (stuck.data || []).length > 0
  }
  if (!claimed) {
    return NextResponse.json(
      { error: 'This post is already being published or was just posted' },
      { status: 409 }
    )
  }

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
