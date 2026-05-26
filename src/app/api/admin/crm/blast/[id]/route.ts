export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'

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

    const statusCounts = await Promise.all([
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'delivered'),
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'opened'),
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'clicked'),
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'bounced'),
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'complaint'),
      admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed'),
      admin
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('related_entity_id', campaignId)
        .eq('related_entity_type', 'campaign')
        .in('status', ['pending', 'processing']),
    ])

    const [total, delivered, opened, clicked, bounced, complaint, emailFailed, pending] =
      statusCounts.map((r) => r.count || 0)

    const stats = {
      total,
      delivered: delivered + opened + clicked,
      opened: opened + clicked,
      clicked,
      bounced,
      complaint,
      failed: emailFailed,
    }

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
        senderId: campaign.sender_id,
        audienceCount: campaign.audience_count,
        sentCount: campaign.sent_count,
        failedCount: campaign.failed_count,
        status: campaign.status,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      },
      stats,
      pending,
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
