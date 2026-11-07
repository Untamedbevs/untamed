export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { getSenderById, DEFAULT_CRM_SENDER } from '@/lib/crm/senders'
import { recipientVars, usesReferralTags } from '@/lib/crm/recipient-vars'
import { fetchReferralCodes } from '@/lib/crm/referral-codes'
import { renderTemplate } from '@/lib/email/templates'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { buildUnsubscribeUrl } from '@/lib/messaging/unsubscribe'

/**
 * POST { subject, textBody, preheader?, senderId?, to? }
 * Sends one rendered copy, merge tags filled with the staff member's details,
 * to `to` (defaults to the signed-in staff member). Bypasses the queue.
 */
export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, textBody, preheader, senderId, to } = (await request.json()) as {
    subject?: string
    textBody?: string
    preheader?: string
    senderId?: string
    to?: string
  }

  if (!subject?.trim() || !textBody?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
  }

  const recipient = (to || staff.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return NextResponse.json({ error: 'Enter a valid test address' }, { status: 400 })
  }

  const sender = getSenderById(senderId || DEFAULT_CRM_SENDER.id)
  const testRecipient = {
    email: recipient,
    name: staff.full_name || recipient,
    firstName: (staff.full_name || '').split(' ')[0] || '',
  }
  // Use the test address's own referral code when it has one; otherwise a
  // sample code, so the test still shows what the link will look like.
  let referralCode: string | undefined
  if (usesReferralTags(`${subject}\n${textBody}\n${preheader ?? ''}`)) {
    const codes = await fetchReferralCodes([testRecipient])
    referralCode = codes.get(recipient.toLowerCase()) ?? 'SAMPLECODE'
  }
  const vars = recipientVars(testRecipient, referralCode)
  const rendered = renderTemplate(
    { subject, body: textBody, preheader: preheader || null },
    vars,
    { unsubscribeUrl: buildUnsubscribeUrl(recipient, null), recipientEmail: recipient }
  )

  try {
    await sendAndLogEmail({
      to: recipient,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      from: sender.email,
      replyTo: sender.email,
      sentBy: staff.id,
    })
    return NextResponse.json({ ok: true, to: recipient })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Send failed'
    console.error('[blast/test] send failed:', err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
