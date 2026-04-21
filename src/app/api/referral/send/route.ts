import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WARM_INTRO_DAILY_LIMIT } from '@/lib/referral/constants'
import type { InviteType } from '@/lib/referral/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, referredEmail, referredName, inviteType } = body

    if (!email || !referredEmail) {
      return NextResponse.json(
        { error: 'email and referredEmail are required' },
        { status: 400 }
      )
    }

    if (inviteType !== 'consumer' && inviteType !== 'distributor') {
      return NextResponse.json(
        { error: 'inviteType must be "consumer" or "distributor"' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()
    const normalizedReferred = referredEmail.toLowerCase().trim()

    // Find participant
    const { data: participant } = await supabase
      .from('referral_participants')
      .select('id, display_name, referral_code')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    // Rate limit: max N sends per day
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('referral_invites')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', participant.id)
      .gte('sent_at', todayStart.toISOString())

    if ((count || 0) >= WARM_INTRO_DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Daily limit of ${WARM_INTRO_DAILY_LIMIT} warm intros reached` },
        { status: 429 }
      )
    }

    // Check for duplicate invite
    const { data: existing } = await supabase
      .from('referral_invites')
      .select('id')
      .eq('participant_id', participant.id)
      .eq('referred_email', normalizedReferred)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'You already sent an invite to this email' },
        { status: 409 }
      )
    }

    // Insert invite
    const { data: invite, error: inviteError } = await supabase
      .from('referral_invites')
      .insert({
        participant_id: participant.id,
        referred_email: normalizedReferred,
        referred_name: referredName?.trim() || null,
        invite_type: inviteType as InviteType,
      })
      .select()
      .single()

    if (inviteError) throw inviteError

    // Log event
    await supabase.from('referral_events').insert({
      participant_id: participant.id,
      event_type: 'referral_sent',
      referred_email: normalizedReferred,
      metadata: {
        invite_type: inviteType,
        referred_name: referredName?.trim() || null,
      },
    })

    // In a production setup, this is where you'd send the actual email
    // via a transactional email service (Resend, SendGrid, etc.)
    // For now, the invite is tracked and ready for email integration.

    return NextResponse.json({ success: true, invite })
  } catch {
    return NextResponse.json({ error: 'Failed to send warm intro' }, { status: 500 })
  }
}
