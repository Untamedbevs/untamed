/**
 * SNS webhook for AWS SES bounce / complaint / delivery notifications.
 *
 * Subscribe this endpoint to the SNS topic that the SES configuration set
 * `untamed-blasts` publishes to. On Permanent bounce or Complaint we add the
 * recipient to `email_suppressions` so future blasts skip them.
 *
 * The full SNS payload is appended to `email_webhook_events` for audit.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addSuppression } from '@/lib/messaging/suppressions'

interface SnsEnvelope {
  Type: string
  MessageId?: string
  Token?: string
  TopicArn?: string
  Message?: string
  SubscribeURL?: string
}

interface SesNotification {
  notificationType?: string
  eventType?: string
  mail?: {
    messageId?: string
    destination?: string[]
    source?: string
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
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    let envelope: SnsEnvelope
    try {
      envelope = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Subscription handshake -- SNS sends this once when subscribing.
    if (envelope.Type === 'SubscriptionConfirmation' && envelope.SubscribeURL) {
      try {
        const res = await fetch(envelope.SubscribeURL)
        console.log(`[SES webhook] Confirmed SNS subscription (${res.status})`)
      } catch (err) {
        console.error('[SES webhook] Failed to confirm subscription:', err)
      }
      await admin.from('email_webhook_events').insert({
        event_type: 'SubscriptionConfirmation',
        payload: envelope,
        processed: true,
      })
      return NextResponse.json({ ok: true })
    }

    if (envelope.Type !== 'Notification' || !envelope.Message) {
      await admin.from('email_webhook_events').insert({
        event_type: envelope.Type || 'unknown',
        payload: envelope,
        processed: false,
        error: 'Unsupported envelope type',
      })
      return NextResponse.json({ ok: true })
    }

    let notification: SesNotification
    try {
      notification = JSON.parse(envelope.Message)
    } catch {
      await admin.from('email_webhook_events').insert({
        event_type: 'Notification',
        payload: envelope,
        processed: false,
        error: 'Message JSON parse failed',
      })
      return NextResponse.json({ ok: true })
    }

    const eventType =
      notification.eventType || notification.notificationType || 'unknown'
    const sesMessageId = notification.mail?.messageId || null
    const primaryRecipient = notification.mail?.destination?.[0] || null

    const { data: eventRow } = await admin
      .from('email_webhook_events')
      .insert({
        event_type: eventType,
        ses_message_id: sesMessageId,
        recipient_email: primaryRecipient,
        payload: notification,
        processed: false,
      })
      .select('id')
      .single()

    let processed = true
    let processError: string | null = null

    try {
      if (eventType === 'Bounce' && notification.bounce) {
        const { bounceType, bouncedRecipients } = notification.bounce
        if (bounceType === 'Permanent') {
          for (const r of bouncedRecipients || []) {
            await addSuppression({
              email: r.emailAddress,
              reason: 'hard_bounce',
              sourceMessageId: sesMessageId || undefined,
              notes: r.diagnosticCode,
            })
            await updateEmailMessageStatus(admin, sesMessageId, r.emailAddress, 'bounced', 'bounced_at')
          }
        }
      } else if (eventType === 'Complaint' && notification.complaint) {
        for (const r of notification.complaint.complainedRecipients || []) {
          await addSuppression({
            email: r.emailAddress,
            reason: 'complaint',
            sourceMessageId: sesMessageId || undefined,
            notes: notification.complaint.complaintFeedbackType,
          })
          await updateEmailMessageStatus(admin, sesMessageId, r.emailAddress, 'complaint', 'complaint_at')
        }
      } else if (eventType === 'Delivery' && notification.delivery) {
        for (const recipient of notification.delivery.recipients || []) {
          await updateEmailMessageStatus(admin, sesMessageId, recipient, 'delivered', 'delivered_at')
        }
      }
    } catch (err) {
      processed = false
      processError = err instanceof Error ? err.message : String(err)
      console.error('[SES webhook] Processing error:', err)
    }

    if (eventRow?.id) {
      await admin
        .from('email_webhook_events')
        .update({ processed, error: processError })
        .eq('id', eventRow.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SES webhook] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function updateEmailMessageStatus(
  admin: ReturnType<typeof createAdminClient>,
  sesMessageId: string | null,
  recipient: string,
  status: string,
  timestampColumn: string
) {
  if (!sesMessageId) return
  await admin
    .from('email_messages')
    .update({ status, [timestampColumn]: new Date().toISOString() })
    .eq('ses_message_id', sesMessageId)
    .eq('to_email', recipient.toLowerCase())
}
