import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/resolve-member'
import { WARM_INTRO_DAILY_LIMIT } from '@/lib/referral/constants'
import type { InviteType } from '@/lib/referral/types'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import {
  buildListUnsubscribeHeaders,
  buildUnsubscribeUrl,
} from '@/lib/messaging/unsubscribe'
import { buildWarmIntroEmail } from '@/lib/referral/warm-intro-email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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
  const referredEmail =
    typeof body?.referredEmail === 'string' ? body.referredEmail : null
  const referredName =
    typeof body?.referredName === 'string' ? body.referredName : null
  const inviteType = body?.inviteType as InviteType | undefined
  const customMessage =
    typeof body?.customMessage === 'string' ? body.customMessage : ''

  if (!referredEmail) {
    return NextResponse.json(
      { error: 'referredEmail is required' },
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
  const normalizedReferred = referredEmail.toLowerCase().trim()

  const { data: participant } = await supabase
    .from('referral_participants')
    .select('id, display_name, referral_code, email')
    .eq('loyalty_member_id', member.loyaltyMember.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!participant) {
    return NextResponse.json(
      { error: 'Activate your referral code first' },
      { status: 404 }
    )
  }

  if (normalizedReferred === participant.email) {
    return NextResponse.json(
      { error: "You can't invite yourself" },
      { status: 400 }
    )
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

  const { data: existingInvite } = await supabase
    .from('referral_invites')
    .select('id')
    .eq('participant_id', participant.id)
    .eq('referred_email', normalizedReferred)
    .maybeSingle()

  if (existingInvite) {
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
      invite_type: inviteType,
    })
    .select()
    .single()

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: 'Failed to record invite' },
      { status: 500 }
    )
  }

  await supabase.from('referral_events').insert({
    participant_id: participant.id,
    event_type: 'referral_sent',
    referred_email: normalizedReferred,
    metadata: {
      invite_type: inviteType,
      referred_name: referredName?.trim() || null,
      source: 'portal',
    },
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  const referralPath = inviteType === 'distributor' ? '/retail' : '/'
  const referralUrl = `${siteUrl}${referralPath}?ref=${participant.referral_code}`
  const referrerName = participant.display_name || participant.email

  const unsubUrl = buildUnsubscribeUrl(normalizedReferred, null, siteUrl)
  const unsubHeaders = buildListUnsubscribeHeaders(
    normalizedReferred,
    null,
    siteUrl
  )

  const { subject, html, text } = buildWarmIntroEmail({
    referredFirstName: referredName?.trim().split(' ')[0] || null,
    referrerName,
    inviteType,
    referralUrl,
    customMessage: customMessage.trim(),
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
    console.error('[portal/referrals/send] SES send failed:', sendErr)

    // Detect AWS SES sandbox: when the account has not been moved to
    // production, SES rejects any recipient that hasn't been verified
    // in the console with `MessageRejected` + an "is not verified" message.
    const errMessage =
      sendErr instanceof Error ? sendErr.message : String(sendErr || '')
    const errCode =
      (sendErr as { name?: string } | null)?.name ||
      (sendErr as { Code?: string } | null)?.Code ||
      ''
    const isSandboxRejection =
      errCode === 'MessageRejected' && /is not verified/i.test(errMessage)

    if (isSandboxRejection) {
      return NextResponse.json(
        {
          error:
            "We couldn't deliver the warm intro to that address right now. Copy your referral link below and share it directly — they'll still get full credit when they sign up.",
          code: 'RECIPIENT_NOT_DELIVERABLE',
          invite,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        error:
          'Invite saved but email delivery failed. Try again in a few minutes, or share your referral link directly.',
        code: 'EMAIL_SEND_FAILED',
        invite,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, invite })
}
