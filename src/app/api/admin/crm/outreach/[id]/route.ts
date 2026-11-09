export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'
import { canEditSequences, sanitizeSteps } from '@/lib/gmail/outreach'

const SEQUENCE_COLUMNS = 'id, name, description, steps, daily_cap_per_sender, is_archived, created_by, created_at, updated_at'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('outreach_sequences').select(SEQUENCE_COLUMNS).eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
  return NextResponse.json({ sequence: data })
}

/**
 * Edit or archive a sequence. Body: any of { name, description, steps,
 * daily_cap_per_sender, is_archived }. Archiving stops its active enrollments;
 * step edits apply to the steps people haven't received yet.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditSequences(staff.role)) {
    return NextResponse.json({ error: 'Only admins and full contractors can edit sequences' }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const update: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    update.name = name
  }
  if (body.description !== undefined) {
    update.description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) || null : null
  }
  if (body.daily_cap_per_sender !== undefined) {
    const cap = Math.round(Number(body.daily_cap_per_sender))
    if (!Number.isFinite(cap) || cap < 1 || cap > 500) {
      return NextResponse.json({ error: 'Daily cap must be between 1 and 500' }, { status: 400 })
    }
    update.daily_cap_per_sender = cap
  }
  if (body.steps !== undefined) {
    const parsed = sanitizeSteps(body.steps)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    update.steps = parsed.steps
  }
  if (body.is_archived !== undefined) update.is_archived = body.is_archived === true
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_sequences')
    .update(update)
    .eq('id', id)
    .select(SEQUENCE_COLUMNS)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  let stopped = 0
  if (update.is_archived === true) {
    const { count } = await admin
      .from('outreach_enrollments')
      .update({ status: 'stopped', next_run_at: null, stopped_reason: 'Sequence archived' }, { count: 'exact' })
      .eq('sequence_id', id)
      .eq('status', 'active')
    stopped = count || 0
  }

  await logStaffAction(
    staff.id,
    update.is_archived === true ? 'outreach.sequence_archive' : 'outreach.sequence_update',
    'outreach_sequence',
    id,
    { fields: Object.keys(update), stopped_enrollments: stopped }
  )
  return NextResponse.json({ sequence: data, stoppedEnrollments: stopped })
}
