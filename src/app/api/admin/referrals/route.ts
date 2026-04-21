import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [
      { data: participants },
      { data: events },
      { data: tiers },
      { data: rewardsEarned },
    ] = await Promise.all([
      supabase
        .from('referral_participants')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('referral_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('referral_reward_tiers')
        .select('*')
        .order('tier_order', { ascending: true }),
      supabase
        .from('referral_rewards_earned')
        .select('*, tier:referral_reward_tiers(*), participant:referral_participants(email, display_name)')
        .order('earned_at', { ascending: false }),
    ])

    const totals = {
      participants: participants?.length || 0,
      totalClicks: participants?.reduce((sum, p) => sum + (p.total_clicks || 0), 0) || 0,
      consumerSignups: participants?.reduce((sum, p) => sum + (p.consumer_signups || 0), 0) || 0,
      distributorLeads: participants?.reduce((sum, p) => sum + (p.distributor_leads || 0), 0) || 0,
      paidConversions: participants?.reduce((sum, p) => sum + (p.paid_conversions || 0), 0) || 0,
    }

    return NextResponse.json({
      totals,
      participants: participants || [],
      events: events || [],
      tiers: tiers || [],
      rewardsEarned: rewardsEarned || [],
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load referral data' }, { status: 500 })
  }
}
