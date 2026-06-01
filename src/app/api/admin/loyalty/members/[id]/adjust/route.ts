import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'

export const dynamic = 'force-dynamic'

const MAX_DELTA = 100_000

interface AdjustBody {
  delta?: number
  note?: string
}

/**
 * POST /api/admin/loyalty/members/[id]/adjust
 *   { delta: number (positive or negative), note: string }
 *
 * Inserts a loyalty_transactions row (type='adjustment') and updates the
 * member's points_balance. Race-guarded by a balance equality check; if two
 * staff adjust simultaneously the second one fails with 409 and rolls back
 * the transaction row so the ledger stays consistent.
 *
 * Restricted to non-limited staff (role <> 'contractor_limited').
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (staff.role === 'contractor_limited') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'member id required' }, { status: 400 })
    }

    const body = (await request.json()) as AdjustBody
    const delta = Math.trunc(Number(body.delta))
    const note = (body.note || '').trim()

    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json(
        { error: 'delta must be a non-zero integer' },
        { status: 400 }
      )
    }
    if (Math.abs(delta) > MAX_DELTA) {
      return NextResponse.json(
        { error: `delta exceeds max (\u00b1${MAX_DELTA})` },
        { status: 400 }
      )
    }
    if (!note) {
      return NextResponse.json(
        { error: 'note is required so the adjustment is auditable' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: member, error: memberErr } = await supabase
      .from('loyalty_members')
      .select('id, points_balance, email, first_name')
      .eq('id', id)
      .maybeSingle()

    if (memberErr) {
      console.error('[admin/loyalty/members/adjust] member fetch failed:', memberErr)
      return NextResponse.json({ error: memberErr.message }, { status: 500 })
    }
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const currentBalance = member.points_balance ?? 0
    const newBalance = currentBalance + delta
    if (newBalance < 0) {
      return NextResponse.json(
        {
          error: `Adjustment would put balance below zero (current ${currentBalance}, delta ${delta}).`,
        },
        { status: 400 }
      )
    }

    const { data: txn, error: txnErr } = await supabase
      .from('loyalty_transactions')
      .insert({
        member_id: member.id,
        points: delta,
        type: 'adjustment',
        description: note,
        created_by_staff_id: staff.id,
      })
      .select('id')
      .single()

    if (txnErr || !txn) {
      console.error('[admin/loyalty/members/adjust] txn insert failed:', txnErr)
      return NextResponse.json(
        { error: txnErr?.message || 'Failed to record transaction' },
        { status: 500 }
      )
    }

    const { data: updated, error: balErr } = await supabase
      .from('loyalty_members')
      .update({ points_balance: newBalance })
      .eq('id', member.id)
      .eq('points_balance', currentBalance)
      .select('id, points_balance')
      .single()

    if (balErr || !updated) {
      console.error('[admin/loyalty/members/adjust] balance race:', balErr)
      await supabase.from('loyalty_transactions').delete().eq('id', txn.id)
      return NextResponse.json(
        {
          error: 'BALANCE_RACE',
          message:
            'Member balance changed during this adjustment. Reload the members list and try again.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      ok: true,
      transactionId: txn.id,
      delta,
      newBalance: updated.points_balance,
    })
  } catch (error) {
    console.error('[admin/loyalty/members/adjust] Failed:', error)
    return NextResponse.json({ error: 'Adjustment failed' }, { status: 500 })
  }
}
