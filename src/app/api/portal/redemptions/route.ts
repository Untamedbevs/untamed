import { NextRequest, NextResponse } from 'next/server'
import { getSiteOrigin } from '@/lib/email/config'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { REWARDS } from '@/lib/loyalty/constants'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { escapeHtml } from '@/lib/email/render'
import { redeemReward } from '@/lib/rewards/ledger'

export const dynamic = 'force-dynamic'

interface CreateBody {
  rewardSlug?: string
}

// ---------------------------------------------------------------------------
// GET /api/portal/redemptions — last 20 for the current member
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!member.loyaltyMember) {
      return NextResponse.json({ redemptions: [] })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('loyalty_redemptions')
      .select('*')
      .eq('member_id', member.loyaltyMember.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[portal/redemptions GET] Failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ redemptions: data || [] })
  } catch (error) {
    console.error('[portal/redemptions GET] Failed:', error)
    return NextResponse.json(
      { error: 'Failed to load redemptions' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/portal/redemptions — redeem a catalog reward
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Refetch the member with admin client to read the freshest balance.
    const { data: freshMember, error: memberErr } = await admin
      .from('loyalty_members')
      .select('id, points_balance, email, first_name, last_name')
      .eq('id', member.loyaltyMember.id)
      .single()

    if (memberErr || !freshMember) {
      console.error('[portal/redemptions POST] Member fetch failed:', memberErr)
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const currentBalance = freshMember.points_balance ?? 0
    if (currentBalance < reward.pointsCost) {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_POINTS',
          message: `Not enough points. You have ${currentBalance}, this reward costs ${reward.pointsCost}.`,
        },
        { status: 400 }
      )
    }

    // Debit the points and record the redemption in one locked call: it reads
    // the balance under the lock, so it never overwrites a change landing at
    // the same time, and it writes everything or nothing.
    const redeemed = await redeemReward(admin, {
      memberId: freshMember.id,
      rewardSlug: reward.id,
      rewardLabel: reward.name,
      pointsCost: reward.pointsCost,
    })
    if (redeemed === 'insufficient') {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_POINTS',
          message: `Not enough points. This reward costs ${reward.pointsCost}.`,
        },
        { status: 400 }
      )
    }
    const { redemption, newBalance } = redeemed

    // Notify staff (best-effort; never fail the redemption on email errors).
    const memberName =
      [freshMember.first_name, freshMember.last_name].filter(Boolean).join(' ') ||
      freshMember.email
    try {
      await sendAndLogEmail({
        fromAlias: 'loyalty',
        to: 'loyalty@untamedbeverages.com',
        subject: `New redemption: ${memberName} → ${reward.name}`,
        html: `
          <p><strong>${escapeHtml(memberName)}</strong> (${escapeHtml(String(freshMember.email))}) redeemed
          <strong>${escapeHtml(reward.name)}</strong> for ${escapeHtml(String(reward.pointsCost))} points.</p>
          <p>New balance: ${escapeHtml(String(newBalance))} points.</p>
          <p>Redemption ID: ${escapeHtml(String(redemption.id))}</p>
          <p>Manage in <a href="${getSiteOrigin()}/admin/loyalty">/admin/loyalty</a>.</p>
        `,
        text: `New redemption: ${memberName} (${freshMember.email}) redeemed ${reward.name} for ${reward.pointsCost} points. New balance: ${newBalance}. Redemption ID: ${redemption.id}.`,
        loyaltyMemberId: freshMember.id,
      })
    } catch (emailErr) {
      console.warn('[portal/redemptions POST] Staff email failed:', emailErr)
    }

    return NextResponse.json({ redemption, newBalance })
  } catch (error) {
    console.error('[portal/redemptions POST] Failed:', error)
    return NextResponse.json({ error: 'Redemption failed' }, { status: 500 })
  }
}
