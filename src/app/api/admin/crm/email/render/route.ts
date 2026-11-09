export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { sanitizeBlocks } from '@/lib/email/blocks'
import { checkEmailContent } from '@/lib/email/checks'
import { renderForRecipient } from '@/lib/email/compose'
import { reasonForList, MissingPostalAddressError } from '@/lib/messaging/marketing-email'

/** Sample values so flow-only tags show something in previews. */
const SAMPLE_VARS = {
  points: 1000,
  points_balance: 6000,
  credit_reason: 'A friend joined the pack through your link',
  reward: 'Untamed Koozie',
  points_cost: 7500,
  order_items: ['Cougar 4-pack', 'Lioness 4-pack'],
  birthday: 'Nov 05',
}

/**
 * Preview + checks for any content (campaign, flow step, template).
 * Body: { subject, preheader, blocks, kind?, listName? }
 */
export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const blocks = sanitizeBlocks(body.blocks)
  const subject = typeof body.subject === 'string' ? body.subject : ''
  const preheader = typeof body.preheader === 'string' ? body.preheader : null
  const kind = body.kind === 'transactional' ? 'transactional' : 'marketing'
  const firstName = staff.full_name?.split(' ')[0] || 'Sam'

  let rendered: { subject: string; html: string; text: string } | null = null
  let renderError: string | null = null
  try {
    rendered = renderForRecipient({
      recipient: { email: staff.email, first_name: firstName, points_balance: SAMPLE_VARS.points_balance },
      subject,
      preheader,
      blocks,
      vars: SAMPLE_VARS,
      reason:
        kind === 'transactional'
          ? "You're receiving this because of activity on your Untamed account."
          : reasonForList(typeof body.listName === 'string' && body.listName ? body.listName : 'Untamed'),
      kind,
      utmCampaign: 'preview',
    })
  } catch (err) {
    renderError =
      err instanceof MissingPostalAddressError
        ? 'Set EMAIL_POSTAL_ADDRESS to preview marketing email (the footer needs it).'
        : err instanceof Error
          ? err.message
          : 'Render failed'
  }

  const checks = checkEmailContent({ subject, preheader, blocks, renderedHtml: rendered?.html, kind })
  if (renderError) checks.errors.unshift(renderError)

  return NextResponse.json({ ...(rendered || { subject, html: '', text: '' }), checks })
}
