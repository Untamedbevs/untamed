import { redirect } from 'next/navigation'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { showsPackRewards } from '@/lib/rewards/preview'
import { isProgramActive } from '@/components/rewards/ProgramStatusNotice'
import { HuntBoard, type HuntView } from '@/components/rewards/HuntBoard'
import { loadLivePromotions, promotionWindow, SUBMISSION_COLUMNS, type PromotionSubmission } from '@/lib/rewards/catalog'

export const dynamic = 'force-dynamic'

export default async function PortalHuntsPage() {
  const member = await resolveMember()
  if (!member?.loyaltyMember || !(await showsPackRewards(member))) redirect('/portal')

  const admin = createAdminClient()
  const [promotions, { data: mine }] = await Promise.all([
    loadLivePromotions(admin),
    admin
      .from('promotion_submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('member_id', member.loyaltyMember.id)
      .order('created_at', { ascending: false }),
  ])
  const submissions = (mine || []) as unknown as PromotionSubmission[]
  const hunts: HuntView[] = promotions.map((p) => ({
    ...p,
    window: promotionWindow(p),
    mine: submissions.filter((s) => s.promotion_id === p.id),
  }))

  const enrolled = isProgramActive(member.loyaltyMember)
  const blockedMessage = member.viewAs
    ? 'View As is read-only: you can open each Hunt, but sending proof is turned off.'
    : enrolled
      ? undefined
      : 'Join Pack Rewards on your dashboard first. It takes a minute, then Hunts unlock.'

  return <HuntBoard hunts={hunts} canSubmit={enrolled && !member.viewAs} blockedMessage={blockedMessage} />
}
