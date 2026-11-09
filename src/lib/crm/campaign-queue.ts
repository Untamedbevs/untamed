/**
 * Campaign lifecycle: decide whether a submitted campaign needs a second
 * admin's approval, and queue its recipients (now or at a scheduled time).
 *
 * draft -> pending_approval -> (approved) -> scheduled | sending -> sent
 *                      \-> (rejected) -> draft
 * Any queued campaign can be paused, resumed, or cancelled.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { planBlast, type BlastPlan, type BlastTarget } from '@/lib/crm/blast-plan'
import { fillFirstName, REPERMISSION_COPY } from '@/lib/email/consent-copy'
import { getEmailSettings } from '@/lib/email/settings'
import { canSendMarketing } from '@/lib/auth/resolve-staff'

const INSERT_CHUNK = 1000
const PARALLEL_INSERTS = 3
export const MAX_RECIPIENTS = 100_000

export interface CampaignRow {
  id: string
  kind: 'marketing' | 'repermission'
  list_slug: string | null
  repermission_audience: 'consumer' | 'trade' | null
  audience_filter: BlastTarget['filters']
  subject: string | null
  text_body: string | null
  sender_id: string | null
  scheduled_for: string | null
  status: string
  submitted_by: string | null
}

export function targetFor(c: CampaignRow): BlastTarget {
  return {
    kind: c.kind,
    listSlug: c.list_slug || undefined,
    repermissionAudience: c.repermission_audience || undefined,
    filters: c.audience_filter,
  }
}

/** Why a submission needs approval, or null when the submitter can send it. */
export async function approvalReason(
  kind: 'marketing' | 'repermission',
  recipientCount: number,
  submitterRole: string
): Promise<string | null> {
  if (!canSendMarketing(submitterRole)) return 'Submitted by a contractor'
  if (kind === 'repermission') return 'Permission requests always need a second admin'
  const { approval_threshold } = await getEmailSettings()
  if (approval_threshold > 0 && recipientCount > approval_threshold) {
    return `More than ${approval_threshold.toLocaleString()} recipients`
  }
  return null
}

/**
 * Queue every eligible recipient for a campaign. Recipients are re-planned
 * here so an approval or a schedule hours later still uses current consent.
 */
export async function queueCampaign(
  campaign: CampaignRow,
  senderEmail: string,
  actorStaffId: string
): Promise<{ queued: number; plan: BlastPlan }> {
  const plan = await planBlast(targetFor(campaign))
  const recipients = plan.recipients
  if (recipients.length === 0) throw new Error('No one is eligible to receive this campaign right now.')
  if (recipients.length > MAX_RECIPIENTS) {
    throw new Error(`Too many recipients (${recipients.length}). Maximum is ${MAX_RECIPIENTS.toLocaleString()}.`)
  }

  const admin = createAdminClient()
  const now = new Date()
  const sendAt = campaign.scheduled_for && new Date(campaign.scheduled_for) > now ? new Date(campaign.scheduled_for) : now
  const repermission = campaign.kind === 'repermission'
  const skipped = plan.matchedCount === null ? 0 : Math.max(0, plan.matchedCount - recipients.length)

  const rows = recipients.map((r) => {
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email
    const body = repermission
      ? fillFirstName(REPERMISSION_COPY[campaign.repermission_audience || 'consumer'].body, r.first_name)
      : campaign.text_body || ''
    return {
      message_type: 'email',
      recipient_email: r.email,
      recipient_name: name,
      // Personalized per recipient at send time.
      subject: campaign.subject || '',
      body,
      text_body: body,
      scheduled_for: sendAt.toISOString(),
      status: 'pending',
      related_entity_type: 'campaign',
      related_entity_id: campaign.id,
      email_contact_id: r.contact_id,
      loyalty_member_id: r.loyalty_member_id || null,
      referral_participant_id: r.referral_participant_id || null,
      distributor_lead_id: r.distributor_lead_id || null,
      sender_email: senderEmail,
      created_by: actorStaffId,
    }
  })

  for (let i = 0; i < rows.length; i += INSERT_CHUNK * PARALLEL_INSERTS) {
    const batch: (typeof rows)[] = []
    for (let j = i; j < Math.min(rows.length, i + INSERT_CHUNK * PARALLEL_INSERTS); j += INSERT_CHUNK) {
      batch.push(rows.slice(j, j + INSERT_CHUNK))
    }
    const results = await Promise.all(batch.map((chunk) => admin.from('scheduled_messages').insert(chunk)))
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      await admin
        .from('scheduled_messages')
        .update({ status: 'cancelled', error_message: 'Campaign failed to queue', updated_at: new Date().toISOString() })
        .eq('related_entity_id', campaign.id)
        .eq('status', 'pending')
      throw new Error(`Failed to queue messages: ${failed.error.message}`)
    }
  }

  const { error } = await admin
    .from('messaging_campaigns')
    .update({
      status: sendAt > now ? 'scheduled' : 'sending',
      audience_count: recipients.length,
      skipped_count: skipped,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)
  if (error) throw new Error(`Queued, but the campaign status didn't update: ${error.message}`)

  return { queued: recipients.length, plan }
}
