import Link from 'next/link'
import { Gift, Sparkles } from 'lucide-react'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { PortalRewardsClient } from './PortalRewardsClient'

export const dynamic = 'force-dynamic'

export interface PortalLoyaltyTransaction {
  id: string
  member_id: string
  points: number
  type: 'receipt_approved' | 'signup_bonus' | 'redemption' | 'adjustment'
  description: string | null
  created_at: string
}

export interface PortalLoyaltyRedemption {
  id: string
  member_id: string
  reward_slug: string
  reward_label: string
  points_cost: number
  status: 'pending' | 'fulfilled' | 'cancelled'
  admin_notes: string | null
  fulfilled_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface PortalReferralRewardEarned {
  id: string
  earned_at: string
  status: 'pending' | 'fulfilled' | 'cancelled'
  tier?: {
    id: string
    label: string
    description: string | null
  } | null
}

export default async function PortalRewardsPage() {
  const member = await resolveMember()

  if (!member) {
    return (
      <div className="text-[#A0A0A0]">
        Please{' '}
        <Link href="/portal/login" className="text-[#9B30FF] underline">
          sign in
        </Link>
        .
      </div>
    )
  }

  if (!member.loyaltyMember) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-headline text-2xl text-white mb-1">Rewards</h1>
          <p className="text-sm text-[#A0A0A0]">
            Earn points for every receipt and submission, then trade them in
            for swag.
          </p>
        </div>
        <div className="bg-[#141414] border border-[#9B30FF]/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Join the Loyalty Program first
              </h3>
              <p className="text-sm text-[#A0A0A0] mb-4">
                Loyalty members earn points on every Untamed bottle and unlock
                merch through the rewards catalog.
              </p>
              <Link
                href="/rewards"
                className="inline-flex items-center gap-2 bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-4 py-2 hover:bg-[#7E22CE] transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Join now
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const supabase = createAdminClient()
  const memberId = member.loyaltyMember.id

  const [transactionsRes, redemptionsRes, referralRewardsRes] = await Promise.all([
    supabase
      .from('loyalty_transactions')
      .select('id, member_id, points, type, description, created_at')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('loyalty_redemptions')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(20),
    member.referralParticipant
      ? supabase
          .from('referral_rewards_earned')
          .select('id, earned_at, status, tier:referral_reward_tiers(id, label, description)')
          .eq('participant_id', member.referralParticipant.id)
          .order('earned_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as PortalReferralRewardEarned[] }),
  ])

  return (
    <PortalRewardsClient
      memberFirstName={member.loyaltyMember.first_name}
      pointsBalance={member.loyaltyMember.points_balance}
      initialTransactions={
        (transactionsRes.data || []) as PortalLoyaltyTransaction[]
      }
      initialRedemptions={
        (redemptionsRes.data || []) as PortalLoyaltyRedemption[]
      }
      initialReferralRewards={
        (referralRewardsRes.data || []) as PortalReferralRewardEarned[]
      }
    />
  )
}
