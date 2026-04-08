import { patchFlowPostMediaRefs } from '@/lib/media-cdn-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('flows')
    .select(`
      *,
      created_by_staff:staff!flows_created_by_fkey(full_name),
      flow_posts(
        *,
        reference_media:media!flow_posts_reference_media_id_fkey(id, filename, url, file_type, s3_key, is_private),
        end_reference_media:media!flow_posts_end_reference_media_id_fkey(id, filename, url, file_type, s3_key, is_private),
        generated_media:media!flow_posts_generated_media_id_fkey(id, filename, url, file_type, mime_type, s3_key, is_private)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  if (data?.flow_posts) {
    data.flow_posts.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    data.flow_posts = data.flow_posts.map((p: Record<string, unknown>) => patchFlowPostMediaRefs(p))
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

  const updatePayload: Record<string, unknown> = {}
  if (body.title !== undefined) updatePayload.title = body.title
  if (body.concept !== undefined) updatePayload.concept = body.concept
  if (body.status !== undefined) updatePayload.status = body.status
  if (body.platform_targets !== undefined) updatePayload.platform_targets = body.platform_targets
  if (body.campaign_id !== undefined) updatePayload.campaign_id = body.campaign_id

  const { data, error } = await supabase
    .from('flows')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase.from('flows').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
