import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralCode } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME, REF_COOKIE_MAX_AGE } from '@/lib/referral/constants'
import { clip, hashIp, LIMITS, readBeaconJson } from '@/lib/tracking/beacon-limits'

export async function POST(request: NextRequest) {
  try {
    const read = await readBeaconJson(request)
    if (read.tooLarge) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }
    const body = (read.body ?? {}) as Record<string, unknown>
    const { code, type } = body

    if (typeof code !== 'string' || !code || !type) {
      return NextResponse.json({ error: 'code and type are required' }, { status: 400 })
    }

    if (type !== 'consumer' && type !== 'distributor') {
      return NextResponse.json(
        { error: 'type must be "consumer" or "distributor"' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const participant = await resolveReferralCode(supabase, code)

    if (!participant) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
    }

    const eventType = type === 'consumer' ? 'click_consumer' : 'click_distributor'
    // Store a hash, as the column name says and as /api/tracking/session does;
    // the raw client IP was being stored here.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ipHash = ip ? hashIp(ip) : null
    const ua = clip(request.headers.get('user-agent'), LIMITS.userAgent)

    // Log event + increment click counter
    const { data: current } = await supabase
      .from('referral_participants')
      .select('total_clicks')
      .eq('id', participant.id)
      .single()

    await Promise.all([
      supabase.from('referral_events').insert({
        participant_id: participant.id,
        event_type: eventType,
        ip_hash: ipHash,
        user_agent: ua,
      }),
      supabase
        .from('referral_participants')
        .update({ total_clicks: (current?.total_clicks || 0) + 1 })
        .eq('id', participant.id),
    ])

    const response = NextResponse.json({
      success: true,
      referrerCode: participant.referral_code,
      referrerName: participant.display_name || null,
    })

    response.cookies.set(REF_COOKIE_NAME, participant.referral_code, {
      maxAge: REF_COOKIE_MAX_AGE,
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
