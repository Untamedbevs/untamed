import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { creditOnlineOrder, parseAccelPaySale } from '@/lib/loyalty/orders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * AccelPay `new_order` webhook receiver.
 *
 * Register this URL in AccelPay (event: new_order) with the shared secret as a
 * `?token=` query param, e.g.
 *   https://untamedbeverages.com/api/webhooks/untamed-orders?token=SECRET
 *
 * On each order we record the sale (idempotent) and either credit the matching
 * loyalty member immediately or hold a pending credit until they sign up.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ACCELPAY_WEBHOOK_SECRET
  // If no secret is configured we accept (dev); in prod set the secret.
  if (!secret) return true
  const provided =
    new URL(request.url).searchParams.get('token') ||
    request.headers.get('x-webhook-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return provided === secret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sale = parseAccelPaySale(body)
  if (!sale) {
    // Unparseable (e.g. an AccelPay test ping). Ack with 200 so it isn't retried
    // forever, but log the raw body so we can adapt the parser if shapes change.
    console.warn('[webhooks/untamed-orders] could not parse sale from payload:', body)
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const admin = createAdminClient()
    const result = await creditOnlineOrder(admin, sale)
    return NextResponse.json({ ok: true, result: result.status })
  } catch (err) {
    console.error('[webhooks/untamed-orders] processing failed:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'untamed-orders' })
}
