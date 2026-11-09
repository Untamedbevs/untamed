export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'
import { filterSuppressed } from '@/lib/messaging/suppressions'
import { logStaffAction } from '@/lib/audit'
import { isGmailConfigured } from '@/lib/gmail/client'
import { getSyncMailboxes, isWorkspaceAddress } from '@/lib/gmail/sync'
import { addDays, storedSteps } from '@/lib/gmail/outreach'

const PAGE_SIZE = 50
const MAX_ENROLL = 200
const STATUSES = ['active', 'replied', 'completed', 'stopped', 'bounced', 'suppressed']

/**
 * Enrollments, newest first.
 * Query: sequence (id), status, q (email contains), page.
 */
export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const params = request.nextUrl.searchParams
  const sequence = params.get('sequence') || ''
  const status = params.get('status') || ''
  const q = (params.get('q') || '').trim().toLowerCase().replace(/[,()*%\\]/g, ' ').trim().slice(0, 200)
  const page = Math.max(0, parseInt(params.get('page') || '0', 10) || 0)

  const admin = createAdminClient()
  let query = admin
    .from('outreach_enrollments')
    .select(
      'id, sequence_id, contact_id, email, sender_staff_id, sender_email, status, next_step, next_run_at, last_sent_at, stopped_reason, created_at, outreach_sequences(name, steps)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (isUuid(sequence)) query = query.eq('sequence_id', sequence)
  if (STATUSES.includes(status)) query = query.eq('status', status)
  if (q) query = query.ilike('email', `%${q}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data || []
  const staffIds = [...new Set(rows.map((r) => r.sender_staff_id).filter(Boolean))]
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))]
  const [{ data: staffRows }, { data: contactRows }] = await Promise.all([
    staffIds.length ? admin.from('staff').select('id, full_name').in('id', staffIds) : Promise.resolve({ data: [] }),
    contactIds.length
      ? admin.from('email_contacts').select('id, first_name, last_name').in('id', contactIds)
      : Promise.resolve({ data: [] }),
  ])
  const staffNames = new Map(((staffRows || []) as { id: string; full_name: string }[]).map((s) => [s.id, s.full_name]))
  const contactNames = new Map(
    ((contactRows || []) as { id: string; first_name: string | null; last_name: string | null }[]).map((c) => [
      c.id,
      [c.first_name, c.last_name].filter(Boolean).join(' '),
    ])
  )

  return NextResponse.json({
    enrollments: rows.map((r) => {
      const seq = Array.isArray(r.outreach_sequences) ? r.outreach_sequences[0] : r.outreach_sequences
      return {
        id: r.id,
        sequence_id: r.sequence_id,
        contact_id: r.contact_id,
        email: r.email,
        sender_email: r.sender_email,
        status: r.status,
        next_step: r.next_step,
        next_run_at: r.next_run_at,
        last_sent_at: r.last_sent_at,
        stopped_reason: r.stopped_reason,
        created_at: r.created_at,
        sequence_name: seq?.name || null,
        total_steps: storedSteps(seq?.steps).length,
        sender_name: r.sender_staff_id ? staffNames.get(r.sender_staff_id) || null : null,
        contact_name: r.contact_id ? contactNames.get(r.contact_id) || null : null,
      }
    }),
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
  })
}

/**
 * Enroll contacts; the current staff member is the sender. Body:
 * { sequenceId, contactIds: string[] }. Suppressed addresses and people
 * already in the sequence are skipped.
 */
export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isGmailConfigured()) {
    return NextResponse.json(
      { error: 'Gmail is not connected yet. Sequences need it to send from your mailbox and to notice replies.' },
      { status: 400 }
    )
  }

  if (!isWorkspaceAddress(staff.email)) {
    return NextResponse.json(
      { error: `Sequences send from your own mailbox, and ${staff.email} isn't a Google Workspace address on our domain.` },
      { status: 400 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as { sequenceId?: string; contactIds?: unknown }
  if (!isUuid(body.sequenceId)) return NextResponse.json({ error: 'Choose a sequence' }, { status: 400 })
  const contactIds = Array.isArray(body.contactIds) ? [...new Set(body.contactIds.filter(isUuid))] : []
  if (contactIds.length === 0) return NextResponse.json({ error: 'Choose at least one contact' }, { status: 400 })
  if (contactIds.length > MAX_ENROLL) {
    return NextResponse.json({ error: `Enroll at most ${MAX_ENROLL} contacts at a time` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: sequence, error: seqError } = await admin
    .from('outreach_sequences')
    .select('id, name, steps, is_archived')
    .eq('id', body.sequenceId)
    .maybeSingle()
  if (seqError) return NextResponse.json({ error: seqError.message }, { status: 500 })
  if (!sequence || sequence.is_archived) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
  const steps = storedSteps(sequence.steps)
  if (steps.length === 0) return NextResponse.json({ error: 'This sequence has no steps' }, { status: 400 })

  const { data: contacts, error: contactError } = await admin
    .from('email_contacts')
    .select('id, email')
    .in('id', contactIds)
  if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 })

  type Row = { id: string; email: string }
  let split: { allowed: Row[]; suppressed: Row[] }
  try {
    split = await filterSuppressed((contacts || []) as Row[])
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Suppression check failed' }, { status: 500 })
  }
  const { allowed, suppressed } = split

  const senderEmail = staff.email.trim().toLowerCase()
  const firstRun = addDays(new Date(), steps[0].delay_days).toISOString()
  let enrolled = 0
  if (allowed.length > 0) {
    const { data: inserted, error } = await admin
      .from('outreach_enrollments')
      .upsert(
        allowed.map((c) => ({
          sequence_id: sequence.id,
          contact_id: c.id,
          email: c.email,
          sender_staff_id: staff.id,
          sender_email: senderEmail,
          status: 'active',
          next_step: 1,
          next_run_at: firstRun,
          created_by: staff.id,
        })),
        { onConflict: 'sequence_id,email', ignoreDuplicates: true }
      )
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enrolled = (inserted || []).length
  }

  await logStaffAction(staff.id, 'outreach.enroll', 'outreach_sequence', sequence.id, {
    sequence: sequence.name,
    enrolled,
    requested: contactIds.length,
    suppressed: suppressed.length,
  })

  return NextResponse.json({
    enrolled,
    alreadyEnrolled: allowed.length - enrolled,
    suppressed: suppressed.map((c) => c.email),
    notFound: contactIds.length - (contacts || []).length,
    warning: getSyncMailboxes().includes(senderEmail)
      ? null
      : `Your mailbox (${senderEmail}) isn't in GMAIL_SYNC_MAILBOXES, so replies won't show on contact timelines. Replies still stop the sequence.`,
  })
}
