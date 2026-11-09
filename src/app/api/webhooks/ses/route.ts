/**
 * SNS webhook for Amazon SES events.
 *
 * Subscribe this endpoint (HTTPS) to the SNS topic that the SES configuration
 * sets publish to (see scripts/aws/ses/setup-ses.mjs). Every request must
 * carry a valid SNS signature from a topic listed in SES_SNS_TOPIC_ARNS;
 * anything else is rejected before it touches the database.
 *
 * - Permanent bounce -> hard_bounce suppression + consent event
 * - Complaint        -> complaint suppression, every list unsubscribed
 * - Delivery / Open / Click / Reject / transient Bounce -> message log status
 *
 * The full notification is appended to `email_webhook_events` for audit, and
 * SNS retries are deduplicated on the SNS MessageId.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyConsent, isUuid } from '@/lib/messaging/consent'
import { getAllowedSnsTopicArns } from '@/lib/email/config'
import { isSnsEnvelope, isSnsUrl, verifySnsSignature } from '@/lib/email/sns-verify'
import { getEmailSettings } from '@/lib/email/settings'
import { raiseAlert } from '@/lib/email/alerts'

interface SesEvent {
  notificationType?: string
  eventType?: string
  mail?: {
    messageId?: string
    destination?: string[]
    source?: string
    timestamp?: string
    tags?: Record<string, string[]>
  }
  bounce?: {
    bounceType?: string
    bounceSubType?: string
    bouncedRecipients?: Array<{ emailAddress: string; diagnosticCode?: string }>
    timestamp?: string
  }
  complaint?: {
    complainedRecipients?: Array<{ emailAddress: string }>
    complaintFeedbackType?: string
    timestamp?: string
  }
  delivery?: {
    recipients?: string[]
    timestamp?: string
  }
  open?: { timestamp?: string }
  click?: { timestamp?: string; link?: string }
  reject?: { reason?: string }
}

type Admin = ReturnType<typeof createAdminClient>

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = JSON.parse(await request.text())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isSnsEnvelope(body)) {
    return NextResponse.json({ error: 'Not an SNS message' }, { status: 400 })
  }
  const envelope = body

  const allowedTopics = getAllowedSnsTopicArns()
  if (!allowedTopics.includes(envelope.TopicArn)) {
    console.warn(`[SES webhook] Rejected message from unlisted topic ${envelope.TopicArn}`)
    return NextResponse.json({ error: 'Unknown topic' }, { status: 403 })
  }

  if (!(await verifySnsSignature(envelope))) {
    console.warn('[SES webhook] Rejected message with an invalid SNS signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const admin = createAdminClient()

  try {
    if (envelope.Type === 'SubscriptionConfirmation') {
      if (!isSnsUrl(envelope.SubscribeURL)) {
        return NextResponse.json({ error: 'Invalid SubscribeURL' }, { status: 400 })
      }
      const res = await fetch(envelope.SubscribeURL!, { redirect: 'error' })
      console.log(`[SES webhook] Confirmed SNS subscription to ${envelope.TopicArn} (${res.status})`)
      await logEvent(admin, envelope.MessageId, 'SubscriptionConfirmation', null, null, envelope, res.ok, res.ok ? null : `HTTP ${res.status}`)
      return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 })
    }

    if (envelope.Type !== 'Notification' || !envelope.Message) {
      await logEvent(admin, envelope.MessageId, envelope.Type, null, null, envelope, true, null)
      return NextResponse.json({ ok: true })
    }

    let event: SesEvent
    try {
      event = JSON.parse(envelope.Message)
    } catch {
      await logEvent(admin, envelope.MessageId, 'Notification', null, null, envelope, false, 'Message JSON parse failed')
      return NextResponse.json({ ok: true })
    }

    const eventType = event.eventType || event.notificationType || 'unknown'
    const sesMessageId = event.mail?.messageId || null
    const primaryRecipient = event.mail?.destination?.[0]?.toLowerCase() || null

    const { data: eventRow, error: insertError } = await admin
      .from('email_webhook_events')
      .insert({
        sns_message_id: envelope.MessageId,
        event_type: eventType,
        ses_message_id: sesMessageId,
        recipient_email: primaryRecipient,
        payload: event,
        processed: false,
      })
      .select('id')
      .single()

    if (insertError) {
      // 23505: SNS redelivered a notification we already have.
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true })
      }
      throw new Error(`Event log insert failed: ${insertError.message}`)
    }

    let processed = true
    let processError: string | null = null
    try {
      await handleSesEvent(admin, eventType, event, sesMessageId)
    } catch (err) {
      processed = false
      processError = err instanceof Error ? err.message : String(err)
      console.error('[SES webhook] Processing error:', err)
    }

    await admin
      .from('email_webhook_events')
      .update({ processed, error: processError })
      .eq('id', eventRow.id)

    // A processing failure returns 500 so SNS retries; the dedupe row is
    // removed first so the retry is processed instead of skipped.
    if (!processed) {
      await admin.from('email_webhook_events').delete().eq('id', eventRow.id)
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SES webhook] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleSesEvent(admin: Admin, eventType: string, event: SesEvent, sesMessageId: string | null) {
  const campaignTag = event.mail?.tags?.campaign?.[0]
  const campaignId = isUuid(campaignTag) ? campaignTag : null
  const recipients = (event.mail?.destination || []).map((r) => r.toLowerCase())

  switch (eventType) {
    case 'Bounce': {
      const bounce = event.bounce
      if (!bounce) return
      const permanent = bounce.bounceType === 'Permanent'
      const bounceType = [bounce.bounceType, bounce.bounceSubType].filter(Boolean).join('/')
      for (const r of bounce.bouncedRecipients || []) {
        if (permanent) {
          await applyConsent({
            email: r.emailAddress,
            action: 'hard_bounce',
            source: 'ses_feedback',
            sourceDetail: bounceType,
            evidenceNote: r.diagnosticCode?.slice(0, 500) || null,
            campaignId,
            sourceMessageId: sesMessageId,
          })
        }
        await deliveryEvent(admin, sesMessageId, r.emailAddress, permanent ? 'bounce_permanent' : 'bounce_transient', bounce.timestamp, bounceType)
      }
      if (permanent && campaignId) await checkCampaignHealth(admin, campaignId)
      return
    }
    case 'Complaint': {
      const complaint = event.complaint
      if (!complaint) return
      // 'not-spam' feedback reports are retractions, not complaints.
      if (complaint.complaintFeedbackType === 'not-spam') return
      for (const r of complaint.complainedRecipients || []) {
        await applyConsent({
          email: r.emailAddress,
          action: 'complaint',
          source: 'ses_feedback',
          sourceDetail: complaint.complaintFeedbackType || 'complaint',
          campaignId,
          sourceMessageId: sesMessageId,
        })
        await deliveryEvent(admin, sesMessageId, r.emailAddress, 'complaint', complaint.timestamp)
      }
      if (campaignId) await checkCampaignHealth(admin, campaignId)
      return
    }
    case 'Delivery':
      for (const r of event.delivery?.recipients || []) {
        await deliveryEvent(admin, sesMessageId, r, 'delivery', event.delivery?.timestamp)
      }
      return
    case 'Open':
      for (const r of recipients) {
        await deliveryEvent(admin, sesMessageId, r, 'open', event.open?.timestamp)
      }
      return
    case 'Click':
      // Clicking "unsubscribe" or "confirm" isn't engagement with the content.
      if (event.click?.link && /\/(unsubscribe|email\/confirm)\b/.test(event.click.link)) return
      for (const r of recipients) {
        await deliveryEvent(admin, sesMessageId, r, 'click', event.click?.timestamp)
      }
      return
    case 'Reject':
      for (const r of recipients) {
        await deliveryEvent(admin, sesMessageId, r, 'reject', event.mail?.timestamp)
      }
      return
    default:
      // Send, DeliveryDelay, RenderingFailure, Subscription: audit log only.
      return
  }
}

/** Minimum sends before a campaign's rates are judged. */
const HEALTH_MIN_SAMPLE = 100

/**
 * Pause a sending campaign whose complaint or hard-bounce rate passes the
 * thresholds in email settings, and alert staff. Mailbox providers start
 * filtering a sender at around 0.3% complaints.
 */
async function checkCampaignHealth(admin: Admin, campaignId: string) {
  const count = async (statuses: string[]) => {
    const { count: n } = await admin
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', statuses)
    return n || 0
  }
  const [delivered, complaints, bounced, total] = await Promise.all([
    count(['delivered', 'opened', 'clicked', 'complaint']),
    count(['complaint']),
    count(['bounced']),
    count(['sent', 'delivered', 'opened', 'clicked', 'complaint', 'bounced', 'rejected']),
  ])
  if (total < HEALTH_MIN_SAMPLE) return

  const settings = await getEmailSettings()
  const complaintRate = delivered > 0 ? complaints / delivered : 0
  const bounceRate = bounced / total
  const reason =
    complaintRate > settings.complaint_pause_rate
      ? `Complaint rate ${(complaintRate * 100).toFixed(2)}% is above ${(settings.complaint_pause_rate * 100).toFixed(2)}%`
      : bounceRate > settings.bounce_pause_rate
        ? `Hard-bounce rate ${(bounceRate * 100).toFixed(1)}% is above ${(settings.bounce_pause_rate * 100).toFixed(1)}%`
        : null
  if (!reason) return

  const { data: paused } = await admin
    .from('messaging_campaigns')
    .update({ status: 'paused', paused_at: new Date().toISOString(), paused_reason: `Auto-paused: ${reason}`, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .in('status', ['sending', 'scheduled'])
    .select('id, name')
  if (paused && paused.length > 0) {
    await raiseAlert({
      kind: complaintRate > settings.complaint_pause_rate ? 'complaint_rate' : 'bounce_rate',
      severity: 'critical',
      message: `Campaign "${paused[0].name}" was auto-paused. ${reason}.`,
      details: { campaignId, delivered, complaints, bounced, total },
      dedupeKey: `campaign_health:${campaignId}`,
    })
  }
}

async function deliveryEvent(
  admin: Admin,
  sesMessageId: string | null,
  recipient: string,
  event: 'delivery' | 'open' | 'click' | 'bounce_permanent' | 'bounce_transient' | 'complaint' | 'reject',
  at?: string,
  bounceType?: string
) {
  if (!sesMessageId) return
  const { error } = await admin.rpc('email_apply_delivery_event', {
    p_ses_message_id: sesMessageId,
    p_recipient: recipient,
    p_event: event,
    p_at: at || new Date().toISOString(),
    p_bounce_type: bounceType || null,
  })
  if (error) throw new Error(`Delivery event update failed: ${error.message}`)
}

async function logEvent(
  admin: Admin,
  snsMessageId: string,
  eventType: string,
  sesMessageId: string | null,
  recipient: string | null,
  payload: unknown,
  processed: boolean,
  error: string | null
) {
  const { error: insertError } = await admin.from('email_webhook_events').insert({
    sns_message_id: snsMessageId,
    event_type: eventType,
    ses_message_id: sesMessageId,
    recipient_email: recipient,
    payload,
    processed,
    error,
  })
  if (insertError && insertError.code !== '23505') {
    console.error('[SES webhook] Event log insert failed:', insertError.message)
  }
}
