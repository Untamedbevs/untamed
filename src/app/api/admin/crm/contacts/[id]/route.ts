export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logStaffAction } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts, canManageContactData } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'
import { quoteFilterValue } from '@/lib/supabase/postgrest'
import { isGmailConfigured } from '@/lib/gmail/client'
import { storedSteps } from '@/lib/gmail/outreach'

const MESSAGE_LIMIT = 100
const ORDER_LIMIT = 50
const TRANSACTION_LIMIT = 40
const CONVERSATION_LIMIT = 100
const CONVERSATION_BODY_CHARS = 8000

/** Match one address exactly with ilike (case-insensitive, no wildcards). */
function likeExact(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * One contact: profile, list status, full consent history, recent email, and
 * the timeline (orders, points, flows, outreach, two-way conversation).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: contact, error } = await admin
    .from('email_contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const [consents, events, suppression, messages, lists, staffRows] = await Promise.all([
    admin.from('email_consents').select('list_slug, status, subscribed_at, unsubscribed_at, updated_at').eq('contact_id', id),
    admin
      .from('email_consent_events')
      .select('id, list_slug, action, source, source_detail, consent_text, consent_text_version, campaign_id, ip_address, user_agent, country_code, actor_staff_id, evidence_note, created_at')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
    admin.from('email_suppressions').select('reason, notes, created_at').eq('email', contact.email).maybeSingle(),
    admin
      .from('email_messages')
      .select('id, subject, status, stream, transport, campaign_id, template_slug, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complaint_at, bounce_type')
      .or(`email_contact_id.eq.${id},to_email.eq.${quoteFilterValue(contact.email)}`)
      .order('sent_at', { ascending: false })
      .limit(MESSAGE_LIMIT),
    admin.from('email_lists').select('slug, name, audience, requires_age_verification, is_active').order('sort_order'),
    admin.from('staff').select('id, full_name'),
  ])

  const staffNames = new Map((staffRows.data || []).map((s) => [s.id, s.full_name]))

  // Timeline. Each part degrades to empty on error so one missing table
  // (e.g. a migration not yet applied) doesn't hide the rest of the page.
  const emailFilter = quoteFilterValue(contact.email)
  const memberQuery = admin.from('loyalty_members').select('id, points_balance, created_at')
  const [orders, member, flows, outreach, conversation, sequences] = await Promise.all([
    admin
      .from('loyalty_orders')
      .select('id, accelpay_sale_id, created_at, items, total_cents, status')
      .ilike('email', likeExact(contact.email))
      .order('created_at', { ascending: false })
      .limit(ORDER_LIMIT),
    contact.loyalty_member_id
      ? memberQuery.eq('id', contact.loyalty_member_id).maybeSingle()
      : memberQuery.ilike('email', likeExact(contact.email)).limit(1).maybeSingle(),
    admin
      .from('email_flow_enrollments')
      .select('id, flow_slug, status, steps_sent, next_step_order, next_run_at, exit_reason, enrolled_at, completed_at, email_flows(name)')
      .or(`contact_id.eq.${id},email.eq.${emailFilter}`)
      .order('enrolled_at', { ascending: false })
      .limit(50),
    admin
      .from('outreach_enrollments')
      .select('id, sequence_id, status, next_step, next_run_at, last_sent_at, sender_staff_id, sender_email, stopped_reason, created_at, outreach_sequences(name, steps)')
      .eq('email', contact.email)
      .order('created_at', { ascending: false }),
    admin
      .from('email_messages')
      .select('id, subject, direction, from_email, to_email, body_text, status, stream, transport, sent_at, gmail_thread_id, mailbox, sent_by, outreach_enrollment_id')
      .or(`email_contact_id.eq.${id},to_email.eq.${emailFilter},from_email.eq.${emailFilter}`)
      .order('sent_at', { ascending: false })
      .limit(CONVERSATION_LIMIT),
    admin.from('outreach_sequences').select('id, name, steps').eq('is_archived', false).order('name'),
  ])

  const memberRow = member.data as { id: string; points_balance: number | null; created_at: string } | null
  const [transactions, redemptions] = memberRow
    ? await Promise.all([
        admin
          .from('loyalty_transactions')
          .select('id, points, type, description, created_at')
          .eq('member_id', memberRow.id)
          .order('created_at', { ascending: false })
          .limit(TRANSACTION_LIMIT),
        admin
          .from('loyalty_redemptions')
          .select('id, reward_label, points_cost, status, created_at, fulfilled_at, cancelled_at')
          .eq('member_id', memberRow.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ])
    : [{ data: [] }, { data: [] }]

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] || null : v || null)

  const timeline = {
    orders: (orders.data || []).map((o) => ({
      id: o.id,
      sale_id: o.accelpay_sale_id,
      created_at: o.created_at,
      status: o.status,
      total_cents: o.total_cents,
      items: (Array.isArray(o.items) ? o.items : [])
        .map((it: { title?: unknown; quantity?: unknown }) => ({
          title: typeof it?.title === 'string' ? it.title : 'Item',
          quantity: Number(it?.quantity) || 1,
        })),
    })),
    loyalty: memberRow
      ? {
          member_id: memberRow.id,
          points_balance: memberRow.points_balance || 0,
          member_since: memberRow.created_at,
          transactions: transactions.data || [],
          redemptions: redemptions.data || [],
        }
      : null,
    flows: (flows.data || []).map((f) => ({
      id: f.id,
      flow_slug: f.flow_slug,
      flow_name: one(f.email_flows as { name: string } | { name: string }[] | null)?.name || f.flow_slug,
      status: f.status,
      steps_sent: f.steps_sent,
      next_step_order: f.next_step_order,
      next_run_at: f.next_run_at,
      exit_reason: f.exit_reason,
      enrolled_at: f.enrolled_at,
      completed_at: f.completed_at,
    })),
    outreach: (outreach.data || []).map((e) => {
      const seq = one(e.outreach_sequences as { name: string; steps: unknown } | { name: string; steps: unknown }[] | null)
      return {
        id: e.id,
        sequence_id: e.sequence_id,
        sequence_name: seq?.name || 'Sequence',
        total_steps: storedSteps(seq?.steps).length,
        status: e.status,
        next_step: e.next_step,
        next_run_at: e.next_run_at,
        last_sent_at: e.last_sent_at,
        sender_email: e.sender_email,
        sender_name: e.sender_staff_id ? staffNames.get(e.sender_staff_id) || null : null,
        stopped_reason: e.stopped_reason,
        created_at: e.created_at,
      }
    }),
    conversation: (conversation.data || []).map((m) => ({
      ...m,
      body_text: m.body_text ? String(m.body_text).slice(0, CONVERSATION_BODY_CHARS) : null,
      sent_by_name: m.sent_by ? staffNames.get(m.sent_by) || null : null,
    })),
    sequences: (sequences.data || [])
      .map((s) => ({ id: s.id, name: s.name, steps: storedSteps(s.steps).length }))
      .filter((s) => s.steps > 0),
  }

  return NextResponse.json({
    contact,
    lists: lists.data || [],
    consents: consents.data || [],
    events: (events.data || []).map((e) => ({
      ...e,
      actor_name: e.actor_staff_id ? staffNames.get(e.actor_staff_id) || null : null,
    })),
    suppression: suppression.data || null,
    messages: messages.data || [],
    permissions: { canManage: canManageContactData(staff.role) },
    timeline,
    me: { email: staff.email, full_name: staff.full_name },
    gmail: { configured: isGmailConfigured() },
  })
}

/**
 * Data-deletion request: removes the person's email data and leaves a
 * suppression so they're never mailed again. Body: { confirmEmail, note }.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageContactData(staff.role)) {
    return NextResponse.json({ error: 'Only admins can delete contact data' }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { confirmEmail?: string; note?: string }
  const admin = createAdminClient()
  const { data: contact } = await admin.from('email_contacts').select('email').eq('id', id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  if ((body.confirmEmail || '').trim().toLowerCase() !== contact.email) {
    return NextResponse.json({ error: 'Type the contact’s email address to confirm.' }, { status: 400 })
  }

  const { data, error } = await admin.rpc('email_delete_contact_data', {
    p_contact_id: id,
    p_actor_staff_id: staff.id,
    p_note: body.note?.trim().slice(0, 300) || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log(`[contacts] Email data deleted for contact ${id} by staff ${staff.id}`)
  await logStaffAction(staff.id, 'contact.delete_data', 'email_contact', id, { note: body.note?.trim().slice(0, 300) || null })
  return NextResponse.json({ ok: true, result: data })
}
