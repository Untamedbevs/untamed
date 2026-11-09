/**
 * Staff-editable email policy (the single `email_settings` row): marketing
 * kill switch, frequency cap, quiet hours, sunset, approvals, auto-pause
 * thresholds, retention. Secrets and infrastructure stay in env.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface EmailSettings {
  marketing_paused: boolean
  marketing_paused_reason: string | null
  marketing_paused_at: string | null
  weekly_frequency_cap: number
  quiet_hours_start: number
  quiet_hours_end: number
  default_timezone: string
  sunset_days: number
  sunset_min_sends: number
  approval_threshold: number
  complaint_pause_rate: number
  bounce_pause_rate: number
  retention_body_days: number
  updated_at: string | null
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  marketing_paused: false,
  marketing_paused_reason: null,
  marketing_paused_at: null,
  weekly_frequency_cap: 3,
  quiet_hours_start: 21,
  quiet_hours_end: 8,
  default_timezone: 'America/New_York',
  sunset_days: 180,
  sunset_min_sends: 8,
  approval_threshold: 500,
  complaint_pause_rate: 0.003,
  bounce_pause_rate: 0.05,
  retention_body_days: 365,
  updated_at: null,
}

export const EDITABLE_SETTINGS = [
  'weekly_frequency_cap',
  'quiet_hours_start',
  'quiet_hours_end',
  'default_timezone',
  'sunset_days',
  'sunset_min_sends',
  'approval_threshold',
  'complaint_pause_rate',
  'bounce_pause_rate',
  'retention_body_days',
] as const

export async function getEmailSettings(): Promise<EmailSettings> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('email_settings').select('*').maybeSingle()
  if (error || !data) {
    if (error) console.error('[email-settings] load failed, using defaults:', error.message)
    return DEFAULT_EMAIL_SETTINGS
  }
  return {
    ...DEFAULT_EMAIL_SETTINGS,
    ...data,
    complaint_pause_rate: Number(data.complaint_pause_rate),
    bounce_pause_rate: Number(data.bounce_pause_rate),
  } as EmailSettings
}

export async function updateEmailSettings(
  patch: Partial<EmailSettings>,
  staffId: string | null
): Promise<EmailSettings> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('email_settings')
    .update({ ...patch, updated_by: staffId, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw new Error(`Settings update failed: ${error.message}`)
  return getEmailSettings()
}

/** Turn the marketing kill switch on (e.g. complaint spike) or off. */
export async function setMarketingPaused(paused: boolean, reason: string | null, staffId: string | null) {
  return updateEmailSettings(
    {
      marketing_paused: paused,
      marketing_paused_reason: paused ? reason : null,
      marketing_paused_at: paused ? new Date().toISOString() : null,
    },
    staffId
  )
}

/** True when `date` falls inside quiet hours in `timeZone`. */
export function isQuietHour(date: Date, timeZone: string, start: number, end: number): boolean {
  let hour: number
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date)
    )
  } catch {
    hour = date.getUTCHours()
  }
  if (start === end) return false
  return start > end ? hour >= start || hour < end : hour >= start && hour < end
}

/** Primary time zone for a US state (used when a contact has none saved). */
const STATE_TIMEZONES: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DC: 'America/New_York',
  DE: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver',
  NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver', PR: 'America/Puerto_Rico',
  GU: 'Pacific/Guam',
}

export function timezoneFor(contact: { timezone?: string | null; state_code?: string | null }, fallback: string): string {
  if (contact.timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: contact.timezone })
      return contact.timezone
    } catch {
      // fall through
    }
  }
  return (contact.state_code && STATE_TIMEZONES[contact.state_code]) || fallback
}
