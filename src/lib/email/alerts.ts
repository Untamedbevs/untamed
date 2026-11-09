/**
 * Email-system alerts: complaint/bounce spikes, failed sending runs, Gmail
 * sync failures. Stored in `email_alerts` (shown on the email dashboard) and
 * emailed once to EMAIL_ALERT_RECIPIENTS. A dedupe key keeps a recurring
 * problem to one alert per key. Best-effort: never throws.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/transport'
import { escapeHtml } from '@/lib/email/blocks'
import { getSiteOrigin } from '@/lib/email/config'

export type AlertKind =
  | 'complaint_rate'
  | 'bounce_rate'
  | 'worker_failure'
  | 'flow_failure'
  | 'gmail_sync_failure'
  | 'outreach_failure'
  | 'marketing_paused'
  | 'other'

export interface RaiseAlertParams {
  kind: AlertKind
  severity?: 'info' | 'warning' | 'critical'
  message: string
  details?: Record<string, unknown>
  /** e.g. `worker_failure:2026-11-05`; a repeat with the same key is ignored. */
  dedupeKey?: string
}

function recipients(): string[] {
  return (process.env.EMAIL_ALERT_RECIPIENTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
}

export function dayKey(prefix: string, date = new Date()): string {
  return `${prefix}:${date.toISOString().slice(0, 10)}`
}

export async function raiseAlert(params: RaiseAlertParams): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('email_alerts')
      .insert({
        kind: params.kind,
        severity: params.severity || 'warning',
        message: params.message.slice(0, 1000),
        details: params.details || {},
        dedupe_key: params.dedupeKey || null,
      })
      .select('id')
      .single()

    if (error) {
      // 23505: already alerted for this key.
      if (error.code !== '23505') console.error('[alerts] insert failed:', error.message)
      return false
    }

    const to = recipients()
    if (to.length > 0) {
      try {
        await sendEmail({
          to,
          subject: `[Untamed email ${params.severity || 'warning'}] ${params.message.slice(0, 120)}`,
          html: `<p>${escapeHtml(params.message)}</p>
<pre style="font-size:12px;white-space:pre-wrap;">${escapeHtml(JSON.stringify(params.details || {}, null, 2))}</pre>
<p><a href="${escapeHtml(getSiteOrigin())}/admin/crm/email">Open the email dashboard</a></p>`,
          text: `${params.message}\n\n${JSON.stringify(params.details || {}, null, 2)}\n\n${getSiteOrigin()}/admin/crm/email`,
          stream: 'transactional',
        })
        await admin.from('email_alerts').update({ notified_at: new Date().toISOString() }).eq('id', data.id)
      } catch (err) {
        console.error('[alerts] notify failed:', err instanceof Error ? err.message : err)
      }
    }
    return true
  } catch (err) {
    console.error('[alerts] failed:', err instanceof Error ? err.message : err)
    return false
  }
}
