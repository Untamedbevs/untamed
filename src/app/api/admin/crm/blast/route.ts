export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSenderById, DEFAULT_CRM_SENDER } from '@/lib/crm/senders'
import { resolveStaff, canDraftMarketing } from '@/lib/auth/resolve-staff'
import { planBlast, BlastPlanError, type BlastTarget } from '@/lib/crm/blast-plan'
import { approvalReason, queueCampaign, MAX_RECIPIENTS, type CampaignRow } from '@/lib/crm/campaign-queue'
import { getMarketingReadiness } from '@/lib/email/config'
import { getEmailSettings } from '@/lib/email/settings'
import { sanitizeBlocks, textToBlocks } from '@/lib/email/blocks'
import { checkEmailContent } from '@/lib/email/checks'
import { utmSlug } from '@/lib/email/compose'
import {
  REPERMISSION_COPY,
  REPERMISSION_COPY_VERSION,
  isRepermissionCopyApproved,
} from '@/lib/email/consent-copy'
import { logStaffAction } from '@/lib/audit'

/**
 * Create a campaign and submit it.
 *
 * Body: { kind, listSlug?, repermissionAudience?, filters, subject, preheader,
 *         blocks, templateId?, senderId?, scheduledFor?, name? }
 *
 * Content checks must pass. The campaign then either queues (now or at
 * scheduledFor) or waits for a second admin's approval: contractors' sends,
 * permission requests, and sends above the approval threshold.
 */
export async function POST(request: NextRequest) {
  try {
    const staff = await resolveStaff()
    if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canDraftMarketing(staff.role)) {
      return NextResponse.json({ error: 'Your role can’t create campaigns.' }, { status: 403 })
    }

    const body = (await request.json()) as Partial<BlastTarget> & {
      subject?: string
      preheader?: string
      blocks?: unknown
      textBody?: string
      templateId?: string
      senderId?: string
      scheduledFor?: string
      name?: string
    }
    const kind = body.kind === 'repermission' ? 'repermission' : 'marketing'

    const readiness = getMarketingReadiness()
    if (!readiness.ready) {
      return NextResponse.json({ error: 'Marketing email is not set up yet.', issues: readiness.issues }, { status: 409 })
    }
    const settings = await getEmailSettings()
    if (settings.marketing_paused) {
      return NextResponse.json(
        { error: `Marketing is paused: ${settings.marketing_paused_reason || 'see the email dashboard'}.` },
        { status: 409 }
      )
    }

    let subject: string
    let preheader: string | null = null
    let blocks = sanitizeBlocks(body.blocks)
    let textBody: string | null = null
    if (kind === 'repermission') {
      if (!isRepermissionCopyApproved()) {
        return NextResponse.json(
          { error: `The permission-request wording (${REPERMISSION_COPY_VERSION}) has not been approved for sending.` },
          { status: 409 }
        )
      }
      const copy = REPERMISSION_COPY[body.repermissionAudience === 'trade' ? 'trade' : 'consumer']
      subject = copy.subject
      textBody = copy.body
      blocks = textToBlocks(copy.body)
    } else {
      subject = body.subject?.trim() || ''
      preheader = body.preheader?.trim() || null
      if (blocks.length === 0 && body.textBody?.trim()) {
        textBody = body.textBody.trim()
        blocks = textToBlocks(textBody)
      }
      const checks = checkEmailContent({ subject, preheader, blocks })
      if (checks.errors.length > 0) {
        return NextResponse.json({ error: 'Fix the content checks first.', issues: checks.errors }, { status: 400 })
      }
    }

    let scheduledFor: string | null = null
    if (body.scheduledFor) {
      const at = new Date(body.scheduledFor)
      if (Number.isNaN(at.getTime())) return NextResponse.json({ error: 'Invalid schedule time' }, { status: 400 })
      if (at.getTime() > Date.now() + 60_000) scheduledFor = at.toISOString()
    }

    // Plan now for the count and the approval decision; queueing re-plans.
    const plan = await planBlast({
      kind,
      listSlug: body.listSlug,
      repermissionAudience: body.repermissionAudience,
      filters: body.filters!,
    })
    if (plan.recipients.length === 0) {
      return NextResponse.json(
        {
          error:
            kind === 'repermission'
              ? 'No one matching these filters is eligible for the permission request.'
              : 'No one matching these filters has opted in to this list.',
        },
        { status: 400 }
      )
    }
    if (plan.recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Too many recipients (${plan.recipients.length}).` }, { status: 400 })
    }

    const sender = getSenderById(body.senderId || DEFAULT_CRM_SENDER.id)
    const needsApproval = await approvalReason(kind, plan.recipients.length, staff.role)
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const name =
      body.name?.trim().slice(0, 120) ||
      (kind === 'repermission'
        ? `Permission request (${plan.repermissionAudience}): ${subject.slice(0, 60)}`
        : subject.slice(0, 100))

    const { data: campaign, error: campaignError } = await admin
      .from('messaging_campaigns')
      .insert({
        name,
        channel: 'email',
        kind,
        list_slug: plan.list?.slug || null,
        repermission_audience: plan.repermissionAudience,
        copy_version: kind === 'repermission' ? REPERMISSION_COPY_VERSION : null,
        subject,
        preheader,
        text_body: textBody,
        blocks: kind === 'repermission' ? null : blocks,
        template_id: body.templateId || null,
        sender_id: sender.id,
        audience_filter: body.filters,
        audience_count: plan.recipients.length,
        skipped_count: plan.matchedCount === null ? 0 : Math.max(0, plan.matchedCount - plan.recipients.length),
        scheduled_for: scheduledFor,
        utm_campaign: utmSlug(name),
        approval_required: Boolean(needsApproval),
        status: needsApproval ? 'pending_approval' : 'draft',
        submitted_by: staff.id,
        submitted_at: now,
        sent_count: 0,
        failed_count: 0,
        created_by: staff.id,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (campaignError || !campaign) {
      console.error('[blast] Failed to create campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    if (needsApproval) {
      await logStaffAction(staff.id, 'campaign.submit_for_approval', 'messaging_campaign', campaign.id, {
        reason: needsApproval,
        recipients: plan.recipients.length,
      })
      return NextResponse.json({
        campaignId: campaign.id,
        status: 'pending_approval',
        approvalReason: needsApproval,
        recipientCount: plan.recipients.length,
      })
    }

    const { queued, plan: queuedPlan } = await queueCampaign(campaign as CampaignRow, sender.email, staff.id)
    await logStaffAction(staff.id, scheduledFor ? 'campaign.schedule' : 'campaign.send', 'messaging_campaign', campaign.id, {
      recipients: queued,
      scheduled_for: scheduledFor,
    })

    return NextResponse.json({
      campaignId: campaign.id,
      status: scheduledFor ? 'scheduled' : 'sending',
      recipientCount: queued,
      suppressedCount: queuedPlan.suppressedCount,
      skippedCount: queuedPlan.matchedCount === null ? 0 : Math.max(0, queuedPlan.matchedCount - queued),
    })
  } catch (error: unknown) {
    if (error instanceof BlastPlanError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create campaign' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const staff = await resolveStaff()
    if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('messaging_campaigns')
      .select('id, name, subject, sender_id, kind, list_slug, audience_count, skipped_count, sent_count, failed_count, status, scheduled_for, approval_required, submitted_by, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaigns: data || [] })
  } catch (error: unknown) {
    console.error('Error listing campaigns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
