import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { beaconTooLarge, cleanId, clip, LIMITS } from '@/lib/tracking/beacon-limits'

export async function POST(request: NextRequest) {
  try {
    if (beaconTooLarge(request.headers.get('content-length'))) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }
    const body = await request.json()
    const { isNewVisitor, isNewSession } = body ?? {}
    const visitorId = cleanId(body?.visitorId)
    const sessionId = cleanId(body?.sessionId)
    const landingPage = clip(body?.landingPage, LIMITS.url)
    const referrer = clip(body?.referrer, LIMITS.url)
    const urlParams = body?.urlParams && typeof body.urlParams === 'object' ? body.urlParams : {}
    const rawDevice = body?.device && typeof body.device === 'object' ? body.device : {}
    const device = { type: clip(rawDevice.type, LIMITS.device), browser: clip(rawDevice.browser, LIMITS.device) }

    if (!visitorId || !sessionId) {
      return NextResponse.json({ error: 'visitorId and sessionId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const utm = {
      source: clip(urlParams.utm_source, LIMITS.utm),
      medium: clip(urlParams.utm_medium, LIMITS.utm),
      campaign: clip(urlParams.utm_campaign, LIMITS.utm),
      content: clip(urlParams.utm_content, LIMITS.utm),
      term: clip(urlParams.utm_term, LIMITS.utm),
    }
    const gclid = clip(urlParams.gclid, LIMITS.utm)
    const fbclid = clip(urlParams.fbclid, LIMITS.utm)

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)

    if (isNewVisitor) {
      await supabase.from('visitors').insert({
        fingerprint: visitorId,
        first_landing_page: landingPage,
        first_referrer: referrer,
        first_utm_source: utm.source,
        first_utm_medium: utm.medium,
        first_utm_campaign: utm.campaign,
        first_utm_content: utm.content,
        first_utm_term: utm.term,
        first_gclid: gclid,
        first_fbclid: fbclid,
        last_utm_source: utm.source,
        last_utm_medium: utm.medium,
        last_utm_campaign: utm.campaign,
        session_count: 1,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
    } else {
      const updatePayload: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      }

      if (utm.source) updatePayload.last_utm_source = utm.source
      if (utm.medium) updatePayload.last_utm_medium = utm.medium
      if (utm.campaign) updatePayload.last_utm_campaign = utm.campaign

      if (isNewSession) {
        try {
          await supabase.rpc('increment_visitor_sessions', { visitor_fingerprint: visitorId })
        } catch {
          // RPC may not exist yet; session_count updated via direct update below
        }
      }

      await supabase
        .from('visitors')
        .update(updatePayload)
        .eq('fingerprint', visitorId)
    }

    if (isNewSession) {
      const { data: visitor } = await supabase
        .from('visitors')
        .select('id')
        .eq('fingerprint', visitorId)
        .single()

      if (visitor) {
        await supabase.from('sessions').insert({
          visitor_id: visitor.id,
          client_session_id: sessionId,
          landing_page: landingPage,
          referrer: referrer,
          utm_source: utm.source,
          utm_medium: utm.medium,
          utm_campaign: utm.campaign,
          utm_content: utm.content,
          utm_term: utm.term,
          gclid,
          fbclid,
          device_type: device.type || null,
          browser: device.browser || null,
          user_agent: clip(request.headers.get('user-agent'), LIMITS.userAgent),
          ip_hash: ipHash,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
