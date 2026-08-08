import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralCode, generateUniqueCode } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'
import { POINTS } from '@/lib/loyalty/constants'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { z } from 'zod'

const LEAD_NOTIFY_EMAIL = 'joe.colella@untamedbeverages.com'

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  bar_restaurant: 'Bar / Restaurant',
  liquor_store: 'Liquor Store',
  distributor: 'Distributor',
  event_venue: 'Event Venue',
  other: 'Other',
}

const VOLUME_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

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

    // Notify sales of the new lead. Failure here should never block the
    // lead submission itself.
    try {
      await sendAndLogEmail({
        to: LEAD_NOTIFY_EMAIL,
        replyTo: data.email,
        subject: `New Retail Lead: ${data.businessName}`,
        html: renderLeadNotificationHtml(data),
        text: renderLeadNotificationText(data),
        templateSlug: 'retail-lead-notification',
        distributorLeadId: lead.id,
      })
    } catch (emailErr) {
      console.error('[distributor/lead] Notification email failed:', emailErr)
    }

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

// ---------------------------------------------------------------------------
// Lead notification email
// ---------------------------------------------------------------------------

type LeadData = z.infer<typeof leadSchema>

function leadFields(data: LeadData): Array<[string, string]> {
  const fields: Array<[string, string]> = [
    ['Business', data.businessName],
    ['Contact', data.contactName],
    ['Email', data.email],
  ]
  if (data.phone) fields.push(['Phone', data.phone])
  if (data.location) fields.push(['Location', data.location])
  fields.push(['Business Type', BUSINESS_TYPE_LABELS[data.businessType] || data.businessType])
  if (data.volumeInterest) {
    fields.push(['Volume Interest', VOLUME_LABELS[data.volumeInterest] || data.volumeInterest])
  }
  if (data.message) fields.push(['Message', data.message])
  return fields
}

function renderLeadNotificationText(data: LeadData): string {
  return [
    'New retail lead from untamedbeverages.com:',
    '',
    ...leadFields(data).map(([label, value]) => `${label}: ${value}`),
  ].join('\n')
}

function renderLeadNotificationHtml(data: LeadData): string {
  const rows = leadFields(data)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#888;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;color:#EDEDED;font-size:14px;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
        </tr>`
    )
    .join('')

  return `
    <div style="background:#0A0A0A;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #2A2A2A;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #2A2A2A;">
            <span style="color:#9B30FF;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Untamed Beverages</span>
            <h1 style="margin:8px 0 0;color:#FFFFFF;font-size:20px;">New Retail Lead</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #2A2A2A;color:#666;font-size:12px;">
            Reply to this email to respond to the lead directly, or view it in the
            <a href="https://untamedbeverages.com/admin/retail" style="color:#9B30FF;">admin dashboard</a>.
          </td>
        </tr>
      </table>
    </div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
