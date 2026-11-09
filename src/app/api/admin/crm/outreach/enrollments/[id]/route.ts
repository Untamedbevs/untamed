export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'

/** Stop an active enrollment. Body: { action: 'stop' }. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { action?: string }
  if (body.action !== 'stop') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_enrollments')
    .update({ status: 'stopped', next_run_at: null, stopped_reason: `Stopped by ${staff.full_name || staff.email}` })
    .eq('id', id)
    .eq('status', 'active')
    .select('id, sequence_id, email, status')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'This enrollment is not active' }, { status: 409 })

  await logStaffAction(staff.id, 'outreach.stop', 'outreach_enrollment', id, { sequence_id: data.sequence_id })
  return NextResponse.json({ enrollment: data })
}
