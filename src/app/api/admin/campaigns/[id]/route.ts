import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      created_by_staff:staff!campaigns_created_by_fkey(full_name),
      idea:ideas!campaigns_idea_id_fkey(id, title),
      campaign_media(
        id,
        sort_order,
        platform_variant,
        media:media!campaign_media_media_id_fkey(id, filename, url, file_type, mime_type)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()

  const { media_ids, ...updates } = body

  const updatePayload: Record<string, unknown> = {}
  if (updates.title !== undefined) updatePayload.title = updates.title
  if (updates.description !== undefined) updatePayload.description = updates.description
  if (updates.status !== undefined) updatePayload.status = updates.status
  if (updates.category !== undefined) updatePayload.category = updates.category
  if (updates.platforms !== undefined) updatePayload.platforms = updates.platforms
  if (updates.scheduled_date !== undefined) updatePayload.scheduled_date = updates.scheduled_date
  if (updates.posted_date !== undefined) updatePayload.posted_date = updates.posted_date
  if (updates.caption !== undefined) updatePayload.caption = updates.caption
  if (updates.hashtags !== undefined) updatePayload.hashtags = updates.hashtags
  if (updates.idea_id !== undefined) updatePayload.idea_id = updates.idea_id

  const { data, error } = await supabase
    .from('campaigns')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (media_ids !== undefined) {
    await supabase.from('campaign_media').delete().eq('campaign_id', id)

    if (media_ids.length) {
      const mediaInserts = media_ids.map((mediaId: string, index: number) => ({
        campaign_id: id,
        media_id: mediaId,
        sort_order: index,
      }))
      await supabase.from('campaign_media').insert(mediaInserts)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase.from('campaigns').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
