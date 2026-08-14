import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { LEAD_SLA_HOURS } from '@/lib/referral/constants'

function isPaidSource(source: string | null, medium: string | null, gclid: string | null, fbclid: string | null) {
  if (gclid || fbclid) return true
  const src = (source || '').toLowerCase()
  const med = (medium || '').toLowerCase()
  return (
    ['cpc', 'paid', 'ppc', 'paidsocial', 'social_paid'].includes(med) ||
    (['google', 'facebook', 'fb', 'ig', 'instagram', 'meta'].includes(src) &&
      ['cpc', 'paid', 'ppc', 'social', 'social_paid', 'paidsocial'].includes(med))
  )
}

export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = Math.min(90, Math.max(7, Number(request.nextUrl.searchParams.get('days')) || 30))
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const sinceDate = since.slice(0, 10)

  try {
    const supabase = createAdminClient()

    const [
      spendRes,
      leadsRes,
      eventsRes,
      sessionsRes,
    ] = await Promise.all([
      supabase
        .from('ad_spend_daily')
        .select('spend_date, platform, campaign_name, spend, impressions, clicks')
        .gte('spend_date', sinceDate),
      supabase
        .from('distributor_leads')
        .select(
          'id, status, created_at, first_contacted_at, first_utm_source, first_utm_medium, first_utm_campaign, first_gclid, first_fbclid, converting_landing_page'
        )
        .gte('created_at', since),
      supabase
        .from('tracking_events')
        .select('event_type, page_path, created_at')
        .gte('created_at', since)
        .in('event_type', ['pageview', 'form_start', 'form_complete']),
      supabase
        .from('sessions')
        .select('id, landing_page, utm_source, utm_medium, utm_campaign, gclid, fbclid, started_at')
        .gte('started_at', since),
    ])

    const spendRows = spendRes.data || []
    const leads = leadsRes.data || []
    const events = eventsRes.data || []
    const sessions = sessionsRes.data || []

    const spend = spendRows.reduce((s, r) => s + Number(r.spend || 0), 0)
    const impressions = spendRows.reduce((s, r) => s + Number(r.impressions || 0), 0)
    const clicks = spendRows.reduce((s, r) => s + Number(r.clicks || 0), 0)

    const isRetailPath = (path: string | null) =>
      !!path && (path.startsWith('/lp/retail') || path === '/retail' || path === '/distribute')

    const lpViews = events.filter((e) => e.event_type === 'pageview' && isRetailPath(e.page_path)).length
    const formStarts = events.filter((e) => e.event_type === 'form_start').length
    const formCompletes = events.filter((e) => e.event_type === 'form_complete').length

    const paidSessions = sessions.filter((s) =>
      isPaidSource(s.utm_source, s.utm_medium, s.gclid, s.fbclid)
    ).length

    const contacted = leads.filter((l) => l.status !== 'new' || l.first_contacted_at).length
    const contactedWithinSla = leads.filter((l) => {
      if (!l.first_contacted_at) return l.status !== 'new'
      const hours =
        (new Date(l.first_contacted_at).getTime() - new Date(l.created_at).getTime()) / 36e5
      return hours <= LEAD_SLA_HOURS
    }).length
    const qualified = leads.filter((l) =>
      ['qualified', 'negotiating', 'converted'].includes(l.status)
    ).length
    const converted = leads.filter((l) => l.status === 'converted').length

    const cpl = leads.length > 0 ? spend / leads.length : 0
    const costPerDoor = converted > 0 ? spend / converted : 0
    const ctr = impressions > 0 ? clicks / impressions : 0
    const cpc = clicks > 0 ? spend / clicks : 0
    const lpCvr = lpViews > 0 ? leads.length / lpViews : 0

    const byCampaign = new Map<
      string,
      { campaign: string; source: string; leads: number; converted: number }
    >()
    for (const l of leads) {
      const campaign = l.first_utm_campaign || '(none)'
      const source = l.first_utm_source || 'direct'
      const key = `${source}::${campaign}`
      const row = byCampaign.get(key) || { campaign, source, leads: 0, converted: 0 }
      row.leads += 1
      if (l.status === 'converted') row.converted += 1
      byCampaign.set(key, row)
    }

    const spendByCampaign = new Map<string, number>()
    for (const r of spendRows) {
      const key = r.campaign_name || '(none)'
      spendByCampaign.set(key, (spendByCampaign.get(key) || 0) + Number(r.spend || 0))
    }

    const campaigns = Array.from(byCampaign.values())
      .map((c) => ({
        ...c,
        spend: spendByCampaign.get(c.campaign) || 0,
        costPerDoor: c.converted > 0 ? (spendByCampaign.get(c.campaign) || 0) / c.converted : null,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 20)

    return NextResponse.json({
      days,
      funnel: {
        spend,
        impressions,
        clicks,
        cpc,
        ctr,
        paidSessions,
        lpViews,
        formStarts,
        formCompletes,
        leads: leads.length,
        cpl,
        lpCvr,
        contacted,
        contactedWithinSla,
        slaRate: leads.length > 0 ? contactedWithinSla / leads.length : 0,
        qualified,
        converted,
        costPerDoor,
      },
      campaigns,
      spendRows,
    })
  } catch (err) {
    console.error('[retail/performance]', err)
    return NextResponse.json({ error: 'Failed to load performance' }, { status: 500 })
  }
}
