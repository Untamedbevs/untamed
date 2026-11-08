import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readBeaconJson, boundedEventData, cleanId, clip, LIMITS } from '@/lib/tracking/beacon-limits'

export async function POST(request: NextRequest) {
  try {
    const read = await readBeaconJson(request)
    if (read.tooLarge) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }
    const body = (read.body ?? {}) as Record<string, unknown>
    const visitorId = cleanId(body?.visitorId)
    const eventType = clip(body?.eventType, 80)
    if (!visitorId || !eventType) {
      return NextResponse.json({ error: 'visitorId and eventType required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    await supabase.from('tracking_events').insert({
      visitor_fingerprint: visitorId,
      session_id: cleanId(body.sessionId),
      event_type: eventType,
      page_path: clip(body.pagePath, LIMITS.url),
      event_data: boundedEventData(body.eventData),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
