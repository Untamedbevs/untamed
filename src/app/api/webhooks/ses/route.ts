/**
 * SNS webhook for AWS SES bounce / complaint / delivery notifications.
 *
 * Subscribe this endpoint to the SNS topic that the SES configuration set
 * `untamed-blasts` publishes to. On Permanent bounce or Complaint we add the
 * recipient to `email_suppressions` so future blasts skip them.
 *
 * The full SNS payload is appended to `email_webhook_events` for audit.
 *
 * Every request must be a genuine SNS message for the configured topic:
 *   - TopicArn must equal SES_SNS_TOPIC_ARN (unset = every request is refused),
 *   - the signature (SignatureVersion 1 = RSA-SHA1, 2 = RSA-SHA256) must verify
 *     against a certificate fetched from https://sns.<region>.amazonaws.com/...
 * Anything else gets 403 before it is stored or acted on, including
 * SubscriptionConfirmation.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { X509Certificate, verify as verifySignature } from 'crypto'
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
  Subject?: string
  Timestamp?: string
  SignatureVersion?: string
  Signature?: string
  SigningCertURL?: string
}

/** Hosts SNS signs from and sends subscription links on. */
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/
const SNS_FETCH_TIMEOUT_MS = 5000
const CERT_CACHE_MAX = 16
const certCache = new Map<string, string>()

/** Returns the URL only if it is https on an sns.<region>.amazonaws.com host. */
function snsUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return null
  if (!SNS_HOST.test(url.hostname)) return null
  return url
}

/**
 * The string SNS signs, per the AWS docs: selected fields as `Key\nValue\n`, in
 * byte order. Notifications sign Subject only when present; confirmations
 * sign SubscribeURL and Token instead. Returns null when a field is missing.
 */
function stringToSign(m: Record<string, unknown>): string | null {
  let keys: string[]
  if (m.Type === 'Notification') {
    keys = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
  } else if (m.Type === 'SubscriptionConfirmation' || m.Type === 'UnsubscribeConfirmation') {
    keys = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  } else {
    return null
  }
  let out = ''
  for (const key of keys) {
    const value = m[key]
    if (key === 'Subject' && (value === undefined || value === null)) continue
    if (typeof value !== 'string') return null
    out += `${key}\n${value}\n`
  }
  return out
}

async function signingCert(url: URL): Promise<string | null> {
  const cached = certCache.get(url.href)
  if (cached) return cached
  const res = await fetch(url.href, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(SNS_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) return null
  const pem = await res.text()
  // Must parse as an X.509 certificate that is currently valid.
  const cert = new X509Certificate(pem)
  const now = Date.now()
  if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) return null
  if (certCache.size >= CERT_CACHE_MAX) certCache.clear()
  certCache.set(url.href, pem)
  return pem
}

/** Why the message is refused, or null when it is a genuine SNS message for our topic. */
async function rejectReason(m: Record<string, unknown>): Promise<string | null> {
  const topic = process.env.SES_SNS_TOPIC_ARN
  if (!topic) return 'SES_SNS_TOPIC_ARN is not set'
  if (m.TopicArn !== topic) return 'TopicArn mismatch'
  const algorithm = m.SignatureVersion === '1' ? 'sha1' : m.SignatureVersion === '2' ? 'sha256' : null
  if (!algorithm) return 'Unsupported SignatureVersion'
  if (typeof m.Signature !== 'string' || !m.Signature) return 'Missing Signature'
  const canonical = stringToSign(m)
  if (canonical === null) return 'Unsupported type or missing signed field'
  const certUrl = snsUrl(m.SigningCertURL)
  if (!certUrl) return 'SigningCertURL is not an SNS https URL'
  try {
    const pem = await signingCert(certUrl)
    if (!pem) return 'Signing certificate unavailable or expired'
    const ok = verifySignature(
      algorithm,
      Buffer.from(canonical, 'utf8'),
      pem,
      Buffer.from(m.Signature, 'base64')
    )
    return ok ? null : 'Signature does not verify'
  } catch (err) {
    console.error('[SES webhook] Signature check failed:', err)
    return 'Signature check failed'
  }
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
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Authenticate the producer before anything is stored or acted on.
    const rejected = await rejectReason(envelope as unknown as Record<string, unknown>)
    if (rejected) {
      console.warn(`[SES webhook] Rejected request: ${rejected}`)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Subscription handshake -- SNS sends this once when subscribing.
    if (envelope.Type === 'SubscriptionConfirmation' && envelope.SubscribeURL) {
      const subscribeUrl = snsUrl(envelope.SubscribeURL)
      if (!subscribeUrl) {
        console.warn('[SES webhook] Rejected SubscribeURL that is not an SNS https URL')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      try {
        const res = await fetch(subscribeUrl.href, {
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(SNS_FETCH_TIMEOUT_MS),
        })
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
