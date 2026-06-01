import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POINTS } from '@/lib/loyalty/constants'
import { creditConsumerReferral } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { visitorId, email, firstName, drinkSlug } = body

    if (!visitorId || !email) {
      return NextResponse.json(
        { error: 'visitorId and email are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: existingMember } = await supabase
      .from('loyalty_members')
      .select('*')
      .eq('email', normalizedEmail)
      .single()

    if (existingMember) {
      return NextResponse.json({ member: existingMember, isNew: false })
    }

    const { data: visitor } = await supabase
      .from('visitors')
      .select('*')
      .eq('fingerprint', visitorId)
      .single()

    if (!visitor) {
      return NextResponse.json({ error: 'Visitor not found' }, { status: 404 })
    }

    // Waterfall: copy first-touch attribution from visitor to new member
    const { data: newMember, error: memberError } = await supabase
      .from('loyalty_members')
      .insert({
        email: normalizedEmail,
        first_name: firstName || null,
        visitor_id: visitorId,
        favorite_drink_slug: drinkSlug || null,
        points_balance: POINTS.SIGNUP_BONUS,
        first_utm_source: visitor.first_utm_source,
        first_utm_medium: visitor.first_utm_medium,
        first_utm_campaign: visitor.first_utm_campaign,
        first_landing_page: visitor.first_landing_page,
        first_referrer: visitor.first_referrer,
        first_seen_at: visitor.first_seen_at,
      })
      .select()
      .single()

    if (memberError) {
      if (memberError.code === '23505') {
        const { data: existing } = await supabase
          .from('loyalty_members')
          .select('*')
          .eq('email', normalizedEmail)
          .single()
        return NextResponse.json({ member: existing, isNew: false })
      }
      throw memberError
    }

    // Link visitor to member
    await supabase
      .from('visitors')
      .update({ loyalty_member_id: newMember.id })
      .eq('id', visitor.id)

    // Create signup bonus transaction
    await supabase.from('loyalty_transactions').insert({
      member_id: newMember.id,
      points: POINTS.SIGNUP_BONUS,
      type: 'signup_bonus',
      description: 'Welcome to the Pack! Signup bonus.',
    })

    // Credit referrer if ut_ref cookie is present
    const refCookie = request.cookies.get(REF_COOKIE_NAME)
    if (refCookie?.value) {
      await creditConsumerReferral(supabase, refCookie.value, normalizedEmail)
    }

    return NextResponse.json({ member: newMember, isNew: true })
  } catch {
    return NextResponse.json({ error: 'Identification failed' }, { status: 500 })
  }
}
