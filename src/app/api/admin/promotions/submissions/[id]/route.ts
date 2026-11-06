import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMemberDataStaff } from '@/lib/auth/resolve-staff'
import { applyPoints } from '@/lib/rewards/ledger'
import { notifyMember } from '@/lib/rewards/notify'
import { canEarn, INELIGIBLE_MESSAGES, MEMBER_PROGRAM_COLUMNS, type MemberProgramFields } from '@/lib/rewards/eligibility'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  action: z.enum(['approve', 'reject'], 'action must be approve or reject'),
  note: z.string('note must be text').trim().max(2000, 'Keep the note under 2,000 characters').optional(),
  points: z
    .number('Points must be a number')
    .int('Points must be a whole number')
    .min(1, 'Points must be at least 1')
    .max(100_000, 'Points can be at most 100,000')
    .optional(),
})

/**
 * PATCH /api/admin/promotions/submissions/[id]  { action, note?, points? }
 * Approving credits the Hunt's points (or the reviewer's override) through the
 * ledger; rejecting needs a note telling the member what to fix. Either way
 * the member gets an email.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const { action } = parsed.data
  const note = parsed.data.note || ''
  if (action === 'reject' && note.length < 3) {
    return NextResponse.json({ error: 'Add a note so the member knows what to change' }, { status: 400 })
  }

  const { id } = await params
  const admin = createAdminClient()
  const { data: submission, error: loadError } = await admin
    .from('promotion_submissions')
    .select(`id, member_id, promotion:promotions(title, points), member:loyalty_members(id, email, first_name, ${MEMBER_PROGRAM_COLUMNS})`)
    .eq('id', id)
    .maybeSingle()
  if (loadError) {
    console.error('[admin/promotions/submissions PATCH] Load failed:', loadError)
    return NextResponse.json({ error: 'Failed to load submission' }, { status: 500 })
  }
  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  const promotion = submission.promotion as unknown as { title: string; points: number }
  const member = submission.member as unknown as { id: string; email: string; first_name: string | null }
  const points = action === 'approve' ? (parsed.data.points ?? promotion.points) : 0
  if (action === 'approve' && points > 100_000) {
    return NextResponse.json({ error: 'Points can be at most 100,000' }, { status: 400 })
  }
  // A member can lose eligibility after submitting (suspended, trade account, enrollment lapsed).
  if (action === 'approve') {
    const eligibility = canEarn(member as unknown as MemberProgramFields, 'engagement')
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: `This member can’t earn points right now: ${INELIGIBLE_MESSAGES[eligibility.reason]} Reject it with a note instead.` },
        { status: 409 }
      )
    }
  }

  // Claim the submission: only one reviewer can move it out of pending.
  const { data: claimed, error: claimError } = await admin
    .from('promotion_submissions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: staff.id,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
      points_awarded: points,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (claimError) {
    console.error('[admin/promotions/submissions PATCH] Claim failed:', claimError)
    return NextResponse.json({ error: 'Failed to review submission' }, { status: 500 })
  }
  if (!claimed) {
    return NextResponse.json({ error: 'This submission was already reviewed. Refresh to see the latest.' }, { status: 409 })
  }

  if (action === 'reject') {
    await notifyMember('hunt-needs-changes', member, { hunt_title: promotion.title, note })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  const credit = await applyPoints(admin, {
    memberId: submission.member_id,
    points,
    type: 'promotion',
    description: `Hunt approved: ${promotion.title}`,
    staffId: staff.id,
  }).catch((err: unknown) => {
    console.error('[admin/promotions/submissions PATCH] Points failed, returning to queue:', err)
    return null
  })
  if (!credit) {
    await admin
      .from('promotion_submissions')
      .update({ status: 'pending', points_awarded: 0, reviewed_by: null, reviewed_at: null, review_note: null })
      .eq('id', id)
    return NextResponse.json(
      { error: 'Couldn’t add the points, so the submission is back in the queue. Try again.' },
      { status: 500 }
    )
  }

  // The points are in either way; a failed link only loses the pointer to the ledger row.
  const { error: linkError } = await admin
    .from('promotion_submissions')
    .update({ transaction_id: credit.transactionId })
    .eq('id', id)
  if (linkError) console.error('[admin/promotions/submissions PATCH] Transaction link failed:', linkError)

  await notifyMember('hunt-approved', member, {
    hunt_title: promotion.title,
    points: points.toLocaleString('en-US'),
    note,
  })
  return NextResponse.json({ ok: true, status: 'approved' })
}
