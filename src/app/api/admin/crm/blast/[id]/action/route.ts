export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canSendMarketing } from '@/lib/auth/resolve-staff'
import { queueCampaign, type CampaignRow } from '@/lib/crm/campaign-queue'
import { getSenderById, DEFAULT_CRM_SENDER } from '@/lib/crm/senders'
import { getMarketingReadiness } from '@/lib/email/config'
import { getEmailSettings } from '@/lib/email/settings'
import { isRepermissionCopyApproved } from '@/lib/email/consent-copy'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'

type Action = 'approve' | 'reject' | 'pause' | 'resume' | 'cancel'

/**
 * Body: { action, reason? }
 * - approve / reject: a pending campaign; the approver must be a different
 *   admin from the person who submitted it.
 * - pause / resume / cancel: a scheduled or sending campaign.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendMarketing(staff.role)) {
    return NextResponse.json({ error: 'Only admins can approve or change a campaign’s sending.' }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as { action?: Action; reason?: string }
  const reason = body.reason?.trim().slice(0, 500) || null

  const admin = createAdminClient()
  const { data: campaign } = await admin.from('messaging_campaigns').select('*').eq('id', id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const now = new Date().toISOString()

  switch (body.action) {
    case 'approve': {
      if (campaign.status !== 'pending_approval') {
        return NextResponse.json({ error: 'This campaign isn’t waiting for approval.' }, { status: 409 })
      }
      if (campaign.submitted_by === staff.id) {
        return NextResponse.json({ error: 'A different admin has to approve your own campaign.' }, { status: 403 })
      }
      const readiness = getMarketingReadiness()
      if (!readiness.ready) return NextResponse.json({ error: 'Marketing email is not set up yet.', issues: readiness.issues }, { status: 409 })
      if ((await getEmailSettings()).marketing_paused) {
        return NextResponse.json({ error: 'Marketing is paused. Resume it on the email dashboard first.' }, { status: 409 })
      }
      if (campaign.kind === 'repermission' && !isRepermissionCopyApproved()) {
        return NextResponse.json({ error: 'The permission-request wording isn’t approved.' }, { status: 409 })
      }

      await admin.from('messaging_campaigns').update({ approved_by: staff.id, approved_at: now, updated_at: now }).eq('id', id)
      try {
        const sender = getSenderById(campaign.sender_id || DEFAULT_CRM_SENDER.id)
        const { queued } = await queueCampaign(campaign as CampaignRow, sender.email, staff.id)
        await logStaffAction(staff.id, 'campaign.approve', 'messaging_campaign', id, { queued })
        return NextResponse.json({ ok: true, queued })
      } catch (err) {
        await admin.from('messaging_campaigns').update({ approved_by: null, approved_at: null }).eq('id', id)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Queueing failed' }, { status: 400 })
      }
    }

    case 'reject': {
      if (campaign.status !== 'pending_approval') {
        return NextResponse.json({ error: 'This campaign isn’t waiting for approval.' }, { status: 409 })
      }
      await admin
        .from('messaging_campaigns')
        .update({ status: 'draft', rejected_by: staff.id, rejected_at: now, rejection_reason: reason, updated_at: now })
        .eq('id', id)
      await logStaffAction(staff.id, 'campaign.reject', 'messaging_campaign', id, { reason })
      return NextResponse.json({ ok: true })
    }

    case 'pause': {
      if (!['scheduled', 'sending'].includes(campaign.status)) {
        return NextResponse.json({ error: 'Only a scheduled or sending campaign can be paused.' }, { status: 409 })
      }
      await admin
        .from('messaging_campaigns')
        .update({ status: 'paused', paused_at: now, paused_reason: reason || 'Paused by staff', updated_at: now })
        .eq('id', id)
      await logStaffAction(staff.id, 'campaign.pause', 'messaging_campaign', id, { reason })
      return NextResponse.json({ ok: true })
    }

    case 'resume': {
      if (campaign.status !== 'paused') {
        return NextResponse.json({ error: 'This campaign isn’t paused.' }, { status: 409 })
      }
      const future = campaign.scheduled_for && new Date(campaign.scheduled_for) > new Date()
      await admin
        .from('messaging_campaigns')
        .update({ status: future ? 'scheduled' : 'sending', paused_at: null, paused_reason: null, updated_at: now })
        .eq('id', id)
      await logStaffAction(staff.id, 'campaign.resume', 'messaging_campaign', id)
      return NextResponse.json({ ok: true })
    }

    case 'cancel': {
      if (['sent', 'cancelled'].includes(campaign.status)) {
        return NextResponse.json({ error: 'This campaign is already finished.' }, { status: 409 })
      }
      await admin
        .from('scheduled_messages')
        .update({ status: 'cancelled', error_message: 'Campaign cancelled', updated_at: now })
        .eq('related_entity_id', id)
        .in('status', ['pending', 'processing'])
      await admin.from('messaging_campaigns').update({ status: 'cancelled', updated_at: now }).eq('id', id)
      await logStaffAction(staff.id, 'campaign.cancel', 'messaging_campaign', id, { reason })
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
