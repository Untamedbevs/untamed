export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { resolveStaff, canViewContacts, canManageContactData } from '@/lib/auth/resolve-staff'
import { backfillCheckoutConsent } from '@/lib/messaging/checkout-consent'
import { CHECKOUT_CONSENT } from '@/lib/email/consent-copy'
import { logStaffAction } from '@/lib/audit'

/** Dry run: how many past checkout ticks exist and how many would be recorded. */
export async function GET() {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const result = await backfillCheckoutConsent(false)
    return NextResponse.json({
      ...result,
      version: CHECKOUT_CONSENT.version,
      wordingKnown: Boolean(CHECKOUT_CONSENT.text),
      canApply: canManageContactData(staff.role),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lookup failed' }, { status: 500 })
  }
}

/** Record past checkout opt-ins (admin only, approved wording only). */
export async function POST() {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageContactData(staff.role)) {
    return NextResponse.json({ error: 'Only admins can record checkout opt-ins' }, { status: 403 })
  }

  try {
    const result = await backfillCheckoutConsent(true)
    if (!result.approved) {
      return NextResponse.json(
        { error: 'The checkout checkbox wording has not been confirmed and approved yet.', ...result },
        { status: 409 }
      )
    }
    console.log(`[checkout-consent] ${result.recorded} past checkout opt-ins recorded by staff ${staff.id}`)
    await logStaffAction(staff.id, 'contact.checkout_backfill', null, null, { recorded: result.recorded })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Backfill failed' }, { status: 500 })
  }
}
