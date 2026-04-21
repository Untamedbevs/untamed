import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POINTS } from '@/lib/loyalty/constants'
import { resolveReferralCode, checkAndGrantRewards } from '@/lib/referral/helpers'
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
      try {
        const referrer = await resolveReferralCode(supabase, refCookie.value)
        if (referrer) {
          const { data: refParticipant } = await supabase
            .from('referral_participants')
            .select('consumer_signups, distributor_leads, paid_conversions')
            .eq('id', referrer.id)
            .single()

          if (refParticipant) {
            const newSignups = (refParticipant.consumer_signups || 0) + 1

            await Promise.all([
              supabase
                .from('referral_participants')
                .update({ consumer_signups: newSignups })
                .eq('id', referrer.id),
              supabase.from('referral_events').insert({
                participant_id: referrer.id,
                event_type: 'consumer_signup',
                referred_email: normalizedEmail,
              }),
            ])

            // Update warm-intro status if applicable
            await supabase
              .from('referral_invites')
              .update({ status: 'converted', converted_at: new Date().toISOString() })
              .eq('participant_id', referrer.id)
              .eq('referred_email', normalizedEmail)
              .eq('invite_type', 'consumer')
              .neq('status', 'converted')

            await checkAndGrantRewards(
              supabase,
              referrer.id,
              newSignups,
              refParticipant.distributor_leads || 0,
              refParticipant.paid_conversions || 0
            )
          }
        }
      } catch {
        // Referral crediting is best-effort; don't fail the join
      }
    }

    return NextResponse.json({ member: newMember, isNew: true })
  } catch {
    return NextResponse.json({ error: 'Identification failed' }, { status: 500 })
  }
}
