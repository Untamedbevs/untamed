import { NextRequest, NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { REWARDS } from '@/lib/loyalty/constants'
import { sendAndLogEmail } from '@/lib/messaging/email-log'

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

    const newBalance = currentBalance - reward.pointsCost

    // 1. Insert the redemption row first (snapshot label + cost so future
    //    catalog edits don't change historical records).
    const { data: redemption, error: redemptionErr } = await admin
      .from('loyalty_redemptions')
      .insert({
        member_id: freshMember.id,
        reward_slug: reward.id,
        reward_label: reward.name,
        points_cost: reward.pointsCost,
        status: 'pending',
      })
      .select('*')
      .single()

    if (redemptionErr || !redemption) {
      console.error('[portal/redemptions POST] Redemption insert failed:', redemptionErr)
      return NextResponse.json(
        { error: 'Failed to create redemption' },
        { status: 500 }
      )
    }

    // 2. Insert the ledger entry.
    const { data: txn, error: txnErr } = await admin
      .from('loyalty_transactions')
      .insert({
        member_id: freshMember.id,
        points: -reward.pointsCost,
        type: 'redemption',
        description: `Redeemed: ${reward.name}`,
      })
      .select('id')
      .single()

    if (txnErr || !txn) {
      console.error('[portal/redemptions POST] Transaction insert failed:', txnErr)
      // Roll back the redemption row so we don't leave it dangling.
      await admin.from('loyalty_redemptions').delete().eq('id', redemption.id)
      return NextResponse.json(
        { error: 'Failed to record transaction' },
        { status: 500 }
      )
    }

    // 3. Race-guarded balance update: only succeed if balance is what we read.
    const { data: updatedMember, error: balErr } = await admin
      .from('loyalty_members')
      .update({ points_balance: newBalance })
      .eq('id', freshMember.id)
      .eq('points_balance', currentBalance)
      .select('points_balance')
      .single()

    if (balErr || !updatedMember) {
      console.error(
        '[portal/redemptions POST] Balance update failed (race):',
        balErr
      )
      // Roll back: delete txn and redemption rows.
      await admin.from('loyalty_transactions').delete().eq('id', txn.id)
      await admin.from('loyalty_redemptions').delete().eq('id', redemption.id)
      return NextResponse.json(
        {
          error: 'BALANCE_RACE',
          message:
            'Your balance changed during this redemption. Refresh and try again.',
        },
        { status: 409 }
      )
    }

    // 4. Link the redemption to the transaction for traceability.
    await admin
      .from('loyalty_redemptions')
      .update({ redeem_transaction_id: txn.id })
      .eq('id', redemption.id)

    // 5. Notify staff (best-effort; never fail the redemption on email errors).
    const memberName =
      [freshMember.first_name, freshMember.last_name].filter(Boolean).join(' ') ||
      freshMember.email
    try {
      await sendAndLogEmail({
        fromAlias: 'loyalty',
        to: 'loyalty@untamedbeverages.com',
        subject: `New redemption: ${memberName} → ${reward.name}`,
        html: `
          <p><strong>${memberName}</strong> (${freshMember.email}) redeemed
          <strong>${reward.name}</strong> for ${reward.pointsCost} points.</p>
          <p>New balance: ${updatedMember.points_balance} points.</p>
          <p>Redemption ID: ${redemption.id}</p>
          <p>Manage in <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin/loyalty">/admin/loyalty</a>.</p>
        `,
        text: `New redemption: ${memberName} (${freshMember.email}) redeemed ${reward.name} for ${reward.pointsCost} points. New balance: ${updatedMember.points_balance}. Redemption ID: ${redemption.id}.`,
        loyaltyMemberId: freshMember.id,
      })
    } catch (emailErr) {
      console.warn('[portal/redemptions POST] Staff email failed:', emailErr)
    }

    return NextResponse.json({
      redemption: { ...redemption, redeem_transaction_id: txn.id },
      newBalance: updatedMember.points_balance,
    })
  } catch (error) {
    console.error('[portal/redemptions POST] Failed:', error)
    return NextResponse.json({ error: 'Redemption failed' }, { status: 500 })
  }
}
