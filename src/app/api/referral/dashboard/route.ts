import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: participant } = await supabase
      .from('referral_participants')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Not enrolled in referral program' }, { status: 404 })
    }

    const [tiersRes, rewardsRes, invitesRes] = await Promise.all([
      supabase
        .from('referral_reward_tiers')
        .select('*')
        .eq('is_active', true)
        .order('tier_order', { ascending: true }),
      supabase
        .from('referral_rewards_earned')
        .select('*, tier:referral_reward_tiers(*)')
        .eq('participant_id', participant.id)
        .order('earned_at', { ascending: false }),
      supabase
        .from('referral_invites')
        .select('*')
        .eq('participant_id', participant.id)
        .order('sent_at', { ascending: false })
        .limit(50),
    ])

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

    return NextResponse.json({
      participant,
      tiers: tiersRes.data || [],
      rewards: rewardsRes.data || [],
      invites: invitesRes.data || [],
      consumerLink: `${siteUrl}/?ref=${participant.referral_code}`,
      distributorLink: `${siteUrl}/retail?ref=${participant.referral_code}`,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
