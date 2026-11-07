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
      .select('*')
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
      // Conditional on 'pending', so a redemption cancelled (and refunded) a
      // moment ago can't also be marked fulfilled.
      const { data: fulfilled, error: updateErr } = await supabase
        .from('loyalty_redemptions')
        .update({
          status: 'fulfilled',
          fulfilled_at: now,
          fulfilled_by: staff.id,
          admin_notes: notes ?? redemption.admin_notes,
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (updateErr) {
        console.error('[admin/loyalty/redemptions PUT] Fulfill failed:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
      if (!fulfilled) {
        return NextResponse.json({ error: 'Already decided' }, { status: 409 })
      }

      return NextResponse.json({ ok: true, status: 'fulfilled' })
    }

    // action === 'cancel': one locked call moves the redemption out of
    // 'pending' and refunds its points, so it is refunded at most once.
    const { data, error: cancelErr } = await supabase.rpc('loyalty_cancel_redemption', {
      p_redemption_id: id,
      p_staff_id: staff.id,
      p_notes: notes ?? null,
    })
    if (cancelErr) {
      console.error('[admin/loyalty/redemptions PUT] Cancel failed:', cancelErr)
      return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { result: string; refunded_points: number; new_balance: number | null }
      | undefined
    if (row?.result !== 'cancelled') {
      return NextResponse.json({ error: `Already ${row?.result ?? 'decided'}` }, { status: 409 })
    }

    return NextResponse.json({
      ok: true,
      status: 'cancelled',
      refundedPoints: row.refunded_points,
      newBalance: row.new_balance,
    })
  } catch (error) {
    console.error('[admin/loyalty/redemptions PUT] Failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
