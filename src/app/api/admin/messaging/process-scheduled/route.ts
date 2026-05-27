/**
 * Cron worker: drains `scheduled_messages` and sends each via SES.
 *
 * Designed to be called every minute by Vercel Cron. Idempotent and safe to
 * run concurrently (status transitions provide soft locking).
 *
 * Guarded by `CRON_SECRET` (set in env) when present.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { getSenderById, DEFAULT_CRM_SENDER } from '@/lib/crm/senders'
import {
  buildListUnsubscribeHeaders,
  buildUnsubscribeUrl,
} from '@/lib/messaging/unsubscribe'

const BATCH_SIZE = 25
const MAX_PER_RUN = 1000
const BATCH_DELAY_MS = 200
const STUCK_THRESHOLD_MS = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  let processed = 0
  let sent = 0
  let failed = 0
  let skippedDuplicates = 0

  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString()
  const { count: unstuckCount } = await admin
    .from('scheduled_messages')
    .update({ status: 'pending', updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('status', 'processing')
    .lt('updated_at', stuckCutoff)

  if (unstuckCount && unstuckCount > 0) {
    console.log(`[process-scheduled] Reset ${unstuckCount} stuck processing rows to pending`)
  }

  const senderCache = new Map<string, string>()

  async function resolveSenderEmail(campaignId: string | null): Promise<string> {
    if (!campaignId) return DEFAULT_CRM_SENDER.email
    const cached = senderCache.get(campaignId)
    if (cached) return cached

    const { data: campaign } = await admin
      .from('messaging_campaigns')
      .select('sender_id')
      .eq('id', campaignId)
      .single()

    const email = campaign?.sender_id
      ? getSenderById(campaign.sender_id).email
      : DEFAULT_CRM_SENDER.email

    senderCache.set(campaignId, email)
    return email
  }

  try {
    while (processed < MAX_PER_RUN) {
      const { data: messages, error } = await admin
        .from('scheduled_messages')
        .select('*')
        .eq('status', 'pending')
        .eq('related_entity_type', 'campaign')
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE)

      if (error || !messages || messages.length === 0) break

      const messageIds = messages.map((m) => m.id)
      await admin
        .from('scheduled_messages')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .in('id', messageIds)

      const campaignIds = new Set<string>()

      const settled = await Promise.allSettled(
        messages.map(async (msg) => {
          if (msg.related_entity_id) campaignIds.add(msg.related_entity_id)

          // Dedupe: skip if this campaign already sent to this recipient
          if (msg.recipient_email && msg.related_entity_id) {
            const { count } = await admin
              .from('email_messages')
              .select('id', { count: 'exact', head: true })
              .eq('campaign_id', msg.related_entity_id)
              .eq('to_email', msg.recipient_email)

            if (count && count > 0) {
              await admin
                .from('scheduled_messages')
                .update({ status: 'sent', updated_at: new Date().toISOString() })
                .eq('id', msg.id)
              return 'duplicate' as const
            }
          }

          const senderEmail =
            msg.sender_email || (await resolveSenderEmail(msg.related_entity_id))

          const textContent = msg.text_body || msg.body || ''
          const campaignId = msg.related_entity_id || undefined
          const recipientEmail = msg.recipient_email!

          const unsubUrl = buildUnsubscribeUrl(recipientEmail, campaignId)
          const unsubHeaders = buildListUnsubscribeHeaders(recipientEmail, campaignId)

          const html = renderBulkHtml(textContent, unsubUrl, recipientEmail)
          const text = `${textContent}\n\n---\nUnsubscribe: ${unsubUrl}`

          await sendAndLogEmail({
            to: recipientEmail,
            subject: msg.subject || '',
            html,
            text,
            from: senderEmail,
            replyTo: senderEmail,
            headers: unsubHeaders,
            campaignId,
            loyaltyMemberId: msg.loyalty_member_id || undefined,
            referralParticipantId: msg.referral_participant_id || undefined,
            distributorLeadId: msg.distributor_lead_id || undefined,
          })

          await admin
            .from('scheduled_messages')
            .update({ status: 'sent', updated_at: new Date().toISOString() })
            .eq('id', msg.id)

          return 'sent' as const
        })
      )

      for (let i = 0; i < settled.length; i++) {
        const result = settled[i]
        processed++
        if (result.status === 'fulfilled') {
          if (result.value === 'duplicate') {
            skippedDuplicates++
          } else {
            sent++
          }
        } else {
          failed++
          const failedMsg = messages[i]
          if (failedMsg) {
            const errMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error'
            await admin
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: errMsg,
                updated_at: new Date().toISOString(),
              })
              .eq('id', failedMsg.id)
          }
        }
      }

      for (const cId of campaignIds) {
        const { count: sentCount } = await admin
          .from('email_messages')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', cId)

        const { count: failedCount } = await admin
          .from('scheduled_messages')
          .select('id', { count: 'exact', head: true })
          .eq('related_entity_id', cId)
          .eq('status', 'failed')

        const { count: pendingCount } = await admin
          .from('scheduled_messages')
          .select('id', { count: 'exact', head: true })
          .eq('related_entity_id', cId)
          .in('status', ['pending', 'processing'])

        const status = (pendingCount || 0) === 0 ? 'sent' : 'sending'

        await admin
          .from('messaging_campaigns')
          .update({
            sent_count: sentCount || 0,
            failed_count: failedCount || 0,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cId)
      }

      if (messages.length < BATCH_SIZE) break
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }

    return NextResponse.json({ processed, sent, failed, skippedDuplicates })
  } catch (error: unknown) {
    console.error('[process-scheduled] Error:', error)
    return NextResponse.json(
      { error: 'Processing failed', processed, sent, failed },
      { status: 500 }
    )
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Wrap a plain-text blast body in branded HTML with an unsubscribe footer.
 * The footer is required for CAN-SPAM compliance and to keep complaint rates low.
 */
function renderBulkHtml(textBody: string, unsubUrl: string, recipientEmail: string): string {
  const body = escapeHtml(textBody).replace(/\n/g, '<br>')
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111;border:1px solid #2A2A2A;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px;">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9B30FF;font-weight:700;margin-bottom:24px;">Untamed Beverages</div>
              <div style="color:#D0D0D0;font-size:15px;line-height:1.6;">${body}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2A2A2A;color:#666;font-size:11px;line-height:1.5;text-align:center;">
              You're receiving this because you signed up for Untamed updates as <span style="color:#888;">${escapeHtml(recipientEmail)}</span>.<br>
              <a href="${unsubUrl}" style="color:#9B30FF;text-decoration:underline;">Unsubscribe</a>
              &nbsp;&middot;&nbsp;
              Untamed Beverages, LLC
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
