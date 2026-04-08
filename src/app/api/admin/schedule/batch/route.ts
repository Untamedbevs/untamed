import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const {
    flow_ids,
    platforms,
    cadence,
    caption_template,
  } = body as {
    flow_ids: string[]
    platforms: string[]
    cadence: { start: string; interval_hours: number }
    caption_template?: string
  }

  if (!flow_ids?.length || !cadence?.start || !cadence?.interval_hours) {
    return NextResponse.json(
      { error: 'flow_ids, cadence.start, and cadence.interval_hours are required' },
      { status: 400 }
    )
  }

  const { data: flows, error: flowErr } = await supabase
    .from('flows')
    .select('id, title, flow_posts(generated_media_id)')
    .in('id', flow_ids)

  if (flowErr) {
    return NextResponse.json({ error: flowErr.message }, { status: 500 })
  }

  const startDate = new Date(cadence.start)
  const intervalMs = cadence.interval_hours * 60 * 60 * 1000

  const inserts: Record<string, unknown>[] = []
  let idx = 0

  for (const flow of (flows || []) as { id: string; title: string; flow_posts: { generated_media_id: string | null }[] }[]) {
    const mediaIds = flow.flow_posts
      .map((fp) => fp.generated_media_id)
      .filter(Boolean) as string[]

    const caption = caption_template
      ? caption_template.replace('{{title}}', flow.title || '')
      : flow.title || ''

    for (const mediaId of mediaIds) {
      inserts.push({
        flow_id: flow.id,
        media_ids: [mediaId],
        platforms: platforms || [],
        caption,
        scheduled_at: new Date(startDate.getTime() + idx * intervalMs).toISOString(),
        sort_order: idx,
        status: 'scheduled',
      })
      idx++
    }
  }

  const { data, error } = await supabase
    .from('scheduled_posts')
    .insert(inserts)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
