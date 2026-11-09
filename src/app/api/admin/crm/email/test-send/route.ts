export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff, canDraftMarketing } from '@/lib/auth/resolve-staff'
import { sanitizeBlocks } from '@/lib/email/blocks'
import { renderForRecipient } from '@/lib/email/compose'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { reasonForList } from '@/lib/messaging/marketing-email'
import { logStaffAction } from '@/lib/audit'

const TEST_VARS = {
  points: 1000,
  points_balance: 6000,
  credit_reason: 'A friend joined the pack through your link',
  reward: 'Untamed Koozie',
  points_cost: 7500,
  order_items: ['Cougar 4-pack'],
  birthday: 'Nov 05',
}

/**
 * Send a test of any content to the signed-in staff member only, marked
 * [TEST], through the transactional stream so it never counts as marketing.
 */
export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDraftMarketing(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const blocks = sanitizeBlocks(body.blocks)
  if (blocks.length === 0) return NextResponse.json({ error: 'Nothing to send' }, { status: 400 })

  try {
    const rendered = renderForRecipient({
      recipient: { email: staff.email, first_name: staff.full_name?.split(' ')[0] || null, points_balance: 6000 },
      subject: typeof body.subject === 'string' ? body.subject : '',
      preheader: typeof body.preheader === 'string' ? body.preheader : null,
      blocks,
      vars: TEST_VARS,
      reason: reasonForList(typeof body.listName === 'string' && body.listName ? body.listName : 'Untamed'),
      kind: 'transactional',
      utmCampaign: 'test',
    })
    await sendAndLogEmail({
      to: staff.email,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      fromAlias: 'loyalty',
      stream: 'transactional',
      templateSlug: 'test-send',
      sentBy: staff.id,
    })
    await logStaffAction(staff.id, 'email.test_send', null, null, { subject: rendered.subject })
    return NextResponse.json({ ok: true, sentTo: staff.email })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Test send failed' }, { status: 500 })
  }
}
