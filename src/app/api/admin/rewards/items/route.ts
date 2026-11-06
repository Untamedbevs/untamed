import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { REWARD_ITEM_COLUMNS, type RewardItem } from '@/lib/rewards/catalog'
import { parseRewardItem } from '@/lib/rewards/admin-input'

export const dynamic = 'force-dynamic'

/** GET /api/admin/rewards/items — the whole catalog, inactive items too, with how much each is used. */
export async function GET() {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('reward_items')
      .select(REWARD_ITEM_COLUMNS)
      .order('created_at', { ascending: false })
    if (error) throw error

    const items = await Promise.all(
      ((data || []) as RewardItem[]).map(async (item) => {
        const [milestones, claims] = await Promise.all([
          admin.from('reward_milestones').select('id', { count: 'exact', head: true }).eq('reward_id', item.id),
          admin.from('reward_milestone_claims').select('id', { count: 'exact', head: true }).eq('reward_id', item.id),
        ])
        if (milestones.error) throw milestones.error
        if (claims.error) throw claims.error
        return { ...item, milestone_count: milestones.count ?? 0, claim_count: claims.count ?? 0 }
      })
    )

    return NextResponse.json({ items })
  } catch (err) {
    console.error('[admin/rewards/items GET] Failed:', err)
    return NextResponse.json({ error: 'Failed to load rewards' }, { status: 500 })
  }
}

/** POST /api/admin/rewards/items — add a reward to the catalog. */
export async function POST(request: NextRequest) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseRewardItem(await request.json().catch(() => null), 'create')
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data: item, error } = await createAdminClient()
    .from('reward_items')
    .insert({ ...parsed.values, created_by: staff.id })
    .select(REWARD_ITEM_COLUMNS)
    .single()

  if (error) {
    console.error('[admin/rewards/items POST] Failed:', error)
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 })
  }
  return NextResponse.json({ item: { ...item, milestone_count: 0, claim_count: 0 } })
}
