import Link from 'next/link'
import { Share2, Trophy } from 'lucide-react'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildShareLinks,
  ensureReferralParticipant,
} from '@/lib/referral/helpers'
import { PortalReferralsClient } from './PortalReferralsClient'
import { ProgramStatusNotice, isProgramActive } from '@/components/rewards/ProgramStatusNotice'
import { TerritoryMap } from '@/components/referral-hq/TerritoryMap'
import { enrollmentStatus } from '@/lib/rewards/eligibility'
import { PREVIEW_REASONS } from '@/lib/referral-hq/program'
import { loadMemberHq } from '@/lib/referral-hq/progress'

export const dynamic = 'force-dynamic'

export async function PortalReferralsPreview() {
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
          <h1 className="font-headline text-2xl text-white mb-1">
            Spread the Wild
          </h1>
          <p className="text-sm text-[#A0A0A0]">
            Share Untamed with the people in your life and grow the pack.
          </p>
        </div>
        <div className="bg-[#141414] border border-[#9B30FF]/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Join the Pack first
              </h3>
              <p className="text-sm text-[#A0A0A0] mb-4">
                Members get a personal link to share with friends and
                businesses. It only takes a moment.
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

  // Members get their link after enrolling: enrollment is where they agree to
  // disclose that they earn rewards and to share only with adults 21+.
  if (!isProgramActive(member.loyaltyMember)) {
    const status = enrollmentStatus(member.loyaltyMember)
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-headline text-2xl text-white mb-1">
            Spread the Wild
          </h1>
          <p className="text-sm text-[#A0A0A0]">
            Join Pack Rewards to get your personal link. Friends who join and
            confirm they&apos;re 21+ earn you points.
          </p>
        </div>
        <ProgramStatusNotice member={member.loyaltyMember} />
        {!status.ok && PREVIEW_REASONS.includes(status.reason) && (
          <TerritoryMap
            friendsByState={{}}
            homeState={member.loyaltyMember.residence_state}
            locked
          />
        )}
      </div>
    )
  }

  const supabase = createAdminClient()

  const participant = await ensureReferralParticipant(supabase, {
    loyaltyMemberId: member.loyaltyMember.id,
    email: member.loyaltyMember.email,
    displayName: member.loyaltyMember.first_name,
  })

  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString()
  const [{ count: creditsThisYear }, hq] = await Promise.all([
    supabase
      .from('loyalty_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member.loyaltyMember.id)
      .eq('type', 'referral_signup')
      .gte('created_at', yearStart),
    loadMemberHq(supabase, member.loyaltyMember, participant.id),
  ])

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbeverages.com'
  const { consumerLink } = buildShareLinks(siteUrl, participant.referral_code)

  return (
    <PortalReferralsClient
      initialParticipant={participant}
      initialConsumerLink={consumerLink}
      creditsThisYear={creditsThisYear || 0}
      friendsByState={hq.friendsByState}
      homeState={member.loyaltyMember.residence_state}
      weekly={hq.weekly}
    />
  )
}
