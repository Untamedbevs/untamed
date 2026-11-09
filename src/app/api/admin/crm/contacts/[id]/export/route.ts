export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canManageContactData } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'
import { quoteFilterValue } from '@/lib/supabase/postgrest'
import { logStaffAction } from '@/lib/audit'

/**
 * Data-access request: everything the email system holds about one person,
 * as a JSON download. Loyalty, order, and lead records are separate business
 * records; their ids are included so they can be exported alongside.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageContactData(staff.role)) {
    return NextResponse.json({ error: 'Only admins can export contact data' }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: contact } = await admin.from('email_contacts').select('*').eq('id', id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const [consents, events, suppression, messages, queued, flows, outreach] = await Promise.all([
    admin.from('email_consents').select('*').eq('contact_id', id),
    admin.from('email_consent_events').select('*').eq('contact_id', id).order('created_at'),
    admin.from('email_suppressions').select('reason, notes, created_at').eq('email', contact.email).maybeSingle(),
    admin
      .from('email_messages')
      .select('direction, from_email, to_email, subject, body_text, status, stream, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complaint_at, open_count, click_count')
      .or(`email_contact_id.eq.${id},to_email.eq.${quoteFilterValue(contact.email)},from_email.eq.${quoteFilterValue(contact.email)}`)
      .order('sent_at'),
    admin
      .from('scheduled_messages')
      .select('subject, status, scheduled_for, created_at')
      .or(`email_contact_id.eq.${id},recipient_email.eq.${quoteFilterValue(contact.email)}`),
    admin
      .from('email_flow_enrollments')
      .select('flow_slug, status, steps_sent, enrolled_at, completed_at, exit_reason')
      .eq('email', contact.email),
    admin
      .from('outreach_enrollments')
      .select('sequence_id, sender_email, status, next_step, last_sent_at, stopped_reason, created_at')
      .eq('email', contact.email),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    exported_by_staff_id: staff.id,
    contact,
    list_status: consents.data || [],
    consent_history: events.data || [],
    suppression: suppression.data || null,
    emails: messages.data || [],
    emails_queued: queued.data || [],
    automated_flows: flows.data || [],
    outreach_sequences: outreach.data || [],
    linked_records: {
      loyalty_member_id: contact.loyalty_member_id,
      referral_participant_id: contact.referral_participant_id,
      distributor_lead_id: contact.distributor_lead_id,
      influencer_lead_id: contact.influencer_lead_id,
    },
  }

  console.log(`[contacts] Email data exported for contact ${id} by staff ${staff.id}`)
  await logStaffAction(staff.id, 'contact.export', 'email_contact', id)

  const filename = `untamed-email-data-${contact.email.replace(/[^a-z0-9]+/gi, '-')}.json`
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
