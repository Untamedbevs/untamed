import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { VIEW_AS_COOKIE } from '@/lib/auth/view-as'
import { signedInUserInRewardsPreview } from '@/lib/rewards/preview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/portal/view-as — for the portal chrome: who the portal is showing
 * when an admin is in View As, and whether the Pack Rewards pages (Hunts) are on.
 */
export async function GET() {
  if (!(await cookies()).has(VIEW_AS_COOKIE)) {
    return NextResponse.json({ active: false, packRewards: await signedInUserInRewardsPreview() })
  }

  const member = await resolveMember()
  if (!member?.viewAs) return NextResponse.json({ active: false, packRewards: await signedInUserInRewardsPreview() })

  return NextResponse.json({
    active: true,
    packRewards: member.viewAs.mode === 'pack-rewards',
    mode: member.viewAs.mode,
    adminEmail: member.viewAs.adminEmail,
    member: { email: member.email, firstName: member.loyaltyMember?.first_name ?? null },
  })
}
