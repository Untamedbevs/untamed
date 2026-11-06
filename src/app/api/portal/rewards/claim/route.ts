import { NextRequest, NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { canRedeem, INELIGIBLE_MESSAGES, MEMBER_PROGRAM_COLUMNS, type MemberProgramFields } from '@/lib/rewards/eligibility'
import { CAPS } from '@/lib/rewards/program'
import { inRewardsPreview } from '@/lib/rewards/preview'
import { CLAIM_COLUMNS, formatValue, loadMilestones, trailPointsFor } from '@/lib/rewards/catalog'

export const dynamic = 'force-dynamic'

/**
 * POST /api/portal/rewards/claim { milestoneId }
 *
 * Claims the reward on a milestone the member has reached on their trail.
 * Once per milestone (a cancelled claim can be claimed again), counted toward
 * the yearly reward-value cap with catalog redemptions. Staff fulfill it.
 */
export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member?.loyaltyMember) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await inRewardsPreview(member.authUserId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const milestoneId = typeof body?.milestoneId === 'string' ? body.milestoneId : ''
    const admin = createAdminClient()

    const { data: fresh } = await admin
      .from('loyalty_members')
      .select(`id, email, first_name, ${MEMBER_PROGRAM_COLUMNS}`)
      .eq('id', member.loyaltyMember.id)
      .single()
    const eligibility = canRedeem(fresh as unknown as MemberProgramFields)
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: 'NOT_ELIGIBLE', message: INELIGIBLE_MESSAGES[eligibility.reason] },
        { status: 403 }
      )
    }

    const milestone = (await loadMilestones(admin)).find((m) => m.id === milestoneId)
    const reward = milestone?.reward
    if (!milestone || !reward?.is_active) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'That reward isn’t available.' }, { status: 404 })
    }

    const points = await trailPointsFor(admin, fresh!.id)
    if (points < milestone.points) {
      return NextResponse.json(
        { error: 'NOT_REACHED', message: `Reach ${milestone.points.toLocaleString('en-US')} points to claim this.` },
        { status: 400 }
      )
    }

    // Yearly reward-value cap: catalog redemptions plus milestone claims, cancelled excluded.
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString()
    const [redemptionsRes, claimsRes] = await Promise.all([
      admin
        .from('loyalty_redemptions')
        .select('retail_value_cents')
        .eq('member_id', fresh!.id)
        .neq('status', 'cancelled')
        .gte('created_at', yearStart),
      admin
        .from('reward_milestone_claims')
        .select('value_cents')
        .eq('member_id', fresh!.id)
        .neq('status', 'cancelled')
        .gte('created_at', yearStart),
    ])
    const usedCents =
      (redemptionsRes.data || []).reduce((s, r) => s + ((r.retail_value_cents as number) || 0), 0) +
      (claimsRes.data || []).reduce((s, c) => s + ((c.value_cents as number) || 0), 0)
    if (usedCents + reward.value_cents > CAPS.ANNUAL_REWARD_VALUE_CENTS) {
      return NextResponse.json(
        {
          error: 'ANNUAL_LIMIT',
          message: `This would go over the yearly reward limit of ${formatValue(CAPS.ANNUAL_REWARD_VALUE_CENTS)}. It resets January 1.`,
        },
        { status: 400 }
      )
    }

    const snapshot = {
      reward_id: reward.id,
      reward_name: reward.name,
      reward_kind: reward.kind,
      value_cents: reward.value_cents,
      points_at_claim: points,
      ship_state: (fresh as unknown as MemberProgramFields).residence_state,
      status: 'pending' as const,
      staff_note: null,
      fulfilled_by: null,
      fulfilled_at: null,
    }

    // A cancelled claim reopens; any other existing claim means it's already claimed.
    const { data: existing } = await admin
      .from('reward_milestone_claims')
      .select('id, status')
      .eq('member_id', fresh!.id)
      .eq('milestone_id', milestone.id)
      .maybeSingle()
    if (existing && existing.status !== 'cancelled') {
      return NextResponse.json({ error: 'ALREADY_CLAIMED', message: 'You already claimed this one.' }, { status: 409 })
    }
    const { data: claim, error } = existing
      ? await admin
          .from('reward_milestone_claims')
          .update(snapshot)
          .eq('id', existing.id)
          .eq('status', 'cancelled')
          .select(CLAIM_COLUMNS)
          .single()
      : await admin
          .from('reward_milestone_claims')
          .insert({ member_id: fresh!.id, milestone_id: milestone.id, ...snapshot })
          .select(CLAIM_COLUMNS)
          .single()
    if (error || !claim) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'ALREADY_CLAIMED', message: 'You already claimed this one.' }, { status: 409 })
      }
      throw error
    }

    const name = (fresh!.first_name as string | null) || fresh!.email
    try {
      await sendAndLogEmail({
        fromAlias: 'loyalty',
        to: 'loyalty@untamedbeverages.com',
        subject: `Reward claimed: ${name} → ${reward.name}`,
        html: `<p><strong>${name}</strong> (${fresh!.email}) reached <strong>${milestone.title}</strong> (${milestone.points.toLocaleString('en-US')} points) and claimed <strong>${reward.name}</strong> (${formatValue(reward.value_cents)}).</p><p>Fulfill it in <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin/rewards">Admin → Rewards Program → Claims</a>.</p>`,
        text: `${name} (${fresh!.email}) reached ${milestone.title} and claimed ${reward.name} (${formatValue(reward.value_cents)}). Fulfill it in Admin > Rewards Program > Claims.`,
        loyaltyMemberId: fresh!.id,
      })
    } catch (emailErr) {
      console.warn('[portal/rewards/claim] Staff email failed:', emailErr)
    }

    return NextResponse.json({ claim })
  } catch (error) {
    console.error('[portal/rewards/claim] Failed:', error)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}
