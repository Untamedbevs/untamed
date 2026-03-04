import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [
      { data: members },
      { data: sessions },
      { data: visitors },
      { data: receipts },
    ] = await Promise.all([
      supabase
        .from('loyalty_members')
        .select('id, favorite_drink_slug, first_utm_source, first_utm_campaign, points_balance, created_at'),
      supabase
        .from('sessions')
        .select('id, utm_source, utm_medium, utm_campaign, landing_page, device_type, started_at')
        .order('started_at', { ascending: false })
        .limit(1000),
      supabase
        .from('visitors')
        .select('id, first_utm_source, first_utm_campaign, session_count, first_seen_at, last_seen_at')
        .order('first_seen_at', { ascending: false })
        .limit(500),
      supabase
        .from('loyalty_receipts')
        .select('id, status, drink_slug, points_awarded, created_at'),
    ])

    const allMembers = members || []
    const allSessions = sessions || []
    const allVisitors = visitors || []
    const allReceipts = receipts || []

    // Sessions by UTM source
    const sessionsBySource: Record<string, number> = {}
    allSessions.forEach((s) => {
      const src = s.utm_source || 'direct'
      sessionsBySource[src] = (sessionsBySource[src] || 0) + 1
    })

    // Sessions by campaign
    const sessionsByCampaign: Record<string, number> = {}
    allSessions.forEach((s) => {
      if (s.utm_campaign) {
        sessionsByCampaign[s.utm_campaign] = (sessionsByCampaign[s.utm_campaign] || 0) + 1
      }
    })

    // Members by drink
    const membersByDrink: Record<string, number> = {}
    allMembers.forEach((m) => {
      const d = m.favorite_drink_slug || 'unknown'
      membersByDrink[d] = (membersByDrink[d] || 0) + 1
    })

    // Members by source
    const membersBySource: Record<string, number> = {}
    allMembers.forEach((m) => {
      const src = m.first_utm_source || 'direct'
      membersBySource[src] = (membersBySource[src] || 0) + 1
    })

    // Device breakdown
    const deviceBreakdown: Record<string, number> = {}
    allSessions.forEach((s) => {
      const d = s.device_type || 'unknown'
      deviceBreakdown[d] = (deviceBreakdown[d] || 0) + 1
    })

    return NextResponse.json({
      totals: {
        visitors: allVisitors.length,
        sessions: allSessions.length,
        members: allMembers.length,
        receipts: allReceipts.length,
        pendingReceipts: allReceipts.filter((r) => r.status === 'pending').length,
        totalPointsIssued: allMembers.reduce((sum, m) => sum + m.points_balance, 0),
      },
      sessionsBySource,
      sessionsByCampaign,
      membersByDrink,
      membersBySource,
      deviceBreakdown,
    })
  } catch {
    return NextResponse.json({ error: 'Analytics failed' }, { status: 500 })
  }
}
