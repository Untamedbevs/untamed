import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { MILESTONE_COLUMNS, REWARD_ITEM_COLUMNS, loadMilestones } from '@/lib/rewards/catalog'
import { parseMilestone } from '@/lib/rewards/admin-input'

export const dynamic = 'force-dynamic'

/** GET /api/admin/rewards/milestones — every milestone, lowest first, with its reward and claim count. */
export async function GET() {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const milestones = await Promise.all(
      (await loadMilestones(admin, { includeInactive: true })).map(async (m) => {
        const { count, error } = await admin
          .from('reward_milestone_claims')
          .select('id', { count: 'exact', head: true })
          .eq('milestone_id', m.id)
        if (error) throw error
        return { ...m, claim_count: count ?? 0 }
      })
    )
    return NextResponse.json({ milestones })
  } catch (err) {
    console.error('[admin/rewards/milestones GET] Failed:', err)
    return NextResponse.json({ error: 'Failed to load milestones' }, { status: 500 })
  }
}

/** POST /api/admin/rewards/milestones — add a marker to the trail. */
export async function POST(request: NextRequest) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseMilestone(await request.json().catch(() => null), 'create')
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data: milestone, error } = await createAdminClient()
    .from('reward_milestones')
    .insert({ ...parsed.values, created_by: staff.id })
    .select(`${MILESTONE_COLUMNS}, reward:reward_items(${REWARD_ITEM_COLUMNS})`)
    .single()

  if (error) {
    // 23503: reward_id points at no reward.
    if (error.code === '23503') return NextResponse.json({ error: 'That reward doesn’t exist' }, { status: 400 })
    console.error('[admin/rewards/milestones POST] Failed:', error)
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 })
  }
  return NextResponse.json({ milestone: { ...milestone, claim_count: 0 } })
}
