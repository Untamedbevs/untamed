import { NextRequest, NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { canEarn, INELIGIBLE_MESSAGES, MEMBER_PROGRAM_COLUMNS, type MemberProgramFields } from '@/lib/rewards/eligibility'
import { inRewardsPreview } from '@/lib/rewards/preview'
import { PROMOTION_COLUMNS, SUBMISSION_COLUMNS, promotionWindow, proofProblem, type Promotion } from '@/lib/rewards/catalog'

export const dynamic = 'force-dynamic'

/**
 * POST /api/portal/hunts/submit
 *   { promotionId, proofUrl?, proofImageKey?, proofText?, confirmed: string[] }
 *
 * Sends a member's proof for a Hunt to the staff review queue. Points arrive
 * only when staff approve it.
 */
export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member?.loyaltyMember) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await inRewardsPreview(member.authUserId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const admin = createAdminClient()

    const { data: fresh } = await admin
      .from('loyalty_members')
      .select(`id, ${MEMBER_PROGRAM_COLUMNS}`)
      .eq('id', member.loyaltyMember.id)
      .single()
    const eligibility = canEarn(fresh as unknown as MemberProgramFields, 'engagement')
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: 'NOT_ELIGIBLE', message: INELIGIBLE_MESSAGES[eligibility.reason] },
        { status: 403 }
      )
    }

    const { data } = await admin
      .from('promotions')
      .select(PROMOTION_COLUMNS)
      .eq('id', typeof body.promotionId === 'string' ? body.promotionId : '')
      .eq('is_active', true)
      .maybeSingle()
    const promotion = data as unknown as Promotion | null
    if (!promotion) return NextResponse.json({ error: 'NOT_FOUND', message: 'That Hunt isn’t running.' }, { status: 404 })
    const window = promotionWindow(promotion)
    if (window !== 'open') {
      return NextResponse.json(
        { error: 'CLOSED', message: window === 'upcoming' ? 'This Hunt hasn’t started yet.' : 'This Hunt has ended.' },
        { status: 400 }
      )
    }

    const proof = {
      url: typeof body.proofUrl === 'string' ? body.proofUrl.trim() : '',
      imageKey: typeof body.proofImageKey === 'string' ? body.proofImageKey.trim() : '',
      text: typeof body.proofText === 'string' ? body.proofText.trim() : '',
    }
    const problem = proofProblem(promotion, proof)
    if (problem) return NextResponse.json({ error: 'INVALID_PROOF', message: problem }, { status: 400 })
    // Screenshots must be this member's own upload.
    if (proof.imageKey && !proof.imageKey.startsWith(`user-uploads/${member.authUserId}/promotions/proofs/`)) {
      return NextResponse.json({ error: 'INVALID_PROOF', message: 'Upload the screenshot again.' }, { status: 400 })
    }

    const confirmed = new Set(Array.isArray(body.confirmed) ? body.confirmed : [])
    if (!promotion.requirements.every((r) => confirmed.has(r))) {
      return NextResponse.json(
        { error: 'RULES_REQUIRED', message: 'Confirm each rule before you submit.' },
        { status: 400 }
      )
    }

    const { count } = await admin
      .from('promotion_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', fresh!.id)
      .eq('promotion_id', promotion.id)
      .neq('status', 'rejected')
    if ((count || 0) >= promotion.max_per_member) {
      return NextResponse.json(
        {
          error: 'LIMIT_REACHED',
          message:
            promotion.max_per_member === 1
              ? 'You’ve already sent proof for this Hunt.'
              : `You can complete this Hunt ${promotion.max_per_member} times.`,
        },
        { status: 409 }
      )
    }

    const { data: submission, error } = await admin
      .from('promotion_submissions')
      .insert({
        promotion_id: promotion.id,
        member_id: fresh!.id,
        proof_url: proof.url || null,
        proof_image_key: proof.imageKey || null,
        proof_text: proof.text || null,
        attestations: promotion.requirements,
      })
      .select(SUBMISSION_COLUMNS)
      .single()
    if (error) throw error

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('[portal/hunts/submit] Failed:', error)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
