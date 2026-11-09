export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canSendMarketing } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'

const RECIPIENT_PAGE_SIZE = 100

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params
    if (!isUuid(campaignId)) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    const admin = createAdminClient()
    const page = parseInt(request.nextUrl.searchParams.get('page') || '0', 10)

    const { data: campaign, error: campaignError } = await admin
      .from('messaging_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count || 0)
    const byStatus = (status: string) =>
      count(admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', status))

    const [total, delivered, opened, clicked, bounced, complaint, rejected, emailFailed, pending, unsubscribes, stats, staffRows] =
      await Promise.all([
        count(admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)),
        byStatus('delivered'),
        byStatus('opened'),
        byStatus('clicked'),
        byStatus('bounced'),
        byStatus('complaint'),
        byStatus('rejected'),
        byStatus('failed'),
        count(
          admin
            .from('scheduled_messages')
            .select('id', { count: 'exact', head: true })
            .eq('related_entity_id', campaignId)
            .eq('related_entity_type', 'campaign')
            .in('status', ['pending', 'processing'])
        ),
        count(
          admin
            .from('email_consent_events')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .in('action', ['unsubscribe_all', 'opt_out'])
        ),
        admin.rpc('email_send_stats', { p_since: campaign.created_at }),
        admin.from('staff').select('id, full_name'),
      ])

    const attributed = ((stats.data || []) as { campaign_id: string | null; orders: number; revenue_cents: number }[])
      .find((s) => s.campaign_id === campaignId)
    const staffNames = new Map((staffRows.data || []).map((s) => [s.id, s.full_name]))

    const offset = page * RECIPIENT_PAGE_SIZE
    const { data: emailRows } = await admin
      .from('email_messages')
      .select('to_email, status, sent_at, delivered_at, opened_at, clicked_at')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: true })
      .range(offset, offset + RECIPIENT_PAGE_SIZE - 1)

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        preheader: campaign.preheader,
        blocks: campaign.blocks,
        textBody: campaign.text_body,
        senderId: campaign.sender_id,
        kind: campaign.kind,
        listSlug: campaign.list_slug,
        copyVersion: campaign.copy_version,
        skippedCount: campaign.skipped_count,
        audienceCount: campaign.audience_count,
        sentCount: campaign.sent_count,
        failedCount: campaign.failed_count,
        status: campaign.status,
        scheduledFor: campaign.scheduled_for,
        approvalRequired: campaign.approval_required,
        submittedBy: campaign.submitted_by ? staffNames.get(campaign.submitted_by) || 'Unknown' : null,
        submittedByMe: campaign.submitted_by === staff.id,
        approvedBy: campaign.approved_by ? staffNames.get(campaign.approved_by) || 'Unknown' : null,
        rejectionReason: campaign.rejection_reason,
        pausedReason: campaign.paused_reason,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      },
      stats: {
        total,
        delivered: delivered + opened + clicked,
        opened: opened + clicked,
        clicked,
        bounced,
        complaint,
        rejected,
        failed: emailFailed,
        unsubscribes,
        orders: attributed?.orders || 0,
        revenueCents: attributed?.revenue_cents || 0,
      },
      pending,
      canManage: canSendMarketing(staff.role),
      recipients: (emailRows || []).map((e) => ({
        email: e.to_email,
        status: e.status,
        sentAt: e.sent_at,
        deliveredAt: e.delivered_at,
        openedAt: e.opened_at,
        clickedAt: e.clicked_at,
      })),
      pagination: {
        page,
        pageSize: RECIPIENT_PAGE_SIZE,
        totalRecipients: total,
      },
    })
  } catch (error: unknown) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
