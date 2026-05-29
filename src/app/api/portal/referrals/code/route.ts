import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/resolve-member'
import { buildShareLinks, isValidReferralCode } from '@/lib/referral/helpers'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  let member
  try {
    member = await requireMember()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!member.loyaltyMember) {
    return NextResponse.json(
      { error: 'NOT_A_LOYALTY_MEMBER' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const newCode = typeof body?.newCode === 'string' ? body.newCode : null
  if (!newCode) {
    return NextResponse.json({ error: 'newCode is required' }, { status: 400 })
  }

  const normalizedCode = newCode.toLowerCase().trim()
  const validation = isValidReferralCode(normalizedCode)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: participant } = await supabase
    .from('referral_participants')
    .select('id, referral_code')
    .eq('loyalty_member_id', member.loyaltyMember.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!participant) {
    return NextResponse.json(
      { error: 'Participant not found' },
      { status: 404 }
    )
  }

  if (participant.referral_code === normalizedCode) {
    return NextResponse.json(
      { error: 'New code is the same as current code' },
      { status: 400 }
    )
  }

  const { data: codeExists } = await supabase
    .from('referral_participants')
    .select('id')
    .eq('referral_code', normalizedCode)
    .maybeSingle()
  if (codeExists) {
    return NextResponse.json(
      { error: 'This code is already taken' },
      { status: 409 }
    )
  }

  const { data: historyExists } = await supabase
    .from('referral_code_history')
    .select('id')
    .eq('old_code', normalizedCode)
    .maybeSingle()
  if (historyExists) {
    return NextResponse.json(
      { error: 'This code is already taken' },
      { status: 409 }
    )
  }

  await supabase.from('referral_code_history').insert({
    participant_id: participant.id,
    old_code: participant.referral_code,
  })

  const { data: updated, error } = await supabase
    .from('referral_participants')
    .update({ referral_code: normalizedCode })
    .eq('id', participant.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json(
      { error: 'Failed to update code' },
      { status: 500 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  const { consumerLink, distributorLink } = buildShareLinks(
    siteUrl,
    normalizedCode
  )

  return NextResponse.json({
    participant: updated,
    consumerLink,
    distributorLink,
  })
}
