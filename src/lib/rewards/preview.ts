import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalMember } from '@/lib/auth/resolve-member'

/**
 * Pack Rewards (21+ enrollment, Referral HQ in the portal, the new redemption
 * rules) runs for active staff only until counsel signs off. Everyone else
 * keeps the current portal, and earning still follows the current flow for
 * all accounts: join bonus at signup, referral credit at signup, online-order
 * points at purchase.
 */
export async function inRewardsPreview(authUserId: string | null | undefined): Promise<boolean> {
  if (!authUserId) return false
  const { data } = await createAdminClient()
    .from('staff')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .maybeSingle()
  return !!data
}

/**
 * Whether a portal page shows the Pack Rewards version. In View As, the admin
 * chose the version; otherwise it's the staff check above.
 */
export async function showsPackRewards(member: PortalMember | null): Promise<boolean> {
  if (member?.viewAs) return member.viewAs.mode === 'pack-rewards'
  return inRewardsPreview(member?.authUserId)
}

/** Same check for pages that have no member context, using the signed-in user. */
export async function signedInUserInRewardsPreview(): Promise<boolean> {
  const { data: { user } } = await (await createClient()).auth.getUser()
  return inRewardsPreview(user?.id)
}
