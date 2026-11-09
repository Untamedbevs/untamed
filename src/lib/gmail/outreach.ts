/**
 * Outreach sequences: step validation, merge tags, permissions, and timing.
 * No server imports, so the admin pages can use it too.
 *
 * A sequence is a list of plain-text steps. Step 1 waits `delay_days` after
 * enrollment; each later step waits `delay_days` after the previous one and
 * goes out as a reply in the same thread. Any reply, bounce, or suppression
 * ends the enrollment.
 */

import { fillTags, type MergeVars } from '@/lib/email/blocks'

export interface OutreachStep {
  delay_days: number
  /** Required for step 1. Later steps reply in the thread ("Re: ...") when blank. */
  subject: string
  body: string
}

export type OutreachStatus = 'active' | 'replied' | 'completed' | 'stopped' | 'bounced' | 'suppressed'

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  active: 'Active',
  replied: 'Replied',
  completed: 'Completed',
  stopped: 'Stopped',
  bounced: 'Bounced',
  suppressed: 'Suppressed',
}

export const MAX_STEPS = 10
export const MAX_DELAY_DAYS = 90
export const DEFAULT_DAILY_CAP = 40
export const OUTREACH_TIMEZONE = 'America/New_York'

export const OUTREACH_MERGE_TAGS: { tag: string; label: string }[] = [
  { tag: '{{first_name|there}}', label: 'First name' },
  { tag: '{{last_name}}', label: 'Last name' },
  { tag: '{{name}}', label: 'Full name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{sender_first_name}}', label: 'Your first name' },
  { tag: '{{sender_name}}', label: 'Your name' },
  { tag: '{{site_url}}', label: 'Site URL' },
]

/** Creating and editing sequences; enrolling and sending only need contact access. */
export function canEditSequences(role: string): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'contractor_full'
}

export function sanitizeSteps(input: unknown): { steps: OutreachStep[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Add at least one step.' }
  if (input.length > MAX_STEPS) return { error: `A sequence can have at most ${MAX_STEPS} steps.` }

  const steps: OutreachStep[] = []
  for (let i = 0; i < input.length; i++) {
    const raw = (input[i] || {}) as Record<string, unknown>
    const delay = Math.round(Number(raw.delay_days))
    const subject = typeof raw.subject === 'string' ? raw.subject.replace(/[\r\n]+/g, ' ').trim() : ''
    const body = typeof raw.body === 'string' ? raw.body.replace(/\r\n?/g, '\n').trim() : ''
    if (!Number.isFinite(delay) || delay < 0 || delay > MAX_DELAY_DAYS) {
      return { error: `Step ${i + 1}: wait must be 0 to ${MAX_DELAY_DAYS} days.` }
    }
    if (i > 0 && delay < 1) return { error: `Step ${i + 1}: wait at least 1 day after the previous step.` }
    if (i === 0 && !subject) return { error: 'Step 1 needs a subject.' }
    if (subject.length > 200) return { error: `Step ${i + 1}: subject is too long.` }
    if (!body) return { error: `Step ${i + 1} needs a message.` }
    if (body.length > 10_000) return { error: `Step ${i + 1}: message is too long.` }
    steps.push({ delay_days: delay, subject, body })
  }
  return { steps }
}

/** Steps as stored; tolerant of hand-edited rows. */
export function storedSteps(input: unknown): OutreachStep[] {
  if (!Array.isArray(input)) return []
  return input
    .map((s) => (s || {}) as Record<string, unknown>)
    .map((s) => ({
      delay_days: Math.max(0, Math.round(Number(s.delay_days) || 0)),
      subject: typeof s.subject === 'string' ? s.subject : '',
      body: typeof s.body === 'string' ? s.body : '',
    }))
    .filter((s) => s.body.trim())
}

export function outreachVars(
  contact: { email: string; first_name?: string | null; last_name?: string | null },
  sender: { full_name?: string | null; email: string },
  siteUrl?: string
): MergeVars {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
  const senderName = (sender.full_name || '').trim()
  return {
    first_name: contact.first_name?.trim() || null,
    last_name: contact.last_name?.trim() || null,
    name: name || null,
    email: contact.email,
    sender_name: senderName || null,
    sender_first_name: senderName.split(/\s+/)[0] || null,
    site_url: siteUrl || null,
  }
}

export function renderOutreachText(text: string, vars: MergeVars): string {
  return fillTags(text, vars)
}

export function replySubject(subject: string): string {
  const s = subject.trim()
  return /^re:/i.test(s) ? s : `Re: ${s}`
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** Milliseconds `timeZone` is ahead of UTC at `date`. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - (date.getTime() - date.getMilliseconds())
}

/** Midnight at the start of `date`'s day in `timeZone`. */
export function startOfDay(date: Date, timeZone = OUTREACH_TIMEZONE): Date {
  const offset = zoneOffsetMs(date, timeZone)
  const local = new Date(date.getTime() + offset)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - offset)
}
