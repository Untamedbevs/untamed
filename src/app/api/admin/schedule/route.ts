import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('scheduled_posts')
    .select(`
      *,
      flow:flows!scheduled_posts_flow_id_fkey(id, title, concept, status)
    `)
    .order('sort_order', { ascending: true })
    .order('scheduled_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const flowIds = [...new Set(data.map((d: { flow_id: string }) => d.flow_id))]
  let mediaMap: Record<string, { id: string; filename: string; url: string; file_type: string }[]> = {}

  if (flowIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('media')
      .select('id, filename, url, file_type, flow_post:flow_posts!flow_posts_generated_media_id_fkey(flow_id)')
      .in('flow_post.flow_id', flowIds)
      .not('flow_post', 'is', null)

    if (mediaRows) {
      for (const m of mediaRows as Array<{
        id: string; filename: string; url: string; file_type: string;
        flow_post: { flow_id: string }[]
      }>) {
        const fid = m.flow_post?.[0]?.flow_id
        if (!fid) continue
        if (!mediaMap[fid]) mediaMap[fid] = []
        mediaMap[fid].push({ id: m.id, filename: m.filename, url: m.url, file_type: m.file_type })
      }
    }
  }

  const enriched = data.map((row: Record<string, unknown>) => ({
    ...row,
    flow_media: mediaMap[(row as { flow_id: string }).flow_id] || [],
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const posts = Array.isArray(body) ? body : [body]

  const inserts = posts.map((p, i) => ({
    flow_id: p.flow_id,
    media_ids: p.media_ids || [],
    platforms: p.platforms || [],
    caption: p.caption || null,
    hashtags: p.hashtags || [],
    scheduled_at: p.scheduled_at,
    sort_order: p.sort_order ?? i,
    status: 'scheduled',
  }))

  const { data, error } = await supabase
    .from('scheduled_posts')
    .insert(inserts)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const posts = Array.isArray(body) ? body : [body]
  const results = []

  for (const p of posts) {
    if (!p.id) continue

    const update: Record<string, unknown> = {}
    if (p.caption !== undefined) update.caption = p.caption
    if (p.hashtags !== undefined) update.hashtags = p.hashtags
    if (p.platforms !== undefined) update.platforms = p.platforms
    if (p.scheduled_at !== undefined) update.scheduled_at = p.scheduled_at
    if (p.sort_order !== undefined) update.sort_order = p.sort_order
    if (p.media_ids !== undefined) update.media_ids = p.media_ids
    if (p.status !== undefined) update.status = p.status
    update.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('scheduled_posts')
      .update(update)
      .eq('id', p.id)
      .select()
      .single()

    if (!error && data) results.push(data)
  }

  return NextResponse.json(results)
}

export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('scheduled_posts')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
