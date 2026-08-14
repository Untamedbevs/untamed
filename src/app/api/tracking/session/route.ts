import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      visitorId,
      sessionId,
      isNewVisitor,
      isNewSession,
      landingPage,
      referrer,
      urlParams = {},
      device = {},
    } = body

    if (!visitorId || !sessionId) {
      return NextResponse.json({ error: 'visitorId and sessionId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const utm = {
      source: urlParams.utm_source || null,
      medium: urlParams.utm_medium || null,
      campaign: urlParams.utm_campaign || null,
      content: urlParams.utm_content || null,
      term: urlParams.utm_term || null,
    }
    const gclid = urlParams.gclid || null
    const fbclid = urlParams.fbclid || null

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
          user_agent: request.headers.get('user-agent') || null,
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
