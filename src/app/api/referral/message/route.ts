import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CUSTOM_MESSAGE_MAX_LENGTH } from '@/lib/referral/constants'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, message } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (typeof message !== 'string' || message.length > CUSTOM_MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${CUSTOM_MESSAGE_MAX_LENGTH} characters or less` },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: participant, error } = await supabase
      .from('referral_participants')
      .update({ custom_message: message })
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .select()
      .single()

    if (error || !participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, participant })
  } catch {
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }
}
