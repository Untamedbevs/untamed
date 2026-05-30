import Link from 'next/link'
import { Share2, Trophy } from 'lucide-react'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildShareLinks,
  ensureReferralParticipant,
} from '@/lib/referral/helpers'
import type {
  ReferralInvite,
  ReferralRewardEarned,
  ReferralRewardTier,
} from '@/lib/referral/types'
import { PortalReferralsClient } from './PortalReferralsClient'

export const dynamic = 'force-dynamic'

export default async function PortalReferralsPage() {
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
          <h1 className="font-headline text-2xl text-white mb-1">Referrals</h1>
          <p className="text-sm text-[#A0A0A0]">
            Share Untamed with the people in your life and earn rewards for
            every signup or retailer lead.
          </p>
        </div>
        <div className="bg-[#141414] border border-[#9B30FF]/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Join the Loyalty Program first
              </h3>
              <p className="text-sm text-[#A0A0A0] mb-4">
                Loyalty members get a personal referral code, share links, and
                progress toward tier rewards. It only takes a moment.
              </p>
              <Link
                href="/rewards"
                className="inline-flex items-center gap-2 bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-4 py-2 hover:bg-[#7E22CE] transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Join now
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const supabase = createAdminClient()

  const participant = await ensureReferralParticipant(supabase, {
    loyaltyMemberId: member.loyaltyMember.id,
    email: member.loyaltyMember.email,
    displayName: member.loyaltyMember.first_name,
  })

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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbeverages.com'
  const { consumerLink, distributorLink } = buildShareLinks(
    siteUrl,
    participant.referral_code
  )

  return (
    <PortalReferralsClient
      initialParticipant={participant}
      initialTiers={(tiersRes.data || []) as ReferralRewardTier[]}
      initialRewards={(rewardsRes.data || []) as ReferralRewardEarned[]}
      initialInvites={(invitesRes.data || []) as ReferralInvite[]}
      initialConsumerLink={consumerLink}
      initialDistributorLink={distributorLink}
    />
  )
}
