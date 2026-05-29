import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/resolve-member'
import {
  buildShareLinks,
  ensureReferralParticipant,
} from '@/lib/referral/helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let member
  try {
    member = await requireMember()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!member.loyaltyMember) {
    return NextResponse.json(
      {
        error: 'NOT_A_LOYALTY_MEMBER',
        message:
          'Join the loyalty program to activate your referral code.',
      },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()

  let participant
  try {
    participant = await ensureReferralParticipant(supabase, {
      loyaltyMemberId: member.loyaltyMember.id,
      email: member.loyaltyMember.email,
      displayName: member.loyaltyMember.first_name,
    })
  } catch (err) {
    console.error('[portal/referrals GET] activate failed:', err)
    return NextResponse.json(
      { error: 'Failed to activate referral participant' },
      { status: 500 }
    )
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
  const { consumerLink, distributorLink } = buildShareLinks(
    siteUrl,
    participant.referral_code
  )

  return NextResponse.json({
    participant,
    tiers: tiersRes.data || [],
    rewards: rewardsRes.data || [],
    invites: invitesRes.data || [],
    consumerLink,
    distributorLink,
  })
}
