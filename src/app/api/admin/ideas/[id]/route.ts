import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  let { data, error } = await supabase
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
    .eq('id', id)
    .single()

  if (error?.message?.includes('idea_media')) {
    const result = await supabase
      .from('ideas')
      .select(`
        *,
        created_by_staff:staff!ideas_created_by_fkey(full_name),
        assigned_to_staff:staff!ideas_assigned_to_fkey(full_name)
      `)
      .eq('id', id)
      .single()
    data = result.data ? { ...result.data, idea_media: [] } : null
    error = result.error
  }

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
  if (updates.category !== undefined) updatePayload.category = updates.category
  if (updates.status !== undefined) updatePayload.status = updates.status
  if (updates.priority !== undefined) updatePayload.priority = updates.priority
  if (updates.tags !== undefined) updatePayload.tags = updates.tags
  if (updates.notes !== undefined) updatePayload.notes = updates.notes
  if (updates.assigned_to !== undefined) updatePayload.assigned_to = updates.assigned_to
  if (updates.due_date !== undefined) updatePayload.due_date = updates.due_date

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from('ideas')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (media_ids !== undefined) {
    try {
      await supabase.from('idea_media').delete().eq('idea_id', id)

      if (media_ids.length) {
        const mediaInserts = media_ids.map((mediaId: string, index: number) => ({
          idea_id: id,
          media_id: mediaId,
          sort_order: index,
        }))
        await supabase.from('idea_media').insert(mediaInserts)
      }
    } catch {
      // idea_media table may not exist yet
    }
  }

  const { data } = await supabase.from('ideas').select().eq('id', id).single()
  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase.from('ideas').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
