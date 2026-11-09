/**
 * Gmail sync: logs staff conversations with known contacts, detects replies
 * to outreach, and processes the unsubscribe@ mailbox.
 *
 * Mailboxes (GMAIL_SYNC_MAILBOXES) are read from `gmail_sync_state.last_message_at`
 * minus an hour (GMAIL_SYNC_LOOKBACK_DAYS on the first run), oldest first,
 * with a cap per run. Headers are read first; the body is only fetched and
 * stored when the other party is an `email_contacts` row, so unrelated mail
 * is never kept.
 *
 * Reply handling: an inbound message from a contact ends their active
 * outreach enrollments ("replied"). If it asks us to stop emailing, the
 * address is unsubscribed from everything (`applyConsent`, source 'mailto')
 * and the enrollments are stopped. A bounce notice in an outreach thread
 * marks that enrollment "bounced".
 *
 * Unsubscribe mailbox (GMAIL_UNSUBSCRIBE_MAILBOX): every new message
 * unsubscribes its sender. If the subject names a different address (our
 * mailto links put `unsubscribe <email>` there), that other address is left
 * for staff to review. Every message is recorded in `email_mailbox_processed`.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { applyConsent } from '@/lib/messaging/consent'
import { raiseAlert } from '@/lib/email/alerts'
import {
  getHeader,
  getMessage,
  getMessageMetadata,
  listMessages,
  type GmailMessage,
  type GmailMessageRef,
} from '@/lib/gmail/client'
import {
  extractBody,
  extractEmails,
  firstMessageId,
  isAutomatedSender,
  isBounceSender,
  isStopRequest,
  normalizeEmail,
  normalizeMessageId,
  parseAddressList,
  parseMailbox,
} from '@/lib/gmail/parse'

type Admin = ReturnType<typeof createAdminClient>

const OVERLAP_MS = 60 * 60 * 1000
/** Message ids listed per mailbox per run. */
const LIST_CAP = 1000
/** New messages (after the previous cursor) handled per mailbox per run. */
const NEW_CAP = 150
/** Header fetches per mailbox per run, including the re-checked overlap hour. */
const FETCH_CAP = 400
const CHUNK = 10
const CONCURRENCY = 5
const SKIP_LABELS = ['DRAFT', 'SPAM', 'TRASH', 'CHAT']
const META_HEADERS = ['From', 'To', 'Cc', 'Subject', 'Message-ID', 'In-Reply-To', 'References', 'Auto-Submitted']
const OWN_DOMAINS = ['untamedbeverages.com', 'untamedbevs.com']
const AUTO_REPLY_SUBJECT = /^\s*(automatic reply|auto(?:matic)?[- ]?reply|out of (?:the )?office|undeliverable|delivery status notification)\b/i

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function getUnsubscribeMailbox(): string | null {
  const raw = (process.env.GMAIL_UNSUBSCRIBE_MAILBOX || '').trim().toLowerCase()
  if (raw === 'off' || raw === 'none') return null
  return normalizeEmail(raw) || 'unsubscribe@untamedbeverages.com'
}

/** Staff mailboxes to sync (the unsubscribe mailbox is handled separately). */
export function getSyncMailboxes(): string[] {
  const unsub = getUnsubscribeMailbox()
  return [
    ...new Set(
      (process.env.GMAIL_SYNC_MAILBOXES || '')
        .split(',')
        .map((s) => normalizeEmail(s))
        .filter((s): s is string => !!s && s !== unsub)
    ),
  ]
}

function lookbackMs(): number {
  const days = parseInt(process.env.GMAIL_SYNC_LOOKBACK_DAYS || '', 10)
  return (Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 14) * 86_400_000
}

function internalDomains(): Set<string> {
  const domains = new Set(OWN_DOMAINS)
  for (const m of [...getSyncMailboxes(), getUnsubscribeMailbox()]) {
    if (m) domains.add(m.split('@')[1])
  }
  return domains
}

/** Whether an address is on one of our Workspace domains (so Gmail can act as it). */
export function isWorkspaceAddress(email: string): boolean {
  const domain = normalizeEmail(email)?.split('@')[1]
  return !!domain && internalDomains().has(domain)
}

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

interface SyncState {
  last_message_at: string | null
  messages_synced: number
}

async function loadState(admin: Admin, mailbox: string): Promise<SyncState | null> {
  const { data, error } = await admin
    .from('gmail_sync_state')
    .select('last_message_at, messages_synced')
    .eq('mailbox', mailbox)
    .maybeSingle()
  if (error) throw new Error(`Could not read sync state: ${error.message}`)
  return data
}

async function saveState(
  admin: Admin,
  mailbox: string,
  prev: SyncState | null,
  update: { cursor: number | null; synced: number; error: string | null }
) {
  const prevMs = prev?.last_message_at ? new Date(prev.last_message_at).getTime() : null
  const next = update.cursor !== null ? Math.max(update.cursor, prevMs ?? 0) : prevMs
  const now = new Date().toISOString()
  const { error } = await admin.from('gmail_sync_state').upsert(
    {
      mailbox,
      last_synced_at: now,
      last_message_at: next !== null ? new Date(next).toISOString() : null,
      last_error: update.error ? update.error.slice(0, 1000) : null,
      messages_synced: (prev?.messages_synced || 0) + update.synced,
      updated_at: now,
    },
    { onConflict: 'mailbox' }
  )
  if (error) console.error(`[gmail/sync] could not save state for ${mailbox}:`, error.message)
}

/** Message ids after `afterMs`, oldest first. */
async function listWindow(
  mailbox: string,
  afterMs: number,
  extraQuery: string,
  deadline: number
): Promise<{ refs: GmailMessageRef[]; truncated: boolean }> {
  const q = `after:${Math.floor(afterMs / 1000)} ${extraQuery}`.trim()
  const refs: GmailMessageRef[] = []
  let pageToken: string | undefined
  let truncated = false
  do {
    const page = await listMessages(mailbox, { q, pageToken, maxResults: 500 })
    refs.push(...page.messages)
    pageToken = page.nextPageToken
    if (refs.length >= LIST_CAP || Date.now() > deadline) {
      truncated = !!pageToken
      break
    }
  } while (pageToken)
  // Gmail lists newest first.
  return { refs: refs.slice(0, LIST_CAP).reverse(), truncated }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
}

async function existingIds(admin: Admin, table: 'email_messages' | 'email_mailbox_processed', mailbox: string, ids: string[]) {
  const found = new Set<string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from(table)
      .select('gmail_message_id')
      .eq('mailbox', mailbox)
      .in('gmail_message_id', ids.slice(i, i + 200))
    if (error) throw new Error(`Could not check ${table}: ${error.message}`)
    for (const row of data || []) if (row.gmail_message_id) found.add(row.gmail_message_id)
  }
  return found
}

function internalDateMs(message: GmailMessage): number {
  const n = Number(message.internalDate)
  return Number.isFinite(n) && n > 0 ? n : Date.now()
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ---------------------------------------------------------------------------
// Reply handling
// ---------------------------------------------------------------------------

/** Stop outreach to an address; returns how many active enrollments changed. */
async function stopEnrollments(
  admin: Admin,
  email: string,
  status: 'replied' | 'stopped',
  reason: string
): Promise<number> {
  const { count, error } = await admin
    .from('outreach_enrollments')
    .update({ status, next_run_at: null, stopped_reason: reason }, { count: 'exact' })
    .eq('email', email)
    .eq('status', 'active')
  if (error) throw new Error(`Could not update outreach enrollments: ${error.message}`)
  return count || 0
}

async function handleInbound(
  admin: Admin,
  p: { mailbox: string; from: string; subject: string; newText: string; rfcMessageId: string | null; gmailMessageId: string }
): Promise<{ replied: number; stopRequest: boolean }> {
  if (isStopRequest(p.subject, p.newText)) {
    await applyConsent({
      email: p.from,
      action: 'unsubscribe_all',
      source: 'mailto',
      sourceDetail: `Asked to stop in an email to ${p.mailbox}`,
      sourceMessageId: p.rfcMessageId || `gmail:${p.gmailMessageId}`,
    })
    await stopEnrollments(admin, p.from, 'stopped', 'Asked not to be emailed')
    return { replied: 0, stopRequest: true }
  }
  const replied = await stopEnrollments(admin, p.from, 'replied', `Replied to ${p.mailbox}`)
  return { replied, stopRequest: false }
}

/** Delay notices aren't failures; only permanent ones suppress the address. */
const PERMANENT_BOUNCE_SUBJECT = /(failure|failed|undeliverable|not delivered|could not be delivered|returned mail|rejected)/i
const DELAY_SUBJECT = /\bdela(y|yed)\b/i

/**
 * A bounce notice threads with the message that bounced. A permanent failure
 * also suppresses the address so no other email is sent to it.
 */
async function markBounced(admin: Admin, mailbox: string, threadId: string, subject: string): Promise<number> {
  const { data, error } = await admin
    .from('outreach_enrollments')
    .update({ status: 'bounced', next_run_at: null, stopped_reason: 'Delivery failed (bounce notice)' })
    .eq('sender_email', mailbox)
    .eq('gmail_thread_id', threadId)
    .eq('status', 'active')
    .select('email')
  if (error) throw new Error(`Could not mark bounce: ${error.message}`)

  if (PERMANENT_BOUNCE_SUBJECT.test(subject) && !DELAY_SUBJECT.test(subject)) {
    for (const row of data || []) {
      await applyConsent({
        email: row.email,
        action: 'hard_bounce',
        source: 'mailto',
        sourceDetail: `Outreach bounce notice in ${mailbox}`,
        evidenceNote: subject.slice(0, 300),
      })
    }
  }
  return (data || []).length
}

// ---------------------------------------------------------------------------
// Staff mailboxes
// ---------------------------------------------------------------------------

export interface MailboxSyncResult {
  mailbox: string
  listed: number
  checked: number
  stored: number
  replies: number
  stopRequests: number
  bounces: number
  failed: number
  /** More messages are waiting; the next run continues. */
  more: boolean
  error?: string
}

type Outcome = 'skipped' | 'stored' | 'duplicate'

export async function syncMailbox(mailbox: string, deadline: number): Promise<MailboxSyncResult> {
  const admin = createAdminClient()
  const result: MailboxSyncResult = {
    mailbox, listed: 0, checked: 0, stored: 0, replies: 0, stopRequests: 0, bounces: 0, failed: 0, more: false,
  }
  let state: SyncState | null = null
  let cursor: number | null = null

  try {
    state = await loadState(admin, mailbox)
    const prevCursor = state?.last_message_at ? new Date(state.last_message_at).getTime() : null
    const listStartedAt = Date.now()
    const afterMs = prevCursor !== null ? prevCursor - OVERLAP_MS : Date.now() - lookbackMs()

    const { refs, truncated } = await listWindow(mailbox, afterMs, '-in:chats', deadline)
    result.listed = refs.length
    const already = await existingIds(admin, 'email_messages', mailbox, refs.map((r) => r.id))
    const todo = refs.filter((r) => !already.has(r.id))
    const internal = internalDomains()

    let fresh = 0
    let blocked = false
    let done = 0
    for (let i = 0; i < todo.length; i += CHUNK) {
      if (Date.now() > deadline || fresh >= NEW_CAP || result.checked >= FETCH_CAP) break
      const chunk = todo.slice(i, i + CHUNK)
      const metas = await mapLimit(chunk, CONCURRENCY, (r) =>
        getMessageMetadata(mailbox, r.id, META_HEADERS).catch((err: unknown) => new Error(errorMessage(err)))
      )
      result.checked += chunk.length

      // One contact lookup per chunk.
      const candidates = new Set<string>()
      for (const meta of metas) {
        if (meta instanceof Error) continue
        for (const a of [parseMailbox(getHeader(meta, 'From')), ...parseAddressList(getHeader(meta, 'To')), ...parseAddressList(getHeader(meta, 'Cc'))]) {
          if (a && a !== mailbox && !internal.has(a.split('@')[1])) candidates.add(a)
        }
      }
      const contacts = new Map<string, string>()
      if (candidates.size > 0) {
        const { data, error } = await admin.from('email_contacts').select('id, email').in('email', [...candidates])
        if (error) throw new Error(`Contact lookup failed: ${error.message}`)
        for (const c of data || []) contacts.set(c.email, c.id)
      }

      for (let j = 0; j < metas.length; j++) {
        const meta = metas[j]
        done++
        if (meta instanceof Error) {
          result.failed++
          blocked = true
          console.error(`[gmail/sync] ${mailbox} ${chunk[j].id}:`, meta.message)
          continue
        }
        const msgTime = internalDateMs(meta)
        if (prevCursor === null || msgTime > prevCursor) fresh++
        try {
          const outcome = await handleMailboxMessage(admin, mailbox, meta, contacts, internal, result)
          if (outcome === 'stored') result.stored++
          if (!blocked) cursor = Math.max(cursor ?? 0, msgTime)
        } catch (err) {
          result.failed++
          blocked = true
          console.error(`[gmail/sync] ${mailbox} ${meta.id}:`, errorMessage(err))
        }
      }
    }

    const finished = !truncated && done === todo.length && !blocked
    if (finished) cursor = Math.max(cursor ?? 0, listStartedAt)
    result.more = !finished
    await saveState(admin, mailbox, state, {
      cursor,
      synced: result.stored,
      error: result.failed > 0 ? `${result.failed} message(s) failed; will retry` : null,
    })
  } catch (err) {
    result.error = errorMessage(err)
    await saveState(admin, mailbox, state, { cursor, synced: result.stored, error: result.error })
  }
  return result
}

async function handleMailboxMessage(
  admin: Admin,
  mailbox: string,
  meta: GmailMessage,
  contacts: Map<string, string>,
  internal: Set<string>,
  result: MailboxSyncResult
): Promise<Outcome> {
  const labels = meta.labelIds || []
  if (labels.some((l) => SKIP_LABELS.includes(l))) return 'skipped'

  const from = parseMailbox(getHeader(meta, 'From'))
  const subject = (getHeader(meta, 'Subject') || '').trim()
  const outbound = from === mailbox || labels.includes('SENT')

  if (!outbound && isBounceSender(from)) {
    result.bounces += await markBounced(admin, mailbox, meta.threadId, subject)
    return 'skipped'
  }
  if (isAutomatedSender(outbound ? null : from, getHeader(meta, 'Auto-Submitted')) || AUTO_REPLY_SUBJECT.test(subject)) {
    return 'skipped'
  }

  const counterparts = outbound
    ? [...parseAddressList(getHeader(meta, 'To')), ...parseAddressList(getHeader(meta, 'Cc'))]
    : from
      ? [from]
      : []
  const contactEmail = counterparts.find((a) => a !== mailbox && !internal.has(a.split('@')[1]) && contacts.has(a))
  if (!contactEmail || !from) return 'skipped'

  const full = await getMessage(mailbox, meta.id)
  const body = extractBody(full.payload)
  const rfcMessageId = normalizeMessageId(getHeader(meta, 'Message-ID'))
  const inReplyTo = firstMessageId(getHeader(meta, 'In-Reply-To'))

  const { data: enrollment } = await admin
    .from('outreach_enrollments')
    .select('id')
    .eq('sender_email', mailbox)
    .eq('gmail_thread_id', meta.threadId)
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('email_messages').insert({
    email_contact_id: contacts.get(contactEmail) || null,
    from_email: from,
    to_email: outbound ? contactEmail : mailbox,
    subject: subject.slice(0, 500) || '(no subject)',
    body_text: body.text,
    body_html: null,
    direction: outbound ? 'outbound' : 'inbound',
    status: outbound ? 'sent' : 'received',
    stream: 'outreach',
    transport: 'gmail',
    thread_id: meta.threadId,
    gmail_message_id: meta.id,
    gmail_thread_id: meta.threadId,
    mailbox,
    rfc_message_id: rfcMessageId,
    in_reply_to: inReplyTo,
    outreach_enrollment_id: enrollment?.id || null,
    sent_at: new Date(internalDateMs(meta)).toISOString(),
  })
  if (error) {
    if (error.code === '23505') return 'duplicate'
    throw new Error(`Insert failed: ${error.message}`)
  }

  if (!outbound) {
    const r = await handleInbound(admin, {
      mailbox,
      from,
      subject,
      newText: body.newText,
      rfcMessageId,
      gmailMessageId: meta.id,
    })
    result.replies += r.replied
    if (r.stopRequest) result.stopRequests++
  }
  return 'stored'
}

// ---------------------------------------------------------------------------
// Unsubscribe mailbox
// ---------------------------------------------------------------------------

export interface UnsubscribeMailboxResult {
  mailbox: string
  listed: number
  processed: number
  unsubscribed: number
  needsReview: number
  ignored: number
  failed: number
  more: boolean
  error?: string
}

type UnsubOutcome = 'unsubscribed' | 'needs_review' | 'ignored_automated' | 'skipped' | 'invalid_sender'

export async function processUnsubscribeMailbox(mailbox: string, deadline: number): Promise<UnsubscribeMailboxResult> {
  const admin = createAdminClient()
  const result: UnsubscribeMailboxResult = {
    mailbox, listed: 0, processed: 0, unsubscribed: 0, needsReview: 0, ignored: 0, failed: 0, more: false,
  }
  let state: SyncState | null = null
  let cursor: number | null = null

  try {
    state = await loadState(admin, mailbox)
    const prevCursor = state?.last_message_at ? new Date(state.last_message_at).getTime() : null
    const listStartedAt = Date.now()
    const afterMs = prevCursor !== null ? prevCursor - OVERLAP_MS : Date.now() - lookbackMs()

    const { refs, truncated } = await listWindow(mailbox, afterMs, '-in:sent -in:chats', deadline)
    result.listed = refs.length
    const already = await existingIds(admin, 'email_mailbox_processed', mailbox, refs.map((r) => r.id))
    const todo = refs.filter((r) => !already.has(r.id))

    let blocked = false
    let done = 0
    for (let i = 0; i < todo.length; i += CHUNK) {
      if (Date.now() > deadline || result.processed >= NEW_CAP) break
      const chunk = todo.slice(i, i + CHUNK)
      const metas = await mapLimit(chunk, CONCURRENCY, (r) =>
        getMessageMetadata(mailbox, r.id, ['From', 'Subject', 'Message-ID', 'Auto-Submitted']).catch(
          (err: unknown) => new Error(errorMessage(err))
        )
      )
      for (let j = 0; j < metas.length; j++) {
        const meta = metas[j]
        done++
        try {
          if (meta instanceof Error) throw meta
          const outcome = await handleUnsubscribeMessage(admin, mailbox, meta)
          const { error } = await admin
            .from('email_mailbox_processed')
            .insert({ mailbox, gmail_message_id: meta.id, outcome })
          if (error && error.code !== '23505') throw new Error(`Could not record processed message: ${error.message}`)
          result.processed++
          if (outcome === 'unsubscribed') result.unsubscribed++
          else if (outcome === 'needs_review') result.needsReview++
          else result.ignored++
          if (!blocked) cursor = Math.max(cursor ?? 0, internalDateMs(meta))
        } catch (err) {
          // Not recorded and the cursor stays put, so the next run retries it.
          result.failed++
          blocked = true
          console.error(`[gmail/unsubscribe] ${mailbox} ${chunk[j].id}:`, errorMessage(err))
        }
      }
    }

    const finished = !truncated && done === todo.length && !blocked
    if (finished) cursor = Math.max(cursor ?? 0, listStartedAt)
    result.more = !finished
    await saveState(admin, mailbox, state, {
      cursor,
      synced: result.processed,
      error: result.failed > 0 ? `${result.failed} message(s) failed; will retry` : null,
    })
  } catch (err) {
    result.error = errorMessage(err)
    await saveState(admin, mailbox, state, { cursor, synced: result.processed, error: result.error })
  }
  return result
}

async function handleUnsubscribeMessage(admin: Admin, mailbox: string, meta: GmailMessage): Promise<UnsubOutcome> {
  const labels = meta.labelIds || []
  if (labels.some((l) => [...SKIP_LABELS, 'SENT'].includes(l))) return 'skipped'

  const from = parseMailbox(getHeader(meta, 'From'))
  const subject = (getHeader(meta, 'Subject') || '').trim()
  if (!from) return 'invalid_sender'
  if (from === mailbox) return 'skipped'
  if (isAutomatedSender(from, getHeader(meta, 'Auto-Submitted')) || AUTO_REPLY_SUBJECT.test(subject)) {
    return 'ignored_automated'
  }

  const rfcMessageId = normalizeMessageId(getHeader(meta, 'Message-ID'))
  await applyConsent({
    email: from,
    action: 'unsubscribe_all',
    source: 'mailto',
    sourceDetail: `Email to ${mailbox}`,
    sourceMessageId: rfcMessageId || `gmail:${meta.id}`,
  })
  await stopEnrollments(admin, from, 'stopped', `Unsubscribed by email to ${mailbox}`)

  // Someone may ask from one address to unsubscribe another. That needs a
  // person to check: anyone could otherwise unsubscribe anyone.
  const named = extractEmails(subject).filter((e) => e !== from)
  if (named.length > 0) {
    await raiseAlert({
      kind: 'other',
      severity: 'warning',
      message: `An email to ${mailbox} from ${from} asks to unsubscribe ${named.join(', ')}. ${from} was unsubscribed; check the request and unsubscribe the other address in Contacts if it's genuine.`,
      details: { mailbox, gmail_message_id: meta.id, from, subject: subject.slice(0, 200), named },
      dedupeKey: `unsubscribe_review:${mailbox}:${meta.id}`,
    })
    return 'needs_review'
  }
  return 'unsubscribed'
}

// ---------------------------------------------------------------------------
// Entry point for the cron
// ---------------------------------------------------------------------------

export interface GmailSyncRunResult {
  mailboxes: MailboxSyncResult[]
  unsubscribe: UnsubscribeMailboxResult | null
}

export async function runGmailSync(deadline: number): Promise<GmailSyncRunResult> {
  const unsubMailbox = getUnsubscribeMailbox()
  // Unsubscribe requests first: they have a legal deadline.
  const unsubscribe = unsubMailbox ? await processUnsubscribeMailbox(unsubMailbox, deadline) : null
  const mailboxes: MailboxSyncResult[] = []
  for (const mailbox of getSyncMailboxes()) {
    if (Date.now() > deadline) break
    mailboxes.push(await syncMailbox(mailbox, deadline))
  }
  return { mailboxes, unsubscribe }
}
