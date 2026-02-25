import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category')
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assigned_to = searchParams.get('assigned_to')
  const search = searchParams.get('search')

  let query = supabase
    .from('ideas')
    .select(`
      *,
      created_by_staff:staff!ideas_created_by_fkey(full_name),
      assigned_to_staff:staff!ideas_assigned_to_fkey(full_name),
      idea_media(
        id,
        sort_order,
        media:media!idea_media_media_id_fkey(id, filename, url, file_type)
      )
    `)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (assigned_to) query = query.eq('assigned_to', assigned_to)
  if (search) query = query.ilike('title', `%${search}%`)

  let { data, error } = await query

  if (error?.message?.includes('idea_media')) {
    const fallback = supabase
      .from('ideas')
      .select(`
        *,
        created_by_staff:staff!ideas_created_by_fkey(full_name),
        assigned_to_staff:staff!ideas_assigned_to_fkey(full_name)
      `)
      .order('created_at', { ascending: false })

    if (category) fallback.eq('category', category)
    if (status) fallback.eq('status', status)
    if (priority) fallback.eq('priority', priority)
    if (assigned_to) fallback.eq('assigned_to', assigned_to)
    if (search) fallback.ilike('title', `%${search}%`)

    const result = await fallback
    data = (result.data || []).map((idea) => ({ ...idea, idea_media: [] }))
    error = result.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const { media_ids, ...ideaData } = body

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      title: ideaData.title,
      description: ideaData.description || null,
      category: ideaData.category,
      status: ideaData.status || 'idea',
      priority: ideaData.priority || 'medium',
      tags: ideaData.tags || [],
      notes: ideaData.notes || null,
      created_by: ideaData.created_by || null,
      assigned_to: ideaData.assigned_to || null,
      due_date: ideaData.due_date || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (media_ids?.length) {
    const mediaInserts = media_ids.map((mediaId: string, index: number) => ({
      idea_id: data.id,
      media_id: mediaId,
      sort_order: index,
    }))
    await supabase.from('idea_media').insert(mediaInserts)
  }

  return NextResponse.json(data, { status: 201 })
}
