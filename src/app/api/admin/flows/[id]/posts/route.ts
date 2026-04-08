import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('flow_posts')
    .select(`
      *,
      reference_media:media!flow_posts_reference_media_id_fkey(id, filename, url, file_type),
      end_reference_media:media!flow_posts_end_reference_media_id_fkey(id, filename, url, file_type),
      generated_media:media!flow_posts_generated_media_id_fkey(id, filename, url, file_type, mime_type)
    `)
    .eq('flow_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()

  const posts = Array.isArray(body) ? body : [body]

  const inserts = posts.map((post, index) => ({
    flow_id: id,
    sort_order: post.sort_order ?? index,
    concept: post.concept,
    prompt: post.prompt,
    generation_mode: post.generation_mode || 'generate',
    target_size: post.target_size || 'square_1_1',
    reference_media_id: post.reference_media_id || null,
    reference_external_url: post.reference_external_url?.trim() || null,
    end_reference_media_id: post.end_reference_media_id || null,
    reference_source_sort_order:
      post.reference_source_sort_order == null ? null : Number(post.reference_source_sort_order),
    end_frame_source_sort_order:
      post.end_frame_source_sort_order == null ? null : Number(post.end_frame_source_sort_order),
    fal_model: post.fal_model ?? null,
    status: 'pending',
  }))

  const { data, error } = await supabase
    .from('flow_posts')
    .insert(inserts)
    .select()

  if (error) {
    const msg = error.message ?? 'Insert failed'
    const migrationHint =
      /column|does not exist|schema cache/i.test(msg)
        ? 'Apply Supabase migrations for flow_posts (e.g. 00006, 00008, 00009) so columns like reference_external_url exist.'
        : undefined
    return NextResponse.json(
      {
        error: msg,
        code: error.code,
        details: error.details,
        hint: error.hint,
        migrationHint,
      },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()

  const posts = Array.isArray(body) ? body : [body]
  const results = []

  for (const post of posts) {
    if (!post.id) continue

    const updatePayload: Record<string, unknown> = {}
    if (post.concept !== undefined) updatePayload.concept = post.concept
    if (post.prompt !== undefined) updatePayload.prompt = post.prompt
    if (post.generation_mode !== undefined) updatePayload.generation_mode = post.generation_mode
    if (post.target_size !== undefined) updatePayload.target_size = post.target_size
    if (post.reference_media_id !== undefined) updatePayload.reference_media_id = post.reference_media_id
    if (post.reference_external_url !== undefined) {
      const u = post.reference_external_url
      updatePayload.reference_external_url =
        typeof u === 'string' && u.trim() ? u.trim() : null
    }
    if (post.end_reference_media_id !== undefined) {
      updatePayload.end_reference_media_id = post.end_reference_media_id || null
    }
    if (post.reference_source_sort_order !== undefined) {
      const v = post.reference_source_sort_order
      updatePayload.reference_source_sort_order = v == null ? null : Number(v)
    }
    if (post.end_frame_source_sort_order !== undefined) {
      const v = post.end_frame_source_sort_order
      updatePayload.end_frame_source_sort_order = v == null ? null : Number(v)
    }
    if (post.generated_media_id !== undefined) updatePayload.generated_media_id = post.generated_media_id
    if (post.status !== undefined) updatePayload.status = post.status
    if (post.sort_order !== undefined) updatePayload.sort_order = post.sort_order
    if (post.fal_model !== undefined) updatePayload.fal_model = post.fal_model || null
    if (post.generation_metadata !== undefined) updatePayload.generation_metadata = post.generation_metadata

    const { data, error } = await supabase
      .from('flow_posts')
      .update(updatePayload)
      .eq('id', post.id)
      .eq('flow_id', id)
      .select()
      .single()

    if (!error && data) results.push(data)
  }

  return NextResponse.json(results)
}
