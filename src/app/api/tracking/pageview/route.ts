import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { beaconTooLarge, cleanId, clip, LIMITS } from '@/lib/tracking/beacon-limits'

export async function POST(request: NextRequest) {
  try {
    if (beaconTooLarge(request.headers.get('content-length'))) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }
    const body = await request.json()
    const visitorId = cleanId(body?.visitorId)
    const sessionId = cleanId(body?.sessionId)
    const pagePath = clip(body?.pagePath, LIMITS.url)
    if (!visitorId || !pagePath) {
      return NextResponse.json({ error: 'visitorId and pagePath required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    await supabase.from('tracking_events').insert({
      visitor_fingerprint: visitorId,
      session_id: sessionId,
      event_type: 'pageview',
      page_path: pagePath,
      event_data: { pageTitle: clip(body.pageTitle, LIMITS.title), pageUrl: clip(body.pageUrl, LIMITS.url) },
    })

    await supabase.rpc('increment_visitor_pageviews', { visitor_fingerprint: visitorId }).then(
      () => undefined,
      async () => {
        const { data: visitor } = await supabase
          .from('visitors')
          .select('id, total_pageviews')
          .eq('fingerprint', visitorId)
          .maybeSingle()
        if (visitor) {
          await supabase
            .from('visitors')
            .update({
              total_pageviews: (visitor.total_pageviews || 0) + 1,
              last_seen_at: new Date().toISOString(),
            })
            .eq('id', visitor.id)
        }
      }
    )

    if (sessionId) {
      const { data: session } = await supabase
        .from('sessions')
        .select('id, pageview_count')
        .eq('client_session_id', sessionId)
        .maybeSingle()
      if (session) {
        await supabase
          .from('sessions')
          .update({
            pageview_count: (session.pageview_count || 0) + 1,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', session.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
