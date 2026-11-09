export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts } from '@/lib/auth/resolve-staff'
import { logStaffAction } from '@/lib/audit'
import { isGmailConfigured } from '@/lib/gmail/client'
import { getSyncMailboxes } from '@/lib/gmail/sync'
import { outreachBlocker } from '@/lib/gmail/outreach-run'
import { canEditSequences, DEFAULT_DAILY_CAP, sanitizeSteps } from '@/lib/gmail/outreach'

const STATUS_PAGE = 1000
const STATUS_MAX_ROWS = 20_000

/** Sequences with enrollment counts, plus what the current staff member can do. */
export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const includeArchived = request.nextUrl.searchParams.get('archived') === '1'
  const admin = createAdminClient()

  let query = admin
    .from('outreach_sequences')
    .select('id, name, description, steps, daily_cap_per_sender, is_archived, created_by, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (!includeArchived) query = query.eq('is_archived', false)
  const { data: sequences, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrollment counts per sequence and status.
  const counts: Record<string, Record<string, number>> = {}
  const ids = (sequences || []).map((s) => s.id)
  if (ids.length > 0) {
    for (let from = 0; from < STATUS_MAX_ROWS; from += STATUS_PAGE) {
      const { data: rows, error: countError } = await admin
        .from('outreach_enrollments')
        .select('sequence_id, status')
        .in('sequence_id', ids)
        .order('id')
        .range(from, from + STATUS_PAGE - 1)
      if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
      for (const r of rows || []) {
        counts[r.sequence_id] = counts[r.sequence_id] || {}
        counts[r.sequence_id][r.status] = (counts[r.sequence_id][r.status] || 0) + 1
      }
      if (!rows || rows.length < STATUS_PAGE) break
    }
  }

  const myMailbox = staff.email.trim().toLowerCase()
  return NextResponse.json({
    sequences: (sequences || []).map((s) => ({ ...s, counts: counts[s.id] || {} })),
    me: { id: staff.id, email: staff.email, full_name: staff.full_name },
    permissions: { canEdit: canEditSequences(staff.role) },
    config: {
      gmailConfigured: isGmailConfigured(),
      blocker: outreachBlocker(),
      mailboxSynced: getSyncMailboxes().includes(myMailbox),
    },
  })
}

/** Create a sequence. Body: { name, description, steps, daily_cap_per_sender }. */
export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditSequences(staff.role)) {
    return NextResponse.json({ error: 'Only admins and full contractors can create sequences' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) || null : null
  const cap = body.daily_cap_per_sender === undefined ? DEFAULT_DAILY_CAP : Math.round(Number(body.daily_cap_per_sender))
  if (!Number.isFinite(cap) || cap < 1 || cap > 500) {
    return NextResponse.json({ error: 'Daily cap must be between 1 and 500' }, { status: 400 })
  }
  const parsed = sanitizeSteps(body.steps)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_sequences')
    .insert({ name, description, steps: parsed.steps, daily_cap_per_sender: cap, created_by: staff.id })
    .select('id, name, description, steps, daily_cap_per_sender, is_archived, created_by, created_at, updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staff.id, 'outreach.sequence_create', 'outreach_sequence', data.id, {
    name,
    steps: parsed.steps.length,
    daily_cap_per_sender: cap,
  })
  return NextResponse.json({ sequence: { ...data, counts: {} } })
}
