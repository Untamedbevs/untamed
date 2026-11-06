import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMemberDataStaff } from '@/lib/auth/resolve-staff'
import { CLAIM_COLUMNS, type ClaimStatus } from '@/lib/rewards/catalog'

export const dynamic = 'force-dynamic'

const STATUSES: ClaimStatus[] = ['pending', 'fulfilled', 'cancelled']

/**
 * GET /api/admin/rewards/claims?status=pending|fulfilled|cancelled|all
 * The fulfillment queue: pending oldest first, everything else newest first.
 */
export async function GET(request: NextRequest) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') || 'pending'
  if (status !== 'all' && !STATUSES.includes(status as ClaimStatus)) {
    return NextResponse.json({ error: 'status must be pending, fulfilled, cancelled or all' }, { status: 400 })
  }

  let query = createAdminClient()
    .from('reward_milestone_claims')
    .select(`${CLAIM_COLUMNS}, member:loyalty_members(email, first_name), milestone:reward_milestones(title, points)`)
    .order('created_at', { ascending: status === 'pending' })
    .limit(500)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[admin/rewards/claims GET] Failed:', error)
    return NextResponse.json({ error: 'Failed to load claims' }, { status: 500 })
  }
  return NextResponse.json({ claims: data || [] })
}
