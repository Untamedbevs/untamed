export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canSendMarketing } from '@/lib/auth/resolve-staff'
import { getMarketingDailyCap, getMarketingReadiness } from '@/lib/email/config'
import { getEmailSettings } from '@/lib/email/settings'
import { describeTrigger, type FlowRow } from '@/lib/email/flows'

interface StatRow {
  campaign_id: string | null
  flow_slug: string | null
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complaints: number
  unsubscribes: number
  orders: number
  revenue_cents: number
}

type HealthRow = { sent: number; delivered: number; bounced: number; complaints: number; opened: number; clicked: number }

/** Everything the email dashboard shows, in one request. */
export async function GET() {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const [
    settings,
    healthMarketing,
    healthTransactional,
    alerts,
    campaigns,
    stats,
    flows,
    flowEnrollments,
    growth,
    lists,
    consents,
    contactsCount,
    sentToday,
  ] = await Promise.all([
    getEmailSettings(),
    admin.rpc('email_health', { p_days: 30, p_stream: 'marketing' }),
    admin.rpc('email_health', { p_days: 30, p_stream: 'transactional' }),
    admin.from('email_alerts').select('*').is('resolved_at', null).order('created_at', { ascending: false }).limit(20),
    admin
      .from('messaging_campaigns')
      .select('id, name, subject, kind, list_slug, status, audience_count, scheduled_for, approval_required, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
    admin.rpc('email_send_stats', { p_since: since90 }),
    admin.from('email_flows').select('*').order('sort_order'),
    admin.from('email_flow_enrollments').select('flow_slug').eq('status', 'active').limit(50_000),
    admin.rpc('email_list_growth', { p_days: 30 }),
    admin.from('email_lists').select('slug, name').eq('is_active', true).order('sort_order'),
    admin.from('email_consents').select('list_slug').eq('status', 'subscribed').limit(100_000),
    admin.from('email_contacts').select('id', { count: 'exact', head: true }),
    admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('stream', 'marketing').gte('sent_at', dayStart.toISOString()),
  ])

  const statRows = (stats.data || []) as StatRow[]
  const byCampaign = new Map(statRows.filter((s) => s.campaign_id).map((s) => [s.campaign_id!, s]))
  const byFlow = new Map(statRows.filter((s) => s.flow_slug).map((s) => [s.flow_slug!, s]))
  const activeByFlow = new Map<string, number>()
  for (const e of flowEnrollments.data || []) activeByFlow.set(e.flow_slug, (activeByFlow.get(e.flow_slug) || 0) + 1)
  const subscribedByList = new Map<string, number>()
  for (const c of consents.data || []) subscribedByList.set(c.list_slug, (subscribedByList.get(c.list_slug) || 0) + 1)

  const health = (r: { data: unknown }) => ((r.data as HealthRow[] | null) || [])[0] || { sent: 0, delivered: 0, bounced: 0, complaints: 0, opened: 0, clicked: 0 }

  return NextResponse.json({
    readiness: getMarketingReadiness(),
    settings: {
      marketingPaused: settings.marketing_paused,
      marketingPausedReason: settings.marketing_paused_reason,
      complaintPauseRate: settings.complaint_pause_rate,
      bouncePauseRate: settings.bounce_pause_rate,
    },
    canManage: canSendMarketing(staff.role),
    today: { sent: sentToday.count || 0, cap: getMarketingDailyCap() },
    health: { marketing: health(healthMarketing), transactional: health(healthTransactional) },
    alerts: alerts.data || [],
    contacts: contactsCount.count || 0,
    lists: (lists.data || []).map((l) => ({ ...l, subscribed: subscribedByList.get(l.slug) || 0 })),
    growth: growth.data || [],
    campaigns: (campaigns.data || []).map((c) => ({ ...c, stats: byCampaign.get(c.id) || null })),
    flows: ((flows.data || []) as FlowRow[]).map((f) => ({
      slug: f.slug,
      name: f.name,
      status: f.status,
      stream: f.stream,
      triggerDescription: describeTrigger(f),
      active: activeByFlow.get(f.slug) || 0,
      stats: byFlow.get(f.slug) || null,
    })),
    since30,
  })
}
