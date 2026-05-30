import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WARM_INTRO_DAILY_LIMIT } from '@/lib/referral/constants'
import type { InviteType } from '@/lib/referral/types'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { buildListUnsubscribeHeaders, buildUnsubscribeUrl } from '@/lib/messaging/unsubscribe'
import { buildWarmIntroEmail } from '@/lib/referral/warm-intro-email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, referredEmail, referredName, inviteType, customMessage } = body

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

    const { data: participant } = await supabase
      .from('referral_participants')
      .select('id, display_name, referral_code')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

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

    await supabase.from('referral_events').insert({
      participant_id: participant.id,
      event_type: 'referral_sent',
      referred_email: normalizedReferred,
      metadata: {
        invite_type: inviteType,
        referred_name: referredName?.trim() || null,
      },
    })

    // Build referral URL + email content
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    const referralPath = inviteType === 'distributor' ? '/retail' : '/'
    const referralUrl = `${siteUrl}${referralPath}?ref=${participant.referral_code}`
    const referrerName = participant.display_name || normalizedEmail

    const unsubUrl = buildUnsubscribeUrl(normalizedReferred, null, siteUrl)
    const unsubHeaders = buildListUnsubscribeHeaders(normalizedReferred, null, siteUrl)

    const { subject, html, text } = buildWarmIntroEmail({
      referredFirstName: (referredName?.trim().split(' ')[0]) || null,
      referrerName,
      inviteType,
      referralUrl,
      customMessage: typeof customMessage === 'string' ? customMessage.trim() : '',
      unsubUrl,
      recipientEmail: normalizedReferred,
    })

    try {
      await sendAndLogEmail({
        to: normalizedReferred,
        subject,
        html,
        text,
        fromAlias: 'loyalty',
        headers: unsubHeaders,
        referralParticipantId: participant.id,
      })
    } catch (sendErr) {
      console.error('[referral/send] SES send failed:', sendErr)
      return NextResponse.json(
        {
          error:
            'Invite saved but email delivery failed. Our team will retry shortly.',
          invite,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, invite })
  } catch (error) {
    console.error('[referral/send] Failed:', error)
    return NextResponse.json({ error: 'Failed to send warm intro' }, { status: 500 })
  }
}

