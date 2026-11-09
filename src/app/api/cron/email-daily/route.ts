/**
 * Cron: daily email housekeeping (14:00 UTC, mid-morning US Eastern).
 *
 * 1. Enroll time-based flows: lapsed customers, points ready to redeem, birthdays.
 * 2. Deliverability check: if the 7-day marketing complaint rate is over the
 *    threshold in email settings, pause all marketing and alert staff.
 * 3. Retention: clear old email bodies, drop old webhook payloads and queue rows.
 * 4. Expire unconfirmed signup requests.
 *
 * Requires `CRON_SECRET`; refuses every request while it is unset.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailSettings, setMarketingPaused } from '@/lib/email/settings'
import { dayKey, raiseAlert } from '@/lib/email/alerts'

/** Minimum 7-day volume before rates are judged. */
const HEALTH_MIN_SENT = 500

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request, 'cron/email-daily')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const settings = await getEmailSettings()
  const out: Record<string, unknown> = {}

  const scan = await admin.rpc('email_flow_scan')
  out.flowScan = scan.error ? { error: scan.error.message } : scan.data

  const { data: health, error: healthError } = await admin.rpc('email_health', { p_days: 7, p_stream: 'marketing' })
  const h = (health as { sent: number; delivered: number; bounced: number; complaints: number }[] | null)?.[0]
  if (healthError) {
    out.health = { error: healthError.message }
  } else if (h) {
    const complaintRate = h.delivered > 0 ? h.complaints / h.delivered : 0
    const bounceRate = h.sent > 0 ? h.bounced / h.sent : 0
    out.health = { ...h, complaintRate, bounceRate }
    if (h.sent >= HEALTH_MIN_SENT && complaintRate > settings.complaint_pause_rate && !settings.marketing_paused) {
      const reason = `7-day complaint rate ${(complaintRate * 100).toFixed(2)}% is above ${(settings.complaint_pause_rate * 100).toFixed(2)}%`
      await setMarketingPaused(true, reason, null)
      await raiseAlert({
        kind: 'marketing_paused',
        severity: 'critical',
        message: `All marketing email was paused automatically. ${reason}.`,
        details: { ...h },
        dedupeKey: dayKey('marketing_auto_pause'),
      })
      out.pausedMarketing = true
    } else if (h.sent >= HEALTH_MIN_SENT && bounceRate > settings.bounce_pause_rate / 2) {
      await raiseAlert({
        kind: 'bounce_rate',
        severity: 'warning',
        message: `7-day hard-bounce rate is ${(bounceRate * 100).toFixed(1)}%. Clean the list before it hurts deliverability.`,
        details: { ...h },
        dedupeKey: dayKey('bounce_warning'),
      })
    }
  }

  const retention = await admin.rpc('email_apply_retention', { p_body_days: settings.retention_body_days })
  out.retention = retention.error ? { error: retention.error.message } : retention.data

  const { count: expired } = await admin
    .from('email_signup_requests')
    .update({ status: 'expired' }, { count: 'exact' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
  out.signupRequestsExpired = expired || 0

  return NextResponse.json(out)
}
