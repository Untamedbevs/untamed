/**
 * Email Message Logging
 *
 * Wraps `sendEmail()` / `sendRawEmail()` with a write to the `email_messages`
 * table so every outbound email is recorded (transactional + bulk).
 *
 * Throws if the SMTP send fails. Throws if DB insert fails after retries so
 * the caller always knows about both failure modes.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendEmail,
  sendRawEmail,
  resolveAlias,
  type SendEmailParams,
  type EmailAlias,
  type EmailAttachment,
} from '@/lib/email/smtp'

const LOG_INSERT_MAX_RETRIES = 2
const LOG_INSERT_RETRY_DELAY_MS = 500

export interface LoggedEmailParams extends SendEmailParams {
  /**
   * Alias shorthand ('support', 'loyalty', 'orders') OR a full email address.
   * Full addresses pass through as-is. Overridden by `from` if also set.
   */
  fromAlias?: EmailAlias | string
  /** Thread grouping identifier (defaults to the SMTP message id) */
  threadId?: string
  /** Slug of the email template used (for analytics tracking) */
  templateSlug?: string
  /** UUID of the messaging_campaign this email belongs to */
  campaignId?: string
  /** UUID of the staff member who initiated this send */
  sentBy?: string
  /** Recipient audience refs (any of these may be set) */
  loyaltyMemberId?: string
  referralParticipantId?: string
  distributorLeadId?: string
  /** File attachments (triggers SendRawEmail instead of SendEmail) */
  attachments?: EmailAttachment[]
}

/**
 * Send an email via Google Workspace SMTP and log it to the `email_messages`
 * table. Returns the message id.
 */
export async function sendAndLogEmail(params: LoggedEmailParams): Promise<string> {
  const {
    fromAlias,
    threadId,
    templateSlug,
    campaignId,
    sentBy,
    loyaltyMemberId,
    referralParticipantId,
    distributorLeadId,
    attachments,
    ...emailParams
  } = params

  const resolvedFrom = resolveAlias(fromAlias)
  emailParams.from = emailParams.from || resolvedFrom
  emailParams.replyTo = emailParams.replyTo || resolvedFrom

  const messageId =
    attachments && attachments.length > 0
      ? await sendRawEmail({ ...emailParams, attachments })
      : await sendEmail(emailParams)

  const supabase = createAdminClient()
  const toAddresses = Array.isArray(emailParams.to) ? emailParams.to : [emailParams.to]

  const row = {
    campaign_id: campaignId || null,
    loyalty_member_id: loyaltyMemberId || null,
    referral_participant_id: referralParticipantId || null,
    distributor_lead_id: distributorLeadId || null,
    from_email: emailParams.from,
    to_email: toAddresses[0],
    subject: emailParams.subject,
    body_html: emailParams.html,
    body_text: emailParams.text || '',
    direction: 'outbound' as const,
    status: 'sent',
    ses_message_id: messageId,
    thread_id: threadId || messageId,
    template_slug: templateSlug || null,
    sent_by: sentBy || null,
    sent_at: new Date().toISOString(),
    has_attachments: !!(attachments && attachments.length > 0),
    attachment_urls:
      attachments && attachments.length > 0 ? attachments.map((a) => a.url) : null,
  }

  let lastError: string | undefined
  for (let attempt = 0; attempt <= LOG_INSERT_MAX_RETRIES; attempt++) {
    const { error: insertError } = await supabase
      .from('email_messages')
      .insert(row)
      .select('id')
      .single()

    if (!insertError) {
      lastError = undefined
      break
    }

    lastError = insertError.message
    console.error(
      `[Email Log] Insert attempt ${attempt + 1}/${LOG_INSERT_MAX_RETRIES + 1} failed:`,
      insertError.message,
      insertError.details,
    )

    if (attempt < LOG_INSERT_MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, LOG_INSERT_RETRY_DELAY_MS * (attempt + 1)))
    }
  }

  if (lastError) {
    throw new Error(
      `Email sent (message ID: ${messageId}) but failed to log to database after ${LOG_INSERT_MAX_RETRIES + 1} attempts: ${lastError}`
    )
  }

  return messageId
}
