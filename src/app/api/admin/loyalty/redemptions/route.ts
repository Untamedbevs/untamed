import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'

export const dynamic = 'force-dynamic'

function isLimitedContractor(role: string | undefined): boolean {
  return role === 'contractor_limited'
}

// ---------------------------------------------------------------------------
// GET /api/admin/loyalty/redemptions?status=all|pending|fulfilled|cancelled
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (isLimitedContractor(staff.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    let query = supabase
      .from('loyalty_redemptions')
      .select('*, member:loyalty_members(id, email, first_name, points_balance)')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      console.error('[admin/loyalty/redemptions GET] Failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ redemptions: data || [] })
  } catch (error) {
    console.error('[admin/loyalty/redemptions GET] Failed:', error)
    return NextResponse.json(
      { error: 'Failed to load redemptions' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/loyalty/redemptions
//   { id, action: 'fulfill' | 'cancel', notes? }
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (isLimitedContractor(staff.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { id, action, notes } = body as {
      id?: string
      action?: 'fulfill' | 'cancel'
      notes?: string
    }

    if (!id || !action) {
      return NextResponse.json(
        { error: 'id and action are required' },
        { status: 400 }
      )
    }
    if (action !== 'fulfill' && action !== 'cancel') {
      return NextResponse.json(
        { error: 'action must be fulfill or cancel' },
        { status: 400 }
      )
    }

    const { data: redemption } = await supabase
      .from('loyalty_redemptions')
      .select('*, member:loyalty_members(id, points_balance)')
      .eq('id', id)
      .maybeSingle()

    if (!redemption) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (redemption.status !== 'pending') {
      return NextResponse.json(
        { error: `Already ${redemption.status}` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    if (action === 'fulfill') {
      const { error: updateErr } = await supabase
        .from('loyalty_redemptions')
        .update({
          status: 'fulfilled',
          fulfilled_at: now,
          fulfilled_by: staff.id,
          admin_notes: notes ?? redemption.admin_notes,
        })
        .eq('id', id)

      if (updateErr) {
        console.error('[admin/loyalty/redemptions PUT] Fulfill failed:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, status: 'fulfilled' })
    }

    // action === 'cancel' — refund the points
    const member = redemption.member as { id: string; points_balance: number } | null
    if (!member) {
      return NextResponse.json({ error: 'Member missing' }, { status: 500 })
    }

    const { data: refundTxn, error: txnErr } = await supabase
      .from('loyalty_transactions')
      .insert({
        member_id: member.id,
        points: redemption.points_cost,
        type: 'adjustment',
        description: `Refund for cancelled redemption: ${redemption.reward_label}`,
        created_by_staff_id: staff.id,
      })
      .select('id')
      .single()

    if (txnErr || !refundTxn) {
      console.error('[admin/loyalty/redemptions PUT] Refund txn failed:', txnErr)
      return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
    }

    const newBalance = (member.points_balance ?? 0) + redemption.points_cost
    const { error: balErr } = await supabase
      .from('loyalty_members')
      .update({ points_balance: newBalance })
      .eq('id', member.id)

    if (balErr) {
      console.error('[admin/loyalty/redemptions PUT] Balance refund failed:', balErr)
      // Roll back the refund txn
      await supabase.from('loyalty_transactions').delete().eq('id', refundTxn.id)
      return NextResponse.json({ error: balErr.message }, { status: 500 })
    }

    const { error: cancelErr } = await supabase
      .from('loyalty_redemptions')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        admin_notes: notes ?? redemption.admin_notes,
        refund_transaction_id: refundTxn.id,
        fulfilled_by: staff.id,
      })
      .eq('id', id)

    if (cancelErr) {
      console.error('[admin/loyalty/redemptions PUT] Cancel update failed:', cancelErr)
      return NextResponse.json({ error: cancelErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      status: 'cancelled',
      refundedPoints: redemption.points_cost,
      newBalance,
    })
  } catch (error) {
    console.error('[admin/loyalty/redemptions PUT] Failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
