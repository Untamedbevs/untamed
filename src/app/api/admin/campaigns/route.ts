import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const platform = searchParams.get('platform')
  const search = searchParams.get('search')

  let query = supabase
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
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (platform) query = query.contains('platforms', [platform])
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const { media_ids, ...campaignData } = body

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      title: campaignData.title,
      description: campaignData.description || null,
      status: campaignData.status || 'draft',
      category: campaignData.category || null,
      platforms: campaignData.platforms || [],
      scheduled_date: campaignData.scheduled_date || null,
      caption: campaignData.caption || null,
      hashtags: campaignData.hashtags || [],
      idea_id: campaignData.idea_id || null,
      created_by: campaignData.created_by || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (media_ids?.length) {
    const mediaInserts = media_ids.map((mediaId: string, index: number) => ({
      campaign_id: campaign.id,
      media_id: mediaId,
      sort_order: index,
    }))

    await supabase.from('campaign_media').insert(mediaInserts)
  }

  return NextResponse.json(campaign, { status: 201 })
}
