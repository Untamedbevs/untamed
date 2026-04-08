import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Delete many flows by id. Associated flow_posts are removed via ON DELETE CASCADE.
 * Body: { ids: string[] } (max 200)
 */
export async function POST(request: NextRequest) {
  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = body.ids
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  if (raw.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 ids per request' }, { status: 400 })
  }

  const ids = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))]
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: `Invalid flow id: ${id}` }, { status: 400 })
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('flows').delete().in('id', ids).select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    deletedCount: data?.length ?? 0,
    deletedIds: (data ?? []).map((r) => r.id),
  })
}
