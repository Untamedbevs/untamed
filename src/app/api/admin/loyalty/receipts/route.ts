import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POINTS } from '@/lib/loyalty/constants'
import { resolveMemberDataStaff } from '@/lib/auth/resolve-staff'

export async function GET(request: NextRequest) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    let query = supabase
      .from('loyalty_receipts')
      .select('*, member:loyalty_members(id, email, first_name, points_balance)')
      .order('created_at', { ascending: true })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ receipts: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to load receipts' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { receiptId, action, notes, customPoints } = await request.json()

    if (!receiptId || !action) {
      return NextResponse.json(
        { error: 'receiptId and action are required' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }
    if (
      customPoints !== undefined &&
      customPoints !== null &&
      !(Number.isInteger(customPoints) && customPoints >= 0)
    ) {
      return NextResponse.json(
        { error: 'customPoints must be a whole number, 0 or more' },
        { status: 400 }
      )
    }

    const { data: receipt } = await supabase
      .from('loyalty_receipts')
      .select('*')
      .eq('id', receiptId)
      .single()

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    if (receipt.status !== 'pending') {
      return NextResponse.json({ error: 'Receipt already reviewed' }, { status: 400 })
    }

    // Default points: sum of self-declared pack quantities × per-receipt rate.
    // Falls back to the flat per-receipt rate when no items were claimed
    // (legacy single-image uploads).
    const claimedItems = Array.isArray(receipt.claimed_items)
      ? (receipt.claimed_items as { drinkSlug: string; quantity: number }[])
      : []
    const totalUnits = claimedItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    )
    const defaultPoints =
      totalUnits > 0 ? totalUnits * POINTS.PER_RECEIPT : POINTS.PER_RECEIPT

    const pointsToAward =
      action === 'approve'
        ? typeof customPoints === 'number'
          ? customPoints
          : defaultPoints
        : 0

    // One locked call: only a pending receipt changes, and the status and the
    // points are written together, so two reviewers can't both credit it.
    const { data, error } = await supabase.rpc('loyalty_review_receipt', {
      p_receipt_id: receiptId,
      p_approve: action === 'approve',
      p_points: pointsToAward,
      p_notes: notes || null,
      p_staff_id: staff.id,
    })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as
      | { result: string; awarded: number }
      | undefined
    if (row?.result === 'already_reviewed') {
      return NextResponse.json({ error: 'Receipt already reviewed' }, { status: 409 })
    }
    if (row?.result !== 'approved' && row?.result !== 'rejected') {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, pointsAwarded: pointsToAward })
  } catch {
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
