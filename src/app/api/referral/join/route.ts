import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateUniqueCode, resolveReferralCode } from '@/lib/referral/helpers'
import { POINTS } from '@/lib/loyalty/constants'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, firstName, visitorId } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()
    const displayName = firstName?.trim() || null

    // Check if already a referral participant
    const { data: existingParticipant } = await supabase
      .from('referral_participants')
      .select('*')
      .eq('email', normalizedEmail)
      .single()

    if (existingParticipant) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
      return NextResponse.json({
        participant: existingParticipant,
        isNew: false,
        consumerLink: `${siteUrl}/?ref=${existingParticipant.referral_code}`,
        distributorLink: `${siteUrl}/retail?ref=${existingParticipant.referral_code}`,
      })
    }

    // Find or create loyalty member (auto-enroll)
    let loyaltyMemberId: string

    const { data: existingMember } = await supabase
      .from('loyalty_members')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    if (existingMember) {
      loyaltyMemberId = existingMember.id
    } else {
      // Auto-create loyalty member
      const insertData: Record<string, unknown> = {
        email: normalizedEmail,
        first_name: displayName,
        visitor_id: visitorId || 'referral-direct',
        points_balance: POINTS.SIGNUP_BONUS,
      }

      const { data: newMember, error: memberError } = await supabase
        .from('loyalty_members')
        .insert(insertData)
        .select('id')
        .single()

      if (memberError) {
        if (memberError.code === '23505') {
          const { data: existing } = await supabase
            .from('loyalty_members')
            .select('id')
            .eq('email', normalizedEmail)
            .single()
          loyaltyMemberId = existing!.id
        } else {
          throw memberError
        }
      } else {
        loyaltyMemberId = newMember.id

        await supabase.from('loyalty_transactions').insert({
          member_id: loyaltyMemberId,
          points: POINTS.SIGNUP_BONUS,
          type: 'signup_bonus',
          description: 'Welcome to the Pack! Signup bonus.',
        })
      }
    }

    // Generate referral code
    const referralCode = await generateUniqueCode(
      supabase,
      displayName || normalizedEmail.split('@')[0]
    )

    // Check for referrer from cookie
    let referredByParticipantId: string | null = null
    const refCookie = request.cookies.get(REF_COOKIE_NAME)
    if (refCookie?.value) {
      const referrer = await resolveReferralCode(supabase, refCookie.value)
      if (referrer) {
        referredByParticipantId = referrer.id
      }
    }

    // Create referral participant
    const { data: participant, error: participantError } = await supabase
      .from('referral_participants')
      .insert({
        loyalty_member_id: loyaltyMemberId,
        email: normalizedEmail,
        referral_code: referralCode,
        display_name: displayName,
        referred_by_participant_id: referredByParticipantId,
      })
      .select()
      .single()

    if (participantError) throw participantError

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    return NextResponse.json({
      participant,
      isNew: true,
      consumerLink: `${siteUrl}/?ref=${participant.referral_code}`,
      distributorLink: `${siteUrl}/retail?ref=${participant.referral_code}`,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to join referral program' }, { status: 500 })
  }
}
