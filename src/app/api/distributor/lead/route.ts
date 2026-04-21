import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralCode, checkAndGrantRewards } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'
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

    // Credit referrer
    if (referralParticipantId) {
      const { data: participant } = await supabase
        .from('referral_participants')
        .select('distributor_leads, consumer_signups, paid_conversions')
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
            referred_email: data.email.toLowerCase().trim(),
            metadata: { business_name: data.businessName, lead_id: lead.id },
          }),
        ])

        // Update warm-intro status if applicable
        await supabase
          .from('referral_invites')
          .update({ status: 'converted', converted_at: new Date().toISOString() })
          .eq('participant_id', referralParticipantId)
          .eq('referred_email', data.email.toLowerCase().trim())
          .eq('invite_type', 'distributor')
          .neq('status', 'converted')

        await checkAndGrantRewards(
          supabase,
          referralParticipantId,
          participant.consumer_signups || 0,
          newLeadCount,
          participant.paid_conversions || 0
        )
      }
    }

    return NextResponse.json({ success: true, leadId: lead.id })
  } catch {
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
  }
}
