export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canSendMarketing } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'

/** Mark an alert resolved. Body: { id } */
export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendMarketing(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  if (!isUuid(body.id)) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('email_alerts')
    .update({ resolved_at: new Date().toISOString(), resolved_by: staff.id })
    .eq('id', body.id)
    .is('resolved_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staff.id, 'alert.resolve', 'email_alert', body.id)
  return NextResponse.json({ ok: true })
}
