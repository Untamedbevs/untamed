export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canSendMarketing } from '@/lib/auth/resolve-staff'
import { getMarketingReadiness } from '@/lib/email/config'
import {
  EDITABLE_SETTINGS,
  getEmailSettings,
  setMarketingPaused,
  updateEmailSettings,
  type EmailSettings,
} from '@/lib/email/settings'
import { logStaffAction } from '@/lib/audit'

const LIMITS: Record<(typeof EDITABLE_SETTINGS)[number], [number, number] | null> = {
  weekly_frequency_cap: [1, 50],
  quiet_hours_start: [0, 23],
  quiet_hours_end: [0, 23],
  default_timezone: null,
  sunset_days: [30, 3650],
  sunset_min_sends: [1, 100],
  approval_threshold: [0, 1_000_000],
  complaint_pause_rate: [0.0005, 0.05],
  bounce_pause_rate: [0.005, 0.5],
  retention_body_days: [30, 3650],
}

/** Settings, setup status, and (for admins) the recent staff audit log. */
export async function GET() {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendMarketing(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const [settings, { data: audit }, { data: staffRows }] = await Promise.all([
    getEmailSettings(),
    admin.from('staff_audit_log').select('*').order('created_at', { ascending: false }).limit(100),
    admin.from('staff').select('id, full_name'),
  ])
  const names = new Map((staffRows || []).map((s) => [s.id, s.full_name]))

  return NextResponse.json({
    settings,
    readiness: getMarketingReadiness(),
    audit: (audit || []).map((a) => ({ ...a, staff_name: a.staff_id ? names.get(a.staff_id) || 'Unknown' : 'System' })),
  })
}

/**
 * Body: any of the editable settings, and/or { marketing_paused, reason }
 * to flip the kill switch.
 */
export async function PATCH(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendMarketing(staff.role)) return NextResponse.json({ error: 'Only admins can change email settings.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  let settings: EmailSettings | null = null

  if (typeof body.marketing_paused === 'boolean') {
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 300) : 'Paused by staff'
    settings = await setMarketingPaused(body.marketing_paused, reason, staff.id)
    await logStaffAction(staff.id, body.marketing_paused ? 'marketing.pause' : 'marketing.resume', 'email_settings', null, { reason })
  }

  const patch: Partial<EmailSettings> = {}
  for (const key of EDITABLE_SETTINGS) {
    if (body[key] === undefined) continue
    const limits = LIMITS[key]
    if (limits === null) {
      const tz = String(body[key])
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz })
      } catch {
        return NextResponse.json({ error: `Unknown time zone: ${tz}` }, { status: 400 })
      }
      ;(patch as Record<string, unknown>)[key] = tz
      continue
    }
    const n = Number(body[key])
    if (!Number.isFinite(n) || n < limits[0] || n > limits[1]) {
      return NextResponse.json({ error: `${key} must be between ${limits[0]} and ${limits[1]}` }, { status: 400 })
    }
    ;(patch as Record<string, unknown>)[key] = key.endsWith('_rate') ? n : Math.round(n)
  }
  if (Object.keys(patch).length > 0) {
    settings = await updateEmailSettings(patch, staff.id)
    await logStaffAction(staff.id, 'email_settings.update', 'email_settings', null, patch)
  }

  return NextResponse.json({ settings: settings || (await getEmailSettings()) })
}
