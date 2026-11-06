import { sendTemplateEmail } from '@/lib/email/templates'
import { siteOrigin } from '@/lib/crm/recipient-vars'

/** Portal links every rewards email can use. */
export function rewardsLinks() {
  const origin = siteOrigin()
  return { hunts_url: `${origin}/portal/hunts`, rewards_url: `${origin}/portal/rewards` }
}

type RewardsTemplate = 'hunt-approved' | 'hunt-needs-changes' | 'reward-on-its-way'

/**
 * Email a member about a rewards event, from the editable templates in
 * migration 00031. Best-effort: a failed send is logged and never undoes the
 * review or fulfillment that triggered it.
 */
export async function notifyMember(
  template: RewardsTemplate,
  member: { id: string; email: string; first_name: string | null },
  vars: Record<string, string>
) {
  try {
    await sendTemplateEmail(template, {
      to: member.email,
      loyaltyMemberId: member.id,
      vars: { first_name: member.first_name || 'there', ...rewardsLinks(), note: '', ...vars },
    })
  } catch (err) {
    console.warn(`[rewards/notify] ${template} to member ${member.id} failed:`, err)
  }
}
