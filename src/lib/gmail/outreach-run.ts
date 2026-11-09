/**
 * Sends due outreach sequence steps (called by /api/cron/outreach).
 *
 * For each active enrollment whose next step is due:
 *   1. Ends it if anyone replied: an inbound `email_messages` row from the
 *      address (or in its thread) since enrollment, or, because the sync
 *      may lag, a live search of the sender's mailbox.
 *   2. Ends it if the address is suppressed.
 *   3. Holds it until tomorrow if the sender reached the sequence's daily cap.
 *   4. Sends the step from the sender's mailbox, in the same thread, then
 *      schedules the next step or marks the enrollment completed.
 *
 * Nothing sends without Gmail (replies couldn't be detected) or without a
 * postal address for the footer.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { isSuppressed } from '@/lib/messaging/suppressions'
import { quoteFilterValue } from '@/lib/supabase/postgrest'
import { getPostalAddress, getSiteOrigin } from '@/lib/email/config'
import { getHeader, getMessageMetadata, isGmailConfigured, listMessages } from '@/lib/gmail/client'
import { isAutomatedSender } from '@/lib/gmail/parse'
import { sendAsStaff, SuppressedRecipientError } from '@/lib/gmail/send'
import {
  addDays,
  outreachVars,
  renderOutreachText,
  replySubject,
  startOfDay,
  storedSteps,
} from '@/lib/gmail/outreach'

type Admin = ReturnType<typeof createAdminClient>

const MAX_PER_RUN = 60
/** A claimed enrollment is skipped by other runs until this passes. */
const CLAIM_MS = 15 * 60 * 1000
const RETRY_MS = 60 * 60 * 1000
const AUTO_REPLY_SUBJECT = /^\s*(automatic reply|auto(?:matic)?[- ]?reply|out of (?:the )?office)\b/i

interface DueEnrollment {
  id: string
  sequence_id: string
  contact_id: string | null
  email: string
  sender_staff_id: string | null
  sender_email: string
  next_step: number
  next_run_at: string
  gmail_thread_id: string | null
  last_rfc_message_id: string | null
  created_at: string
  outreach_sequences:
    | { id: string; name: string; steps: unknown; daily_cap_per_sender: number; is_archived: boolean }
    | { id: string; name: string; steps: unknown; daily_cap_per_sender: number; is_archived: boolean }[]
    | null
}

interface Sender {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
}

export interface OutreachRunResult {
  due: number
  sent: number
  completed: number
  replied: number
  suppressed: number
  stopped: number
  capped: number
  failed: number
  errors: string[]
  waiting?: string
}

function emptyResult(): OutreachRunResult {
  return { due: 0, sent: 0, completed: 0, replied: 0, suppressed: 0, stopped: 0, capped: 0, failed: 0, errors: [] }
}

export function outreachBlocker(): string | null {
  if (!isGmailConfigured()) return 'Gmail is not connected, so replies could not be detected. Sequences are on hold.'
  if (!getPostalAddress()) return 'EMAIL_POSTAL_ADDRESS is not set; outreach needs it in the footer. Sequences are on hold.'
  return null
}

async function setStatus(admin: Admin, id: string, status: string, reason: string | null) {
  const { error } = await admin
    .from('outreach_enrollments')
    .update({ status, next_run_at: null, stopped_reason: reason })
    .eq('id', id)
  if (error) throw new Error(`Could not update enrollment: ${error.message}`)
}

async function repliedInLog(admin: Admin, e: DueEnrollment): Promise<boolean> {
  let query = admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .gte('sent_at', e.created_at)
  query = e.gmail_thread_id
    ? query.or(
        `from_email.eq.${quoteFilterValue(e.email)},and(gmail_thread_id.eq.${quoteFilterValue(e.gmail_thread_id)},mailbox.eq.${quoteFilterValue(e.sender_email)})`
      )
    : query.eq('from_email', e.email)
  const { count, error } = await query
  if (error) throw new Error(`Reply check failed: ${error.message}`)
  return (count || 0) > 0
}

/** Live check of the sender's mailbox, ignoring auto-replies. */
async function repliedInGmail(e: DueEnrollment): Promise<boolean> {
  const after = Math.floor(new Date(e.created_at).getTime() / 1000)
  const { messages } = await listMessages(e.sender_email, { q: `from:${e.email} after:${after} -in:chats`, maxResults: 5 })
  for (const ref of messages) {
    const meta = await getMessageMetadata(e.sender_email, ref.id, ['Subject', 'Auto-Submitted'])
    if (isAutomatedSender(null, getHeader(meta, 'Auto-Submitted'))) continue
    if (AUTO_REPLY_SUBJECT.test(getHeader(meta, 'Subject') || '')) continue
    return true
  }
  return false
}

async function sentTodayBy(admin: Admin, senderId: string, since: Date): Promise<number> {
  const { count, error } = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('stream', 'outreach')
    .eq('direction', 'outbound')
    .eq('sent_by', senderId)
    .gte('sent_at', since.toISOString())
  if (error) throw new Error(`Could not count today's outreach: ${error.message}`)
  return count || 0
}

async function threadSubject(admin: Admin, enrollmentId: string): Promise<string | null> {
  const { data } = await admin
    .from('email_messages')
    .select('subject')
    .eq('outreach_enrollment_id', enrollmentId)
    .eq('direction', 'outbound')
    .order('sent_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.subject || null
}

export async function runOutreach(deadline: number): Promise<OutreachRunResult> {
  const result = emptyResult()
  const blocker = outreachBlocker()
  if (blocker) return { ...result, waiting: blocker }

  const admin = createAdminClient()
  const now = new Date()
  const { data, error } = await admin
    .from('outreach_enrollments')
    .select(
      'id, sequence_id, contact_id, email, sender_staff_id, sender_email, next_step, next_run_at, gmail_thread_id, last_rfc_message_id, created_at, outreach_sequences(id, name, steps, daily_cap_per_sender, is_archived)'
    )
    .eq('status', 'active')
    .not('next_run_at', 'is', null)
    .lte('next_run_at', now.toISOString())
    .order('next_run_at', { ascending: true })
    .limit(MAX_PER_RUN)
  if (error) throw new Error(`Could not load due enrollments: ${error.message}`)

  const due = (data || []) as DueEnrollment[]
  result.due = due.length
  if (due.length === 0) return result

  const senderIds = [...new Set(due.map((e) => e.sender_staff_id).filter((id): id is string => !!id))]
  const emails = [...new Set(due.map((e) => e.email))]
  const [{ data: staffRows }, { data: contactRows }] = await Promise.all([
    senderIds.length
      ? admin.from('staff').select('id, email, full_name, is_active').in('id', senderIds)
      : Promise.resolve({ data: [] as Sender[] }),
    admin.from('email_contacts').select('id, email, first_name, last_name').in('email', emails),
  ])
  const senders = new Map(((staffRows || []) as Sender[]).map((s) => [s.id, s]))
  const contacts = new Map(
    ((contactRows || []) as { id: string; email: string; first_name: string | null; last_name: string | null }[]).map((c) => [c.email, c])
  )

  const dayStart = startOfDay(now)
  const sentToday = new Map<string, number>()
  const siteUrl = getSiteOrigin()

  for (const e of due) {
    if (Date.now() > deadline) break

    // Claim it so an overlapping run can't send the same step.
    const { data: claimed } = await admin
      .from('outreach_enrollments')
      .update({ next_run_at: new Date(Date.now() + CLAIM_MS).toISOString() })
      .eq('id', e.id)
      .eq('status', 'active')
      .eq('next_run_at', e.next_run_at)
      .select('id')
    if (!claimed || claimed.length === 0) continue

    try {
      const sequence = Array.isArray(e.outreach_sequences) ? e.outreach_sequences[0] : e.outreach_sequences
      if (!sequence || sequence.is_archived) {
        await setStatus(admin, e.id, 'stopped', 'Sequence archived')
        result.stopped++
        continue
      }
      const sender = e.sender_staff_id ? senders.get(e.sender_staff_id) : undefined
      if (!sender || !sender.is_active) {
        await setStatus(admin, e.id, 'stopped', 'Sender is no longer an active staff member')
        result.stopped++
        continue
      }

      const steps = storedSteps(sequence.steps)
      const idx = e.next_step - 1
      if (idx < 0 || idx >= steps.length) {
        await setStatus(admin, e.id, 'completed', null)
        result.completed++
        continue
      }

      if ((await repliedInLog(admin, e)) || (await repliedInGmail(e))) {
        await setStatus(admin, e.id, 'replied', 'Replied')
        result.replied++
        continue
      }
      if (await isSuppressed(e.email)) {
        await setStatus(admin, e.id, 'suppressed', 'Address is suppressed')
        result.suppressed++
        continue
      }

      const capKey = sender.id
      if (!sentToday.has(capKey)) sentToday.set(capKey, await sentTodayBy(admin, sender.id, dayStart))
      if ((sentToday.get(capKey) || 0) >= sequence.daily_cap_per_sender) {
        // Tomorrow, 9:00-10:30 Eastern, spread out.
        const retryAt = new Date(dayStart.getTime() + 33 * 3_600_000 + Math.floor(Math.random() * 90) * 60_000)
        await admin.from('outreach_enrollments').update({ next_run_at: retryAt.toISOString() }).eq('id', e.id)
        result.capped++
        continue
      }

      const contact = contacts.get(e.email) || { email: e.email, first_name: null, last_name: null }
      const vars = outreachVars(contact, sender, siteUrl)
      const step = steps[idx]
      let subject: string
      if (idx === 0 || step.subject.trim()) {
        subject = renderOutreachText(step.subject, vars).trim()
      } else {
        const first = (await threadSubject(admin, e.id)) || renderOutreachText(steps[0].subject, vars)
        subject = replySubject(first)
      }
      const body = renderOutreachText(step.body, vars).trim()
      if (!subject || !body) throw new Error(`Step ${idx + 1} renders an empty subject or message`)

      const sent = await sendAsStaff({
        staff: { id: sender.id, email: e.sender_email, full_name: sender.full_name },
        to: e.email,
        subject,
        body,
        contactId: e.contact_id,
        threadId: idx > 0 ? e.gmail_thread_id : null,
        inReplyTo: idx > 0 ? e.last_rfc_message_id : null,
        references: idx > 0 ? e.last_rfc_message_id : null,
        outreachEnrollmentId: e.id,
      })
      sentToday.set(capKey, (sentToday.get(capKey) || 0) + 1)
      result.sent++

      const sentAt = new Date()
      const next = steps[idx + 1]
      const advance = {
        next_step: e.next_step + 1,
        last_sent_at: sentAt.toISOString(),
        gmail_thread_id: sent.gmailThreadId || e.gmail_thread_id,
        last_rfc_message_id: sent.rfcMessageId || e.last_rfc_message_id,
        ...(next
          ? { next_run_at: addDays(sentAt, next.delay_days).toISOString() }
          : { status: 'completed', next_run_at: null }),
      }
      // The step already went out, so try hard to record it (a failed update
      // would resend it once the claim expires).
      let updateError: string | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await admin.from('outreach_enrollments').update(advance).eq('id', e.id)
        updateError = error ? error.message : null
        if (!updateError) break
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
      if (updateError) {
        console.error(`[outreach] sent step ${e.next_step} of ${e.id} but could not update it:`, updateError)
        result.errors.push(`Enrollment ${e.id}: sent but not updated (${updateError})`)
      }
      if (!next) result.completed++
    } catch (err) {
      if (err instanceof SuppressedRecipientError) {
        await setStatus(admin, e.id, 'suppressed', 'Address is suppressed').catch(() => undefined)
        result.suppressed++
        continue
      }
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[outreach] enrollment ${e.id} failed:`, message)
      result.failed++
      if (result.errors.length < 10) result.errors.push(`Enrollment ${e.id}: ${message}`)
      await admin
        .from('outreach_enrollments')
        .update({ next_run_at: new Date(Date.now() + RETRY_MS).toISOString() })
        .eq('id', e.id)
    }
  }

  return result
}
