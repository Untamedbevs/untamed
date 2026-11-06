import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { showsPackRewards } from '@/lib/rewards/preview'
import { enrollmentStatus } from '@/lib/rewards/eligibility'
import { loadMilestones } from '@/lib/rewards/catalog'
import { SPIRIT_ANIMALS } from '@/lib/rewards/spirit-animals'
import { Journey } from '@/components/rewards/Journey'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Join the Pack | Untamed' }

/**
 * The Pack Rewards onboarding journey, full screen with no portal chrome.
 * Members who are already enrolled (or not in Pack Rewards) go to the portal.
 */
export default async function PortalWelcomePage() {
  const member = await resolveMember()
  if (!member) redirect('/portal/login?returnTo=%2Fportal%2Fwelcome')
  const loyalty = member.loyaltyMember
  if (!loyalty || !(await showsPackRewards(member))) redirect('/portal')

  const status = enrollmentStatus(loyalty)
  if (status.ok || status.reason !== 'not_enrolled') redirect('/portal')

  const milestones = await loadMilestones(createAdminClient())
  // The trail scene shows the first stop, a middle reward and the summit.
  const preview = milestones.length
    ? [milestones[0], milestones[Math.floor(milestones.length / 2)], milestones[milestones.length - 1]]
    : []

  return (
    <Journey
      firstName={loyalty.first_name}
      defaultState={loyalty.residence_state}
      startingPoints={loyalty.points_balance ?? 0}
      spirits={SPIRIT_ANIMALS}
      preview={preview}
      readOnly={!!member.viewAs}
    />
  )
}
