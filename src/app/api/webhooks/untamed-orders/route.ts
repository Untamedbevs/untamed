import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { creditOnlineOrder, parseAccelPaySale } from '@/lib/loyalty/orders'
import { captureWebhookEvent } from '@/lib/shop/webhook-capture'
import { sendOrderPurchaseToMeta } from '@/lib/tracking/order-meta-purchase'

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
  // While no secret is configured, deliveries are accepted as they were
  // before the security fixes. Setting ACCELPAY_WEBHOOK_SECRET (and ?token=
  // on the AccelPay webhook URL) turns the check on with no code change.
  if (!secret) {
    console.warn('[webhooks/untamed-orders] ACCELPAY_WEBHOOK_SECRET is not set; accepting the delivery unauthenticated.')
    return true
  }
  const provided =
    new URL(request.url).searchParams.get('token') ||
    request.headers.get('x-webhook-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!provided) return false
  // Hash both sides so the comparison is constant-time regardless of length.
  const given = createHash('sha256').update(provided).digest()
  const expected = createHash('sha256').update(secret).digest()
  return timingSafeEqual(given, expected)
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

  const admin = createAdminClient()
  await captureWebhookEvent(admin, 'untamed-orders', body)

  const sale = parseAccelPaySale(body)
  if (!sale) {
    // Unparseable (e.g. an AccelPay test ping). Ack with 200 so it isn't retried
    // forever, but log the raw body so we can adapt the parser if shapes change.
    console.warn('[webhooks/untamed-orders] could not parse sale from payload:', body)
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const result = await creditOnlineOrder(admin, sale)
    // Sends only if the browser `bc-sale` context has already landed; otherwise
    // the attribute-order endpoint (or the reconcile cron sweep) sends it.
    await sendOrderPurchaseToMeta(admin, sale.saleId, { requireBrowserContext: true })
    return NextResponse.json({ ok: true, result: result.status })
  } catch (err) {
    console.error('[webhooks/untamed-orders] processing failed:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'untamed-orders' })
}
