/**
 * Cron worker: drains `scheduled_messages` campaign rows and sends each one.
 *
 * Called every minute by Vercel Cron. Safe to run concurrently: rows are
 * claimed with a pending -> processing transition and only the rows this run
 * claimed are sent.
 *
 * Before sending, every recipient is re-checked against the consent rules
 * (they may have unsubscribed, bounced, or complained since the blast was
 * queued). Rows also wait for quiet hours to end in the recipient's time zone
 * and are skipped once someone has hit the weekly frequency cap. Nothing is
 * sent while marketing isn't configured or the kill switch is on; paused
 * campaigns wait. Sending is paced to EMAIL_SEND_RATE_PER_SECOND and stops at
 * EMAIL_MARKETING_DAILY_CAP.
 *
 * Guarded by `CRON_SECRET` (set in env) when present.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { getSenderById, DEFAULT_CRM_SENDER } from '@/lib/crm/senders'
import { buildConfirmUrl, buildListUnsubscribeHeaders, buildUnsubscribeUrl } from '@/lib/messaging/unsubscribe'
import { getMarketingDailyCap, getMarketingReadiness, getSendRatePerSecond } from '@/lib/email/config'
import { getEmailSettings, isQuietHour, timezoneFor, type EmailSettings } from '@/lib/email/settings'
import { getEmailLists, getMarketingRecipients, getRepermissionRecipients } from '@/lib/messaging/consent'
import { reasonForList, renderMarketingEmail } from '@/lib/messaging/marketing-email'
import { renderForRecipient } from '@/lib/email/compose'
import { sanitizeBlocks, textToBlocks, type EmailBlock } from '@/lib/email/blocks'
import { REPERMISSION_COPY, type RepermissionAudience } from '@/lib/email/consent-copy'
import { dayKey, raiseAlert } from '@/lib/email/alerts'

const MAX_BATCH_SIZE = 25
const MAX_PER_RUN = 1000
/** Stop claiming new batches after this long so the run ends inside maxDuration. */
const TIME_BUDGET_MS = 45_000
const STUCK_THRESHOLD_MS = 5 * 60 * 1000

type Admin = ReturnType<typeof createAdminClient>

interface CampaignInfo {
  id: string
  kind: 'marketing' | 'repermission'
  status: string
  senderEmail: string
  listSlug: string | null
  listName: string | null
  repermissionAudience: RepermissionAudience | null
  blocks: EmailBlock[] | null
  preheader: string | null
  utmCampaign: string | null
}

interface QueuedMessage {
  id: string
  recipient_email: string | null
  subject: string | null
  body: string | null
  text_body: string | null
  sender_email: string | null
  related_entity_id: string | null
  email_contact_id: string | null
  loyalty_member_id: string | null
  referral_participant_id: string | null
  distributor_lead_id: string | null
}

interface ContactInfo {
  email: string
  first_name: string | null
  last_name: string | null
  timezone: string | null
  state_code: string | null
  loyalty_member_id: string | null
}

/** Top of the first hour (within a day) outside quiet hours for this zone. */
function nextAllowedTime(now: Date, tz: string, s: EmailSettings): Date {
  for (let h = 1; h <= 24; h++) {
    const t = new Date(now.getTime() + h * 3_600_000)
    t.setUTCMinutes(0, 0, 0)
    if (!isQuietHour(t, tz, s.quiet_hours_start, s.quiet_hours_end)) return t
  }
  return new Date(now.getTime() + 3_600_000)
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startedAt = Date.now()
  const admin = createAdminClient()
  let processed = 0
  let sent = 0
  let failed = 0
  let skippedDuplicates = 0
  let skippedIneligible = 0
  let deferredQuiet = 0
  let skippedCapped = 0

  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString()
  const { count: unstuckCount } = await admin
    .from('scheduled_messages')
    .update({ status: 'pending', updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('status', 'processing')
    .lt('updated_at', stuckCutoff)

  if (unstuckCount && unstuckCount > 0) {
    console.log(`[process-scheduled] Reset ${unstuckCount} stuck processing rows to pending`)
  }

  const readiness = getMarketingReadiness()
  if (!readiness.ready) {
    // Leave everything queued; it sends once configuration is complete.
    return NextResponse.json({ processed: 0, waiting: true, issues: readiness.issues })
  }
  const settings = await getEmailSettings()
  if (settings.marketing_paused) {
    return NextResponse.json({ processed: 0, waiting: true, paused: settings.marketing_paused_reason })
  }

  let remainingToday = Infinity
  const dailyCap = getMarketingDailyCap()
  if (dailyCap !== null) {
    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const { count: sentToday, error: capError } = await admin
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('stream', 'marketing')
      .gte('sent_at', dayStart.toISOString())
    if (capError) {
      return NextResponse.json({ error: 'Could not read today’s send count' }, { status: 500 })
    }
    remainingToday = Math.max(0, dailyCap - (sentToday || 0))
    if (remainingToday === 0) {
      return NextResponse.json({ processed: 0, dailyCapReached: true, dailyCap })
    }
  }

  // Paused campaigns keep their rows queued; skip them in the queue query.
  const { data: pausedRows } = await admin.from('messaging_campaigns').select('id').eq('status', 'paused').limit(500)
  const pausedIds = (pausedRows || []).map((r) => r.id as string)

  const ratePerSecond = getSendRatePerSecond()
  const batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(ratePerSecond)))
  const campaignCache = new Map<string, CampaignInfo | null>()
  let listNames = new Map<string, string>()

  async function getCampaign(campaignId: string): Promise<CampaignInfo | null> {
    if (campaignCache.has(campaignId)) return campaignCache.get(campaignId)!
    const { data } = await admin
      .from('messaging_campaigns')
      .select('id, kind, status, sender_id, list_slug, repermission_audience, blocks, preheader, utm_campaign')
      .eq('id', campaignId)
      .maybeSingle()
    const info: CampaignInfo | null = data
      ? {
          id: data.id,
          kind: data.kind === 'repermission' ? 'repermission' : 'marketing',
          status: data.status,
          senderEmail: data.sender_id ? getSenderById(data.sender_id).email : DEFAULT_CRM_SENDER.email,
          listSlug: data.list_slug,
          listName: data.list_slug ? listNames.get(data.list_slug) || null : null,
          repermissionAudience:
            data.repermission_audience === 'trade' || data.repermission_audience === 'consumer' ? data.repermission_audience : null,
          blocks: Array.isArray(data.blocks) ? sanitizeBlocks(data.blocks) : null,
          preheader: data.preheader,
          utmCampaign: data.utm_campaign,
        }
      : null
    campaignCache.set(campaignId, info)
    if (info?.status === 'scheduled') {
      await admin.from('messaging_campaigns').update({ status: 'sending' }).eq('id', campaignId).eq('status', 'scheduled')
      info.status = 'sending'
    }
    return info
  }

  async function markRows(ids: string[], status: 'sent' | 'failed' | 'cancelled', errorMessage?: string) {
    if (ids.length === 0) return
    await admin
      .from('scheduled_messages')
      .update({ status, ...(errorMessage ? { error_message: errorMessage } : {}), updated_at: new Date().toISOString() })
      .in('id', ids)
  }

  /** Addresses in this batch that the campaign may still mail right now. */
  async function stillEligible(campaign: CampaignInfo, emails: string[]): Promise<Set<string>> {
    let rows
    if (campaign.kind === 'repermission') {
      if (!campaign.repermissionAudience) return new Set()
      rows = await getRepermissionRecipients(REPERMISSION_COPY[campaign.repermissionAudience].sources, emails)
    } else {
      // A marketing campaign without a list predates consent tracking; it can't be sent.
      if (!campaign.listSlug) return new Set()
      rows = await getMarketingRecipients(campaign.listSlug, emails, {
        days: settings.sunset_days,
        minSends: settings.sunset_min_sends,
      })
    }
    return new Set(rows.map((r) => r.email))
  }

  try {
    listNames = new Map((await getEmailLists(true)).map((l) => [l.slug, l.name]))

    while (processed < MAX_PER_RUN && remainingToday > 0 && Date.now() - startedAt < TIME_BUDGET_MS) {
      const batchStartedAt = Date.now()
      const limit = Math.min(batchSize, remainingToday, MAX_PER_RUN - processed)

      let candidateQuery = admin
        .from('scheduled_messages')
        .select('id')
        .eq('status', 'pending')
        .eq('related_entity_type', 'campaign')
        .lte('scheduled_for', new Date().toISOString())
      if (pausedIds.length > 0) candidateQuery = candidateQuery.not('related_entity_id', 'in', `(${pausedIds.join(',')})`)
      const { data: candidates, error } = await candidateQuery.order('created_at', { ascending: true }).limit(limit)

      if (error || !candidates || candidates.length === 0) break

      // Claim: only rows still pending flip to processing, so a concurrent run
      // can't send the same row.
      const { data: claimed } = await admin
        .from('scheduled_messages')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .in('id', candidates.map((c) => c.id))
        .eq('status', 'pending')
        .select('id, recipient_email, subject, body, text_body, sender_email, related_entity_id, email_contact_id, loyalty_member_id, referral_participant_id, distributor_lead_id')

      const messages = (claimed || []) as QueuedMessage[]
      if (messages.length === 0) continue

      const batchEmails = [...new Set(messages.map((m) => (m.recipient_email || '').toLowerCase()).filter(Boolean))]

      // Recipient details (name, time zone) and this week's marketing counts.
      const [{ data: contactRows }, { data: weekCounts }] = await Promise.all([
        admin.from('email_contacts').select('email, first_name, last_name, timezone, state_code, loyalty_member_id').in('email', batchEmails),
        admin.rpc('email_recent_marketing_counts', {
          p_emails: batchEmails,
          p_since: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        }),
      ])
      const contacts = new Map(((contactRows || []) as ContactInfo[]).map((c) => [c.email, c]))
      const sentThisWeek = new Map(((weekCounts || []) as { email: string; sent: number }[]).map((r) => [r.email, r.sent]))
      const memberIds = [...new Set([...contacts.values()].map((c) => c.loyalty_member_id).filter(Boolean))] as string[]
      const balances = new Map<string, number>()
      if (memberIds.length) {
        const { data: members } = await admin.from('loyalty_members').select('id, points_balance').in('id', memberIds)
        for (const m of members || []) balances.set(m.id, m.points_balance || 0)
      }

      // Group by campaign so each campaign's eligibility is checked in one call.
      const byCampaign = new Map<string, QueuedMessage[]>()
      for (const msg of messages) {
        const key = msg.related_entity_id || ''
        byCampaign.set(key, [...(byCampaign.get(key) || []), msg])
      }

      const now = new Date()
      const toSend: { msg: QueuedMessage; campaign: CampaignInfo }[] = []
      for (const [campaignId, rows] of byCampaign) {
        const campaign = campaignId ? await getCampaign(campaignId) : null
        if (!campaign || campaign.status === 'cancelled') {
          await markRows(rows.map((r) => r.id), 'cancelled', campaign ? 'Campaign cancelled' : 'Campaign not found')
          processed += rows.length
          skippedIneligible += rows.length
          continue
        }
        if (campaign.status === 'paused') {
          await admin.from('scheduled_messages').update({ status: 'pending' }).in('id', rows.map((r) => r.id))
          continue
        }
        const emails = rows.map((r) => (r.recipient_email || '').toLowerCase()).filter(Boolean)
        const eligible = await stillEligible(campaign, emails)

        const ineligible: string[] = []
        const capped: string[] = []
        for (const msg of rows) {
          const email = (msg.recipient_email || '').toLowerCase()
          if (!eligible.has(email)) {
            ineligible.push(msg.id)
            continue
          }
          if ((sentThisWeek.get(email) || 0) >= settings.weekly_frequency_cap) {
            capped.push(msg.id)
            continue
          }
          const tz = timezoneFor(contacts.get(email) || {}, settings.default_timezone)
          if (isQuietHour(now, tz, settings.quiet_hours_start, settings.quiet_hours_end)) {
            await admin
              .from('scheduled_messages')
              .update({ status: 'pending', scheduled_for: nextAllowedTime(now, tz, settings).toISOString(), updated_at: now.toISOString() })
              .eq('id', msg.id)
            deferredQuiet++
            continue
          }
          toSend.push({ msg, campaign })
          // Count it now so one batch can't push someone past the cap.
          sentThisWeek.set(email, (sentThisWeek.get(email) || 0) + 1)
        }
        await markRows(ineligible, 'cancelled', 'No longer eligible: unsubscribed, suppressed, paused, or consent changed after queueing')
        await markRows(capped, 'cancelled', `Weekly frequency cap (${settings.weekly_frequency_cap}) reached`)
        processed += ineligible.length + capped.length
        skippedIneligible += ineligible.length
        skippedCapped += capped.length
      }

      const settled = await Promise.allSettled(
        toSend.map(async ({ msg, campaign }) => {
          const recipientEmail = msg.recipient_email!.toLowerCase()

          // Dedupe: skip if this campaign already sent to this recipient
          const { count } = await admin
            .from('email_messages')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('to_email', recipientEmail)
          if (count && count > 0) {
            await markRows([msg.id], 'sent')
            return 'duplicate' as const
          }

          const senderEmail = msg.sender_email || campaign.senderEmail
          const contact = contacts.get(recipientEmail)
          let subject = msg.subject || ''
          let html: string
          let text: string
          let headers: Record<string, string>

          if (campaign.kind === 'repermission') {
            const copy = REPERMISSION_COPY[campaign.repermissionAudience!]
            ;({ html, text } = renderMarketingEmail({
              textBody: msg.text_body || msg.body || '',
              recipientEmail,
              unsubscribeUrl: buildUnsubscribeUrl(recipientEmail, campaign.id),
              reason: copy.reason,
              cta: { label: copy.ctaLabel, url: buildConfirmUrl(recipientEmail, campaign.id, campaign.repermissionAudience!), noTrack: true },
            }))
            headers = buildListUnsubscribeHeaders(recipientEmail, campaign.id)
          } else {
            const rendered = renderForRecipient({
              recipient: {
                email: recipientEmail,
                first_name: contact?.first_name,
                last_name: contact?.last_name,
                points_balance: contact?.loyalty_member_id ? balances.get(contact.loyalty_member_id) : undefined,
              },
              subject,
              preheader: campaign.preheader,
              blocks: campaign.blocks?.length ? campaign.blocks : textToBlocks(msg.text_body || msg.body || ''),
              reason: reasonForList(campaign.listName || 'Untamed'),
              kind: 'marketing',
              campaignId: campaign.id,
              utmCampaign: campaign.utmCampaign,
            })
            ;({ subject, html, text, headers } = rendered)
          }

          await sendAndLogEmail({
            to: recipientEmail,
            subject,
            html,
            text,
            from: senderEmail,
            replyTo: senderEmail,
            headers,
            stream: 'marketing',
            tags: { campaign: campaign.id, kind: campaign.kind },
            campaignId: campaign.id,
            templateSlug: campaign.kind === 'repermission' ? 'repermission-request' : 'marketing-blast',
            contactId: msg.email_contact_id || undefined,
            loyaltyMemberId: msg.loyalty_member_id || undefined,
            referralParticipantId: msg.referral_participant_id || undefined,
            distributorLeadId: msg.distributor_lead_id || undefined,
          })

          await markRows([msg.id], 'sent')

          if (campaign.kind === 'repermission' && msg.email_contact_id) {
            await admin
              .from('email_contacts')
              .update({ repermission_sent_at: new Date().toISOString(), repermission_campaign_id: campaign.id })
              .eq('id', msg.email_contact_id)
          }

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
            remainingToday--
          }
        } else {
          failed++
          const errMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error'
          console.error('[process-scheduled] Send failed:', errMsg)
          await markRows([toSend[i].msg.id], 'failed', errMsg.slice(0, 1000))
        }
      }

      for (const cId of byCampaign.keys()) {
        if (cId) await refreshCampaignCounts(admin, cId)
      }

      if (candidates.length < limit) break

      // Pace to the configured send rate.
      const minBatchMs = (toSend.length / ratePerSecond) * 1000
      const elapsed = Date.now() - batchStartedAt
      if (elapsed < minBatchMs) {
        await new Promise((resolve) => setTimeout(resolve, minBatchMs - elapsed))
      }
    }

    if (failed > 0 && failed >= Math.max(3, (sent + failed) * 0.2)) {
      await raiseAlert({
        kind: 'worker_failure',
        severity: 'critical',
        message: `${failed} of ${sent + failed} marketing sends failed in one run.`,
        details: { sent, failed },
        dedupeKey: dayKey('worker_failure'),
      })
    }

    return NextResponse.json({ processed, sent, failed, skippedDuplicates, skippedIneligible, skippedCapped, deferredQuiet })
  } catch (error: unknown) {
    console.error('[process-scheduled] Error:', error)
    await raiseAlert({
      kind: 'worker_failure',
      severity: 'critical',
      message: `The marketing send worker crashed: ${error instanceof Error ? error.message : String(error)}`,
      details: { processed, sent, failed },
      dedupeKey: dayKey('worker_crash'),
    })
    return NextResponse.json({ error: 'Processing failed', processed, sent, failed }, { status: 500 })
  }
}

async function refreshCampaignCounts(admin: Admin, campaignId: string) {
  const { count: sentCount } = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)

  const { count: failedCount } = await admin
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('related_entity_id', campaignId)
    .eq('status', 'failed')

  const { count: pendingCount } = await admin
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('related_entity_id', campaignId)
    .in('status', ['pending', 'processing'])

  const update: Record<string, unknown> = {
    sent_count: sentCount || 0,
    failed_count: failedCount || 0,
    updated_at: new Date().toISOString(),
  }
  if ((pendingCount || 0) === 0) update.status = 'sent'

  await admin
    .from('messaging_campaigns')
    .update(update)
    .eq('id', campaignId)
    .in('status', ['sending', 'scheduled'])
}
