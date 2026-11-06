import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMemberDataStaff } from '@/lib/auth/resolve-staff'
import { CLAIM_COLUMNS, type ClaimStatus } from '@/lib/rewards/catalog'
import { notifyMember } from '@/lib/rewards/notify'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  action: z.enum(['fulfill', 'cancel', 'reopen'], 'action must be fulfill, cancel or reopen'),
  note: z.string('note must be text').trim().max(2000, 'Keep the note under 2,000 characters').optional(),
  notifyMember: z.boolean('notifyMember must be true or false').optional(),
})

type Action = z.output<typeof bodySchema>['action']

// The statuses each action can move a claim out of.
const FROM: Record<Action, ClaimStatus[]> = {
  fulfill: ['pending'],
  cancel: ['pending'],
  reopen: ['fulfilled', 'cancelled'],
}

/**
 * PATCH /api/admin/rewards/claims/[id]  { action, note?, notifyMember? }
 * Fulfilling emails the member (with the note, e.g. a gift card code or
 * tracking number) unless notifyMember is false. Cancelling keeps the row:
 * the member can claim the milestone again, which reuses it.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const { action, notifyMember: notify = true } = parsed.data
  const note = parsed.data.note || null

  try {
    const { id } = await params
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const updates =
      action === 'fulfill'
        ? { status: 'fulfilled', staff_note: note, fulfilled_by: staff.id, fulfilled_at: now }
        : action === 'cancel'
          ? { status: 'cancelled', staff_note: note, fulfilled_by: null, fulfilled_at: null }
          : { status: 'pending', fulfilled_by: null, fulfilled_at: null }

    // Only moves the claim if it's still where the reviewer saw it.
    const { data: claim, error } = await admin
      .from('reward_milestone_claims')
      .update(updates)
      .eq('id', id)
      .in('status', FROM[action])
      .select(`${CLAIM_COLUMNS}, member:loyalty_members(id, email, first_name), milestone:reward_milestones(title, points)`)
      .maybeSingle()
    if (error) throw error

    if (!claim) {
      const { data: current } = await admin.from('reward_milestone_claims').select('status').eq('id', id).maybeSingle()
      return current
        ? NextResponse.json({ error: `This claim is already ${current.status}. Refresh to see the latest.` }, { status: 409 })
        : NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    if (action === 'fulfill' && notify) {
      const member = claim.member as unknown as { id: string; email: string; first_name: string | null }
      const milestone = claim.milestone as unknown as { title: string }
      await notifyMember('reward-on-its-way', member, {
        reward_name: claim.reward_name,
        milestone_title: milestone.title,
        note: note ?? '',
      })
    }

    return NextResponse.json({ claim })
  } catch (err) {
    console.error('[admin/rewards/claims PATCH] Failed:', err)
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 })
  }
}
