/**
 * Cron worker: drains `scheduled_messages` through Google Workspace SMTP.
 *
 * Runs every minute (vercel.json). Each run:
 *   1. Releases rows stuck in `processing` (crashed run) back to `pending`.
 *   2. Works out how much of the rolling 24h send budget is left
 *      (EMAIL_DAILY_LIMIT, default 1800 — smtp.gmail.com allows ~2,000
 *      recipients/day; the Workspace SMTP relay allows ~10,000), minus
 *      EMAIL_TRANSACTIONAL_RESERVE (default 200) kept free for sign-in links
 *      and rewards notices, which share the same Workspace account.
 *      Blasts are held entirely while EMAIL_POSTAL_ADDRESS is unset.
 *   3. Claims due rows atomically via `claim_scheduled_messages`
 *      (FOR UPDATE SKIP LOCKED, so overlapping runs never double-send).
 *   4. Sends with small concurrency; transient failures are retried with
 *      backoff, permanent (5xx) failures are marked failed.
 *   5. Rolls campaign counters/status forward.
 *
 * Requires `CRON_SECRET` (Bearer); refuses every request when it is unset.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { getSenderById, DEFAULT_CRM_SENDER } from '@/lib/crm/senders'
import { buildListUnsubscribeHeaders, buildUnsubscribeUrl } from '@/lib/messaging/unsubscribe'
import { renderEmailHtml, renderEmailText, type EmailLayout } from '@/lib/email/render'
import { suppressionKeys } from '@/lib/messaging/suppressions'
import { getPostalAddress, getPrivacyUrl, POSTAL_ADDRESS_MISSING } from '@/lib/email/compliance'

const CONCURRENCY = 5
const TIME_BUDGET_MS = 45_000
const STUCK_THRESHOLD_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000]

/**
 * True only when CRON_SECRET is set and the request carries it as
 * `Authorization: Bearer <secret>` (Vercel Cron sends exactly that). A missing
 * or empty CRON_SECRET refuses every request instead of skipping the check.
 */
function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[messaging/process-scheduled] CRON_SECRET is not set; refusing request')
    return false
  }
  // Hash both sides so the comparison is constant-time regardless of length.
  const given = createHash('sha256').update(request.headers.get('authorization') ?? '').digest()
  const expected = createHash('sha256').update(`Bearer ${cronSecret}`).digest()
  return timingSafeEqual(given, expected)
}

function dailyLimit(): number {
  const n = parseInt(process.env.EMAIL_DAILY_LIMIT || '', 10)
  return Number.isFinite(n) && n > 0 ? n : 1800
}

/** Sends left unused by blasts so sign-in links and notices still go out. */
function transactionalReserve(): number {
  const n = parseInt(process.env.EMAIL_TRANSACTIONAL_RESERVE || '', 10)
  return Number.isFinite(n) && n >= 0 ? n : 200
}

function isPermanentFailure(err: unknown): boolean {
  const code = (err as { responseCode?: number })?.responseCode
  if (typeof code === 'number' && code >= 500) return true
  // The SMTP sink refusing a malformed recipient won't succeed on retry.
  return err instanceof Error && err.message.startsWith('Refusing to send')
}

interface QueuedMessage {
  id: string
  recipient_email: string | null
  subject: string | null
  body: string | null
  text_body: string | null
  sender_email: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  loyalty_member_id: string | null
  referral_participant_id: string | null
  distributor_lead_id: string | null
  created_by: string | null
  attempts: number
}

interface CampaignInfo {
  senderEmail: string
  preheader?: string
  layout: EmailLayout
  status: string
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // CAN-SPAM: no postal address, no marketing. Rows stay pending until it's set.
  const postalAddress = getPostalAddress()
  if (!postalAddress) {
    console.warn(`[process-scheduled] ${POSTAL_ADDRESS_MISSING}`)
    return NextResponse.json({ sent: 0, held: true, reason: POSTAL_ADDRESS_MISSING })
  }
  const privacyUrl = getPrivacyUrl()

  const startedAt = Date.now()
  const admin = createAdminClient()
  let sent = 0
  let failed = 0
  let retried = 0
  let skipped = 0

  // 1. Release stuck rows
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString()
  await admin
    .from('scheduled_messages')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'processing')
    .lt('updated_at', stuckCutoff)

  // 2. Rolling 24h budget
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: sentLast24h } = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .gte('sent_at', since)
  let budget = Math.max(0, dailyLimit() - transactionalReserve() - (sentLast24h || 0))

  const campaignCache = new Map<string, CampaignInfo>()
  const touchedCampaigns = new Set<string>()

  async function getCampaign(id: string): Promise<CampaignInfo> {
    const cached = campaignCache.get(id)
    if (cached) return cached
    const { data } = await admin
      .from('messaging_campaigns')
      .select('sender_id, status, layout, template:email_templates(preheader)')
      .eq('id', id)
      .single()
    const template = (data?.template ?? null) as { preheader: string | null } | { preheader: string | null }[] | null
    const preheader = Array.isArray(template) ? template[0]?.preheader : template?.preheader
    const info: CampaignInfo = {
      senderEmail: data?.sender_id ? getSenderById(data.sender_id).email : DEFAULT_CRM_SENDER.email,
      preheader: preheader || undefined,
      layout: data?.layout === 'plain' ? 'plain' : 'branded',
      status: data?.status || 'sending',
    }
    campaignCache.set(id, info)
    return info
  }

  async function markSentOrSkipped(id: string) {
    await admin
      .from('scheduled_messages')
      .update({ status: 'sent', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  async function processOne(msg: QueuedMessage): Promise<'sent' | 'skipped'> {
    const campaignId = msg.related_entity_type === 'campaign' ? msg.related_entity_id : null
    const campaign = campaignId ? await getCampaign(campaignId) : null
    if (campaignId) touchedCampaigns.add(campaignId)

    if (!msg.recipient_email) throw Object.assign(new Error('No recipient email'), { responseCode: 550 })

    if (campaign?.status === 'cancelled') {
      await admin
        .from('scheduled_messages')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', msg.id)
      return 'skipped'
    }

    // Already sent for this campaign (e.g. a previous run crashed after sending)
    if (campaignId) {
      const { count } = await admin
        .from('email_messages')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('to_email', msg.recipient_email)
      if (count && count > 0) {
        await markSentOrSkipped(msg.id)
        return 'skipped'
      }
    }

    // Suppressed since it was queued (unsubscribed / bounced)
    const { data: suppression } = await admin
      .from('email_suppressions')
      .select('id')
      .in('email', suppressionKeys(msg.recipient_email))
      .limit(1)
      .maybeSingle()
    if (suppression) {
      await admin
        .from('scheduled_messages')
        .update({ status: 'cancelled', error_message: 'Suppressed', updated_at: new Date().toISOString() })
        .eq('id', msg.id)
      return 'skipped'
    }

    const senderEmail = msg.sender_email || campaign?.senderEmail || DEFAULT_CRM_SENDER.email
    const body = msg.text_body || msg.body || ''
    const unsubUrl = buildUnsubscribeUrl(msg.recipient_email, campaignId)

    await sendAndLogEmail({
      to: msg.recipient_email,
      subject: msg.subject || '',
      html: renderEmailHtml({
        body,
        preheader: campaign?.preheader,
        unsubscribeUrl: unsubUrl,
        recipientEmail: msg.recipient_email,
        postalAddress,
        privacyUrl,
        layout: campaign?.layout,
      }),
      text: renderEmailText(body, unsubUrl, { postalAddress, privacyUrl }),
      from: senderEmail,
      replyTo: senderEmail,
      headers: buildListUnsubscribeHeaders(msg.recipient_email, campaignId),
      campaignId: campaignId || undefined,
      sentBy: msg.created_by || undefined,
      loyaltyMemberId: msg.loyalty_member_id || undefined,
      referralParticipantId: msg.referral_participant_id || undefined,
      distributorLeadId: msg.distributor_lead_id || undefined,
    })

    await markSentOrSkipped(msg.id)
    return 'sent'
  }

  try {
    // 3 + 4. Claim and send until out of budget, time, or work
    while (budget > 0 && Date.now() - startedAt < TIME_BUDGET_MS) {
      const { data, error } = await admin.rpc('claim_scheduled_messages', {
        p_limit: Math.min(CONCURRENCY, budget),
      })
      if (error) throw new Error(`claim_scheduled_messages failed: ${error.message}`)
      const messages = (data || []) as QueuedMessage[]
      if (messages.length === 0) break

      const results = await Promise.allSettled(messages.map(processOne))

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const msg = messages[i]
        if (result.status === 'fulfilled') {
          if (result.value === 'sent') {
            sent++
            budget--
          } else {
            skipped++
          }
          continue
        }

        const errMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error'
        if (!isPermanentFailure(result.reason) && msg.attempts < MAX_ATTEMPTS) {
          retried++
          const delay = RETRY_BACKOFF_MS[Math.min(msg.attempts - 1, RETRY_BACKOFF_MS.length - 1)]
          await admin
            .from('scheduled_messages')
            .update({
              status: 'pending',
              error_message: errMsg,
              scheduled_for: new Date(Date.now() + delay).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', msg.id)
        } else {
          failed++
          await admin
            .from('scheduled_messages')
            .update({ status: 'failed', error_message: errMsg, updated_at: new Date().toISOString() })
            .eq('id', msg.id)
        }
      }
    }

    // 5. Roll campaign counters forward (also flips scheduled -> sending -> sent)
    for (const cId of touchedCampaigns) {
      await refreshCampaignStatus(admin, cId)
    }

    return NextResponse.json({ sent, failed, retried, skipped, budgetRemaining: budget })
  } catch (error: unknown) {
    console.error('[process-scheduled] Error:', error)
    return NextResponse.json(
      { error: 'Processing failed', sent, failed, retried, skipped },
      { status: 500 }
    )
  }
}

async function refreshCampaignStatus(admin: ReturnType<typeof createAdminClient>, cId: string) {
  const [{ count: sentCount }, { count: failedCount }, { count: pendingCount }, { data: campaign }] =
    await Promise.all([
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', cId),
      admin
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('related_entity_type', 'campaign')
        .eq('related_entity_id', cId)
        .eq('status', 'failed'),
      admin
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('related_entity_type', 'campaign')
        .eq('related_entity_id', cId)
        .in('status', ['pending', 'processing']),
      admin.from('messaging_campaigns').select('status').eq('id', cId).single(),
    ])

  const update: Record<string, unknown> = {
    sent_count: sentCount || 0,
    failed_count: failedCount || 0,
    updated_at: new Date().toISOString(),
  }
  if (campaign?.status !== 'cancelled') {
    update.status = (pendingCount || 0) === 0 ? 'sent' : 'sending'
  }
  await admin.from('messaging_campaigns').update(update).eq('id', cId)
}
