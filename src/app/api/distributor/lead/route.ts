import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralCode, generateUniqueCode } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'
import { POINTS } from '@/lib/loyalty/constants'
import { z } from 'zod'

const leadSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  location: z.string().optional(),
  businessType: z.enum(['bar_restaurant', 'liquor_store', 'distributor', 'event_venue', 'other']),
  volumeInterest: z.enum(['small', 'medium', 'large']).optional(),
  message: z.string().max(2000).optional(),
  ref: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = leadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    const data = parsed.data
    const supabase = createAdminClient()

    // Resolve referrer from explicit ref param or cookie
    let referralParticipantId: string | null = null
    const refCode = data.ref || request.cookies.get(REF_COOKIE_NAME)?.value

    if (refCode) {
      const referrer = await resolveReferralCode(supabase, refCode)
      if (referrer) {
        referralParticipantId = referrer.id
      }
    }

    // Insert lead
    const { data: lead, error: leadError } = await supabase
      .from('distributor_leads')
      .insert({
        business_name: data.businessName,
        contact_name: data.contactName,
        email: data.email.toLowerCase().trim(),
        phone: data.phone || null,
        location: data.location || null,
        business_type: data.businessType,
        volume_interest: data.volumeInterest || null,
        message: data.message || null,
        referral_participant_id: referralParticipantId,
      })
      .select()
      .single()

    if (leadError) throw leadError

    // Credit referrer (counter + event only -- referral points are reserved
    // for consumer signups and purchases). Deduped per referred email.
    if (referralParticipantId) {
      const normalizedLeadEmail = data.email.toLowerCase().trim()

      const { data: priorLeadEvent } = await supabase
        .from('referral_events')
        .select('id')
        .eq('participant_id', referralParticipantId)
        .eq('event_type', 'distributor_lead')
        .eq('referred_email', normalizedLeadEmail)
        .limit(1)
        .maybeSingle()

      const { data: participant } = priorLeadEvent
        ? { data: null }
        : await supabase
            .from('referral_participants')
            .select('distributor_leads')
            .eq('id', referralParticipantId)
            .single()

      if (participant) {
        const newLeadCount = (participant.distributor_leads || 0) + 1

        await Promise.all([
          supabase
            .from('referral_participants')
            .update({ distributor_leads: newLeadCount })
            .eq('id', referralParticipantId),
          supabase.from('referral_events').insert({
            participant_id: referralParticipantId,
            event_type: 'distributor_lead',
            referred_email: normalizedLeadEmail,
            metadata: { business_name: data.businessName, lead_id: lead.id },
          }),
        ])

        // Update warm-intro status if applicable
        await supabase
          .from('referral_invites')
          .update({ status: 'converted', converted_at: new Date().toISOString() })
          .eq('participant_id', referralParticipantId)
          .eq('referred_email', normalizedLeadEmail)
          .eq('invite_type', 'distributor')
          .neq('status', 'converted')
      }
    }

    // Auto-enroll the retailer as a referral participant so they can refer others
    const normalizedEmail = data.email.toLowerCase().trim()
    const { data: existingParticipant } = await supabase
      .from('referral_participants')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!existingParticipant) {
      // Find or create loyalty member for the retailer
      let loyaltyMemberId: string | null = null

      const { data: existingMember } = await supabase
        .from('loyalty_members')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (existingMember) {
        loyaltyMemberId = existingMember.id
      } else {
        const { data: newMember } = await supabase
          .from('loyalty_members')
          .insert({
            email: normalizedEmail,
            first_name: data.contactName,
            visitor_id: randomUUID(),
            points_balance: POINTS.SIGNUP_BONUS,
          })
          .select('id')
          .maybeSingle()

        if (newMember) {
          loyaltyMemberId = newMember.id
          await supabase.from('loyalty_transactions').insert({
            member_id: loyaltyMemberId,
            points: POINTS.SIGNUP_BONUS,
            type: 'signup_bonus',
            description: 'Welcome to the Pack! Retailer signup bonus.',
          })
        }
      }

      if (loyaltyMemberId) {
        const referralCode = await generateUniqueCode(supabase, data.contactName || data.businessName)
        await supabase.from('referral_participants').insert({
          loyalty_member_id: loyaltyMemberId,
          email: normalizedEmail,
          referral_code: referralCode,
          display_name: data.contactName,
          referred_by_participant_id: referralParticipantId,
        })
      }
    }

    return NextResponse.json({ success: true, leadId: lead.id })
  } catch (err) {
    console.error('[distributor/lead] Failed:', err)
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
  }
}
