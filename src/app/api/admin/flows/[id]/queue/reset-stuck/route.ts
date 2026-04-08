import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/** Set any `generating` segments on this flow back to `pending` (e.g. after a crash or timeout). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flowId } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('flow_posts')
    .update({ status: 'pending' })
    .eq('flow_id', flowId)
    .eq('status', 'generating')
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ resetCount: data?.length ?? 0, ids: (data ?? []).map((r) => r.id) })
}
