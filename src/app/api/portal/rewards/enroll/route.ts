import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { enrollMember, type EnrollmentError } from '@/lib/rewards/enrollment'
import { inRewardsPreview } from '@/lib/rewards/preview'
import { isSpiritAnimal } from '@/lib/rewards/spirit-animals'

export const dynamic = 'force-dynamic'

const ERROR_RESPONSES: Record<EnrollmentError, { status: number; message: string }> = {
  invalid_birthdate: { status: 400, message: 'Enter your full date of birth.' },
  under_age: {
    status: 403,
    message:
      'Pack Rewards is only open to adults 21 and older. If you entered your birthdate by mistake, email loyalty@untamedbeverages.com.',
  },
  invalid_state: { status: 400, message: 'Choose the US state you live in.' },
  state_not_eligible: { status: 403, message: 'Pack Rewards is not available in your state yet.' },
  attestations_required: {
    status: 400,
    message: 'Please confirm each statement to join Pack Rewards.',
  },
  trade_account: {
    status: 403,
    message:
      'This email is connected to an alcohol retailer, bar, restaurant, or distributor, so it cannot earn rewards. If that is a mistake, email loyalty@untamedbeverages.com.',
  },
  account_closed: {
    status: 403,
    message: 'This rewards account is closed or on hold. Email loyalty@untamedbeverages.com.',
  },
  member_not_found: { status: 404, message: 'We could not find your membership.' },
}

/**
 * POST /api/portal/rewards/enroll
 *   { birthdate: "YYYY-MM-DD", residenceState: "FL",
 *     attestations: { ofAge, notTrade, acceptsRules, disclosesReferrals },
 *     spiritAnimal?: "cheetah" }
 *
 * Enrolls the signed-in member in Pack Rewards (or re-confirms eligibility
 * after a rules change or the yearly check). The optional spirit animal from
 * onboarding is saved as their favorite drink and themes their pass.
 */
export async function POST(request: NextRequest) {
  let member
  try {
    member = await requireMember()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await inRewardsPreview(member.authUserId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!member.loyaltyMember) {
    return NextResponse.json({ error: 'NOT_A_LOYALTY_MEMBER' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null

  try {
    const admin = createAdminClient()
    const result = await enrollMember(admin, {
      memberId: member.loyaltyMember.id,
      authUserId: member.authUserId,
      birthdate: body.birthdate,
      residenceState: body.residenceState,
      attestations: typeof body.attestations === 'object' && body.attestations ? body.attestations : {},
      ipHash,
      userAgent: request.headers.get('user-agent'),
    })

    if (!result.ok) {
      const { status, message } = ERROR_RESPONSES[result.error]
      return NextResponse.json({ error: result.error, message }, { status })
    }

    if (isSpiritAnimal(body.spiritAnimal)) {
      await admin
        .from('loyalty_members')
        .update({ favorite_drink_slug: body.spiritAnimal })
        .eq('id', member.loyaltyMember.id)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[portal/rewards/enroll] Failed:', error)
    return NextResponse.json(
      { error: 'ENROLLMENT_FAILED', message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
