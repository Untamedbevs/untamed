import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/resolve-member'
import { CUSTOM_MESSAGE_MAX_LENGTH } from '@/lib/referral/constants'

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
  const message = typeof body?.message === 'string' ? body.message : null
  if (message === null) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  if (message.length > CUSTOM_MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: `Message must be ${CUSTOM_MESSAGE_MAX_LENGTH} characters or less`,
      },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: participant, error } = await supabase
    .from('referral_participants')
    .update({ custom_message: message })
    .eq('loyalty_member_id', member.loyaltyMember.id)
    .eq('is_active', true)
    .select()
    .single()

  if (error || !participant) {
    return NextResponse.json(
      { error: 'Participant not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, participant })
}
