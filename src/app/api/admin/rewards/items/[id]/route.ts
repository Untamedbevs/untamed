import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { REWARD_ITEM_COLUMNS } from '@/lib/rewards/catalog'
import { parseRewardItem } from '@/lib/rewards/admin-input'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/admin/rewards/items/[id] — edit any field. Claims keep their own snapshot. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = parseRewardItem(await request.json().catch(() => null), 'update')
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!Object.keys(parsed.values).length) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const { data: item, error } = await createAdminClient()
    .from('reward_items')
    .update(parsed.values)
    .eq('id', id)
    .select(REWARD_ITEM_COLUMNS)
    .maybeSingle()

  if (error) {
    console.error('[admin/rewards/items PATCH] Failed:', error)
    return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 })
  }
  if (!item) return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
  return NextResponse.json({ item })
}

/**
 * DELETE /api/admin/rewards/items/[id] — only for rewards nothing uses yet.
 * The foreign keys would quietly unlink milestones and claims, so check first.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const admin = createAdminClient()
    const [milestones, claims] = await Promise.all([
      admin.from('reward_milestones').select('id', { count: 'exact', head: true }).eq('reward_id', id),
      admin.from('reward_milestone_claims').select('id', { count: 'exact', head: true }).eq('reward_id', id),
    ])
    if (milestones.error) throw milestones.error
    if (claims.error) throw claims.error
    if (milestones.count || claims.count) {
      return NextResponse.json(
        { error: 'A milestone uses this reward or members have claimed it. Deactivate it instead.' },
        { status: 409 }
      )
    }

    const { data, error } = await admin.from('reward_items').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data.length) return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/rewards/items DELETE] Failed:', err)
    return NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 })
  }
}
