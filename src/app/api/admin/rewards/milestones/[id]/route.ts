import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { MILESTONE_COLUMNS, REWARD_ITEM_COLUMNS } from '@/lib/rewards/catalog'
import { parseMilestone } from '@/lib/rewards/admin-input'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/admin/rewards/milestones/[id] — edit any field. Existing claims keep their reward snapshot. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = parseMilestone(await request.json().catch(() => null), 'update')
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!Object.keys(parsed.values).length) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const { data: milestone, error } = await createAdminClient()
    .from('reward_milestones')
    .update(parsed.values)
    .eq('id', id)
    .select(`${MILESTONE_COLUMNS}, reward:reward_items(${REWARD_ITEM_COLUMNS})`)
    .maybeSingle()

  if (error) {
    // 23503: reward_id points at no reward.
    if (error.code === '23503') return NextResponse.json({ error: 'That reward doesn’t exist' }, { status: 400 })
    console.error('[admin/rewards/milestones PATCH] Failed:', error)
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 })
  }
  if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  return NextResponse.json({ milestone })
}

/** DELETE /api/admin/rewards/milestones/[id] — only before anyone claims it (claims restrict the delete). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await createAdminClient().from('reward_milestones').delete().eq('id', id).select('id')

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Members have claimed this milestone. Deactivate it instead.' },
        { status: 409 }
      )
    }
    console.error('[admin/rewards/milestones DELETE] Failed:', error)
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 })
  }
  if (!data.length) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
