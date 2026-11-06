import { NextRequest, NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { REWARDS } from '@/lib/loyalty/constants'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { applyPoints, InsufficientPointsError } from '@/lib/rewards/ledger'
import {
  canRedeem,
  INELIGIBLE_MESSAGES,
  MEMBER_PROGRAM_COLUMNS,
  type MemberProgramFields,
} from '@/lib/rewards/eligibility'
import { CAPS } from '@/lib/rewards/program'
import { inRewardsPreview } from '@/lib/rewards/preview'

export const dynamic = 'force-dynamic'

interface CreateBody {
  rewardSlug?: string
}

// ---------------------------------------------------------------------------
// POST /api/portal/rewards/redeem — redeem a catalog reward under Pack Rewards
//
// Requires current Pack Rewards enrollment (21+, eligible state, current
// Program Rules) and enforces the yearly reward-value cap. Points are debited
// through the atomic ledger first; if the redemption row can't be written the
// debit is reversed. Staff preview only; members keep /api/portal/redemptions.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await inRewardsPreview(member.authUserId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!member.loyaltyMember) {
      return NextResponse.json(
        {
          error: 'NOT_A_LOYALTY_MEMBER',
          message: 'Join the loyalty program to redeem rewards.',
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as CreateBody
    const rewardSlug = body.rewardSlug?.trim()
    if (!rewardSlug) {
      return NextResponse.json({ error: 'rewardSlug is required' }, { status: 400 })
    }

    // Server-side reward lookup — never trust client-supplied price.
    const reward = REWARDS.find((r) => r.id === rewardSlug)
    if (!reward) {
      return NextResponse.json({ error: 'Unknown reward' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: freshMember, error: memberErr } = await admin
      .from('loyalty_members')
      .select(`id, points_balance, email, first_name, ${MEMBER_PROGRAM_COLUMNS}`)
      .eq('id', member.loyaltyMember.id)
      .single()

    if (memberErr || !freshMember) {
      console.error('[portal/redemptions POST] Member fetch failed:', memberErr)
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const eligibility = canRedeem(freshMember as unknown as MemberProgramFields)
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: 'NOT_ELIGIBLE', message: INELIGIBLE_MESSAGES[eligibility.reason] },
        { status: 403 }
      )
    }

    // Yearly reward-value cap (calendar year, cancelled excluded), shared with milestone rewards.
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString()
    const [{ data: thisYear }, { data: claimsThisYear }] = await Promise.all([
      admin
        .from('loyalty_redemptions')
        .select('retail_value_cents')
        .eq('member_id', freshMember.id)
        .neq('status', 'cancelled')
        .gte('created_at', yearStart),
      admin
        .from('reward_milestone_claims')
        .select('value_cents')
        .eq('member_id', freshMember.id)
        .neq('status', 'cancelled')
        .gte('created_at', yearStart),
    ])
    const redeemedValue =
      (thisYear || []).reduce((sum, r) => sum + ((r.retail_value_cents as number) || 0), 0) +
      (claimsThisYear || []).reduce((sum, c) => sum + ((c.value_cents as number) || 0), 0)
    if (redeemedValue + reward.retailValueCents > CAPS.ANNUAL_REWARD_VALUE_CENTS) {
      return NextResponse.json(
        {
          error: 'ANNUAL_LIMIT',
          message: `This would go over the yearly reward limit of $${(
            CAPS.ANNUAL_REWARD_VALUE_CENTS / 100
          ).toFixed(0)} in retail value. It resets January 1.`,
        },
        { status: 400 }
      )
    }

    // 1. Debit points atomically (refuses to go below zero).
    let debit
    try {
      debit = await applyPoints(admin, {
        memberId: freshMember.id,
        points: -reward.pointsCost,
        type: 'redemption',
        description: `Redeemed: ${reward.name}`,
      })
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        return NextResponse.json(
          {
            error: 'INSUFFICIENT_POINTS',
            message: `Not enough points. This reward costs ${reward.pointsCost.toLocaleString()}.`,
          },
          { status: 400 }
        )
      }
      throw err
    }

    // 2. Record the redemption (snapshot label, cost, and value so future
    //    catalog edits don't change historical records).
    const { data: redemption, error: redemptionErr } = await admin
      .from('loyalty_redemptions')
      .insert({
        member_id: freshMember.id,
        reward_slug: reward.id,
        reward_label: reward.name,
        points_cost: reward.pointsCost,
        retail_value_cents: reward.retailValueCents,
        ship_state: freshMember.residence_state,
        status: 'pending',
        redeem_transaction_id: debit.transactionId,
      })
      .select('*')
      .single()

    if (redemptionErr || !redemption) {
      console.error('[portal/redemptions POST] Redemption insert failed:', redemptionErr)
      await applyPoints(admin, {
        memberId: freshMember.id,
        points: reward.pointsCost,
        type: 'reversal',
        description: `Reversed: ${reward.name} (redemption could not be saved)`,
      })
      return NextResponse.json(
        { error: 'Failed to create redemption' },
        { status: 500 }
      )
    }

    // 3. Notify staff (best-effort; never fail the redemption on email errors).
    const memberName = (freshMember.first_name as string | null) || freshMember.email
    try {
      await sendAndLogEmail({
        fromAlias: 'loyalty',
        to: 'loyalty@untamedbeverages.com',
        subject: `New redemption: ${memberName} → ${reward.name}`,
        html: `
          <p><strong>${memberName}</strong> (${freshMember.email}) redeemed
          <strong>${reward.name}</strong> for ${reward.pointsCost} points.</p>
          <p>Ships to state: ${freshMember.residence_state}. New balance: ${debit.newBalance} points.</p>
          <p>Redemption ID: ${redemption.id}</p>
          <p>Manage in <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin/loyalty">/admin/loyalty</a>.</p>
        `,
        text: `New redemption: ${memberName} (${freshMember.email}) redeemed ${reward.name} for ${reward.pointsCost} points. Ships to state: ${freshMember.residence_state}. New balance: ${debit.newBalance}. Redemption ID: ${redemption.id}.`,
        loyaltyMemberId: freshMember.id,
      })
    } catch (emailErr) {
      console.warn('[portal/redemptions POST] Staff email failed:', emailErr)
    }

    return NextResponse.json({
      redemption,
      newBalance: debit.newBalance,
    })
  } catch (error) {
    console.error('[portal/redemptions POST] Failed:', error)
    return NextResponse.json({ error: 'Redemption failed' }, { status: 500 })
  }
}
