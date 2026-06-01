import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POINTS } from '@/lib/loyalty/constants'

export async function GET(request: NextRequest) {
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

    const { data: receipt } = await supabase
      .from('loyalty_receipts')
      .select('*, member:loyalty_members(id, email, points_balance)')
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

    await supabase
      .from('loyalty_receipts')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        points_awarded: pointsToAward,
        admin_notes: notes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', receiptId)

    if (action === 'approve') {
      await supabase.from('loyalty_transactions').insert({
        member_id: receipt.member_id,
        points: pointsToAward,
        type: 'receipt_approved',
        description: `Receipt approved (+${pointsToAward} pts)`,
        receipt_id: receiptId,
      })

      const member = receipt.member as { id: string; points_balance: number } | null
      if (member) {
        await supabase
          .from('loyalty_members')
          .update({ points_balance: member.points_balance + pointsToAward })
          .eq('id', member.id)
      }
    }

    return NextResponse.json({ ok: true, pointsAwarded: pointsToAward })
  } catch {
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
