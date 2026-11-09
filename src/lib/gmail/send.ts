/**
 * One-to-one email from a staff member's own address.
 *
 * With Gmail configured, the message is sent through the Gmail API as that
 * staff member, so it sits in their Sent folder and replies thread normally.
 * Without it, it goes through the Workspace relay (`sendAndLogEmail`) from
 * their address; that copy doesn't appear in their Sent folder.
 *
 * Every message carries a short footer (company, postal address, how to opt
 * out) because CAN-SPAM covers B2B outreach too. Suppressed addresses are
 * refused.
 */

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuppressed } from '@/lib/messaging/suppressions'
import { sendAndLogEmail, EmailLogError } from '@/lib/messaging/email-log'
import { complianceFooterLines } from '@/lib/messaging/marketing-email'
import { getTransportForStream } from '@/lib/email/config'
import { escapeHtml } from '@/lib/email/blocks'
import { GmailApiError, getMessageMetadata, getHeader, isGmailConfigured, sendRawMessage } from '@/lib/gmail/client'
import { normalizeEmail, normalizeMessageId } from '@/lib/gmail/parse'

export const OPT_OUT_LINE = "Reply 'unsubscribe' and we won't email you again."

export class SuppressedRecipientError extends Error {
  constructor(email: string) {
    super(`${email} is on the suppression list and can't be emailed.`)
  }
}

export interface StaffSender {
  id: string
  email: string
  full_name?: string | null
}

export interface SendAsStaffParams {
  staff: StaffSender
  to: string
  subject: string
  /** Plain text; the compliance footer is appended. */
  body: string
  contactId?: string | null
  /** Gmail thread in the sender's own mailbox. */
  threadId?: string | null
  /** RFC Message-ID being replied to. */
  inReplyTo?: string | null
  references?: string | null
  outreachEnrollmentId?: string | null
}

export interface SendAsStaffResult {
  transport: 'gmail' | 'smtp' | 'ses'
  /** False on the relay fallback: no copy in the sender's Sent folder. */
  inSentFolder: boolean
  gmailMessageId: string | null
  gmailThreadId: string | null
  rfcMessageId: string | null
  /** False when the email went out but the log write failed. */
  logged: boolean
}

export function outreachFooter(): string {
  const { postalLine } = complianceFooterLines()
  return `--\n${postalLine}\n${OPT_OUT_LINE}`
}

export function withFooter(body: string): string {
  return `${body.replace(/\s+$/, '')}\n\n${outreachFooter()}`
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/** RFC 2047 encoded-words for non-ASCII header text, split to stay short. */
function encodeHeader(value: string): string {
  const v = cleanHeader(value)
  if (/^[\x20-\x7E]*$/.test(v)) return v
  const chars = Array.from(v)
  const words: string[] = []
  for (let i = 0; i < chars.length; i += 30) {
    words.push(`=?UTF-8?B?${Buffer.from(chars.slice(i, i + 30).join(''), 'utf8').toString('base64')}?=`)
  }
  return words.join('\r\n ')
}

function formatFrom(name: string | null | undefined, email: string): string {
  const n = cleanHeader(name || '').replace(/["\\]/g, '')
  if (!n) return email
  return /^[\x20-\x7E]*$/.test(n) ? `"${n}" <${email}>` : `${encodeHeader(n)} <${email}>`
}

function buildRfc822(params: {
  from: string
  to: string
  subject: string
  text: string
  messageId: string
  inReplyTo: string | null
  references: string | null
}): string {
  const body = Buffer.from(params.text.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64')
  const headers = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodeHeader(params.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${params.messageId}`,
    ...(params.inReplyTo ? [`In-Reply-To: ${params.inReplyTo}`] : []),
    ...(params.references ? [`References: ${params.references}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ]
  return `${headers.join('\r\n')}\r\n\r\n${body.replace(/.{1,76}/g, '$&\r\n')}`
}

function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;">${paragraphs}</div>`
}

async function resolveContactId(email: string, contactId?: string | null): Promise<string | null> {
  if (contactId) return contactId
  const admin = createAdminClient()
  const { data } = await admin.from('email_contacts').select('id').eq('email', email).maybeSingle()
  return data?.id || null
}

export async function sendAsStaff(params: SendAsStaffParams): Promise<SendAsStaffResult> {
  const to = normalizeEmail(params.to)
  if (!to) throw new Error('Invalid recipient address')
  const senderEmail = normalizeEmail(params.staff.email)
  if (!senderEmail) throw new Error('Your staff account has no valid email address')
  const subject = cleanHeader(params.subject).slice(0, 250)
  if (!subject) throw new Error('Subject is required')
  if (!params.body.trim()) throw new Error('Message is required')

  if (await isSuppressed(to)) throw new SuppressedRecipientError(to)

  const text = withFooter(params.body.replace(/\r\n?/g, '\n'))
  const inReplyTo = normalizeMessageId(params.inReplyTo)
  const references =
    (params.references || '')
      .split(/\s+/)
      .map(normalizeMessageId)
      .filter(Boolean)
      .join(' ') || inReplyTo
  const contactId = await resolveContactId(to, params.contactId)
  const admin = createAdminClient()

  if (!isGmailConfigured()) {
    // Workspace relay fallback: from their address, not in their Sent folder.
    const transport = getTransportForStream('transactional')
    let messageId: string | null = null
    let logged = true
    try {
      messageId = await sendAndLogEmail({
        to,
        subject,
        text,
        html: textToHtml(text),
        from: senderEmail,
        replyTo: senderEmail,
        stream: 'transactional',
        sentBy: params.staff.id,
        contactId: contactId || undefined,
        headers: {
          ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}),
          ...(references ? { References: references } : {}),
        },
      })
    } catch (err) {
      // sendAndLogEmail throws after a successful send when only logging failed.
      if (!(err instanceof EmailLogError)) throw err
      console.error('[gmail/send] relay send not logged:', err.message)
      messageId = err.messageId
      logged = false
    }

    const rfcMessageId = transport === 'smtp' && messageId ? normalizeMessageId(messageId) : null
    if (messageId && logged) {
      const { error } = await admin
        .from('email_messages')
        .update({
          stream: 'outreach',
          outreach_enrollment_id: params.outreachEnrollmentId || null,
          rfc_message_id: rfcMessageId,
          in_reply_to: inReplyTo,
        })
        .eq('ses_message_id', messageId)
        .eq('sent_by', params.staff.id)
      if (error) console.error('[gmail/send] could not tag relay message as outreach:', error.message)
    }
    return { transport, inSentFolder: false, gmailMessageId: null, gmailThreadId: null, rfcMessageId, logged }
  }

  const domain = senderEmail.split('@')[1]
  const ourMessageId = `<${crypto.randomUUID()}@${domain}>`
  const raw = buildRfc822({
    from: formatFrom(params.staff.full_name, senderEmail),
    to,
    subject,
    text,
    messageId: ourMessageId,
    inReplyTo,
    references,
  })
  let sent: { id: string; threadId: string }
  try {
    sent = await sendRawMessage(senderEmail, raw, params.threadId || null)
  } catch (err) {
    // The thread may have been deleted; send it as a new conversation.
    if (!(params.threadId && err instanceof GmailApiError && err.status === 404)) throw err
    sent = await sendRawMessage(senderEmail, raw, null)
  }

  // Gmail normally keeps our Message-ID, but read it back to be sure.
  let rfcMessageId = ourMessageId
  try {
    const meta = await getMessageMetadata(senderEmail, sent.id, ['Message-ID'])
    rfcMessageId = normalizeMessageId(getHeader(meta, 'Message-ID')) || ourMessageId
  } catch (err) {
    console.warn('[gmail/send] could not read back Message-ID:', err instanceof Error ? err.message : err)
  }

  const row = {
    email_contact_id: contactId,
    from_email: senderEmail,
    to_email: to,
    subject,
    body_text: text,
    body_html: null,
    direction: 'outbound' as const,
    status: 'sent',
    stream: 'outreach',
    transport: 'gmail',
    thread_id: sent.threadId,
    gmail_message_id: sent.id,
    gmail_thread_id: sent.threadId,
    mailbox: senderEmail,
    rfc_message_id: rfcMessageId,
    in_reply_to: inReplyTo,
    outreach_enrollment_id: params.outreachEnrollmentId || null,
    sent_by: params.staff.id,
    sent_at: new Date().toISOString(),
  }

  let logged = false
  for (let attempt = 0; attempt < 3 && !logged; attempt++) {
    const { error } = await admin.from('email_messages').insert(row)
    // 23505: the Gmail sync already logged this message.
    if (!error || error.code === '23505') logged = true
    else {
      console.error(`[gmail/send] log attempt ${attempt + 1} failed:`, error.message)
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }

  return {
    transport: 'gmail',
    inSentFolder: true,
    gmailMessageId: sent.id,
    gmailThreadId: sent.threadId,
    rfcMessageId,
    logged,
  }
}
