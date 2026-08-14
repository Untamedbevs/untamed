import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { visitorId, sessionId, eventType, pagePath, eventData } = body
    if (!visitorId || !eventType) {
      return NextResponse.json({ error: 'visitorId and eventType required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    await supabase.from('tracking_events').insert({
      visitor_fingerprint: visitorId,
      session_id: sessionId || null,
      event_type: String(eventType).slice(0, 80),
      page_path: pagePath || null,
      event_data: eventData && typeof eventData === 'object' ? eventData : {},
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
