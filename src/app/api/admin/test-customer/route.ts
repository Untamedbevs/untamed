import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import {
  TEST_CUSTOMER,
  ensureTestCustomer,
  resetTestCustomer,
  testCustomerSignInLink,
} from '@/lib/rewards/test-customer'

export const dynamic = 'force-dynamic'

/** GET /api/admin/test-customer — the shared test customer, created on first use. */
export async function GET() {
  if (!(await resolveAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const { memberId } = await ensureTestCustomer(admin)
    const { data: member } = await admin
      .from('loyalty_members')
      .select('points_balance, program_enrolled_at, favorite_drink_slug')
      .eq('id', memberId)
      .single()
    return NextResponse.json({
      id: memberId,
      email: TEST_CUSTOMER.email,
      firstName: TEST_CUSTOMER.firstName,
      pointsBalance: member?.points_balance ?? 0,
      enrolled: !!member?.program_enrolled_at,
      spiritAnimal: member?.favorite_drink_slug ?? null,
    })
  } catch (error) {
    console.error('[admin/test-customer] load failed:', error)
    return NextResponse.json({ error: 'Could not load the test customer' }, { status: 500 })
  }
}

/**
 * POST /api/admin/test-customer
 *   { action: "reset" } — back to a fresh signup, so onboarding runs again
 *   { action: "sign-in-link" } — a one-time link that signs in as the test customer
 */
export async function POST(request: NextRequest) {
  if (!(await resolveAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const admin = createAdminClient()
    if (body?.action === 'reset') {
      await resetTestCustomer(admin)
      return NextResponse.json({ ok: true })
    }
    if (body?.action === 'sign-in-link') {
      return NextResponse.json({ url: await testCustomerSignInLink(admin, request.nextUrl.origin) })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[admin/test-customer] action failed:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
