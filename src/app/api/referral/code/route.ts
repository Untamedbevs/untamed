import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidReferralCode } from '@/lib/referral/helpers'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, newCode } = body

    if (!email || !newCode) {
      return NextResponse.json({ error: 'email and newCode are required' }, { status: 400 })
    }

    const normalizedCode = newCode.toLowerCase().trim()
    const validation = isValidReferralCode(normalizedCode)

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: participant } = await supabase
      .from('referral_participants')
      .select('id, referral_code')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    if (participant.referral_code === normalizedCode) {
      return NextResponse.json({ error: 'New code is the same as current code' }, { status: 400 })
    }

    // Check uniqueness against active codes and history
    const { data: codeExists } = await supabase
      .from('referral_participants')
      .select('id')
      .eq('referral_code', normalizedCode)
      .maybeSingle()

    if (codeExists) {
      return NextResponse.json({ error: 'This code is already taken' }, { status: 409 })
    }

    const { data: historyExists } = await supabase
      .from('referral_code_history')
      .select('id')
      .eq('old_code', normalizedCode)
      .maybeSingle()

    if (historyExists) {
      return NextResponse.json({ error: 'This code is already taken' }, { status: 409 })
    }

    // Save old code to history
    await supabase.from('referral_code_history').insert({
      participant_id: participant.id,
      old_code: participant.referral_code,
    })

    // Update to new code
    const { data: updated, error } = await supabase
      .from('referral_participants')
      .update({ referral_code: normalizedCode })
      .eq('id', participant.id)
      .select()
      .single()

    if (error) throw error

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    return NextResponse.json({
      participant: updated,
      consumerLink: `${siteUrl}/?ref=${normalizedCode}`,
      distributorLink: `${siteUrl}/distribute?ref=${normalizedCode}`,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update code' }, { status: 500 })
  }
}
