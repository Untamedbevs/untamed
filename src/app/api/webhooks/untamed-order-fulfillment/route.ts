import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { creditOnlineOrder, parseAccelPaySale } from '@/lib/loyalty/orders'
import { captureWebhookEvent } from '@/lib/shop/webhook-capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * AccelPay order fulfillment webhook receiver ("Fulfill Order" event).
 *
 * Register this URL in AccelPay for the fulfillment event with the shared
 * secret as a `?token=` query param, e.g.
 *   https://untamedbeverages.com/api/webhooks/untamed-order-fulfillment?token=SECRET
 *
 * On each event we update the matching order's `status` (e.g. fulfilling /
 * fulfilled / complete). If the order hasn't been recorded yet (the fulfillment
 * event raced ahead of `new_order`), we record + credit it now so nothing is
 * missed. Idempotent: re-processing a known sale is safe.
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

/**
 * The live "Fulfill Order" event sends a SHIPMENT object, not a sale: its
 * top-level `id` is the fulfillment id and the actual sale id lives in
 * `saleId` (alongside carrier/tracking fields). Passing that shape to
 * parseAccelPaySale used to mint bogus $0 "orders" keyed on the fulfillment
 * id. Detect it so we update the real order's status instead.
 */
function parseShipmentEvent(
  body: unknown
): { saleId: number; status: string | null } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, any>
  const saleId = Number(b.saleId)
  if (!Number.isFinite(saleId) || saleId <= 0) return null
  const looksLikeShipment =
    'carrier' in b || 'trackingNumber' in b || Array.isArray(b.history)
  if (!looksLikeShipment) return null
  const status = typeof b.status === 'string' && b.status.trim() ? b.status.trim() : null
  return { saleId, status }
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
  await captureWebhookEvent(admin, 'untamed-order-fulfillment', body)

  const shipment = parseShipmentEvent(body)
  if (shipment) {
    if (!shipment.status) {
      return NextResponse.json({ ok: true, result: 'no-status', saleId: shipment.saleId })
    }
    try {
      const { data: updated } = await admin
        .from('loyalty_orders')
        .update({ status: shipment.status })
        .eq('accelpay_sale_id', shipment.saleId)
        .select('id')
        .maybeSingle()
      return NextResponse.json({
        ok: true,
        result: updated ? 'status-updated' : 'order-not-recorded-yet',
        saleId: shipment.saleId,
        status: shipment.status,
      })
    } catch (err) {
      console.error('[webhooks/untamed-order-fulfillment] status update failed:', err)
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }
  }

  const sale = parseAccelPaySale(body)
  if (!sale) {
    // Unparseable (e.g. an AccelPay test ping). Ack with 200 so it isn't retried
    // forever, but log the raw body so we can adapt the parser if shapes change.
    console.warn(
      '[webhooks/untamed-order-fulfillment] could not parse sale from payload:',
      body
    )
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const { data: existing } = await admin
      .from('loyalty_orders')
      .select('id, status')
      .eq('accelpay_sale_id', sale.saleId)
      .maybeSingle()

    if (existing) {
      // Only write a status when the payload carries one (don't clobber).
      if (sale.status && sale.status !== existing.status) {
        await admin
          .from('loyalty_orders')
          .update({ status: sale.status })
          .eq('id', existing.id)
      }
      return NextResponse.json({
        ok: true,
        result: 'updated',
        status: sale.status ?? existing.status ?? null,
      })
    }

    // Fulfillment arrived before the order was recorded -> record + credit now.
    const result = await creditOnlineOrder(admin, sale)
    return NextResponse.json({ ok: true, result: result.status })
  } catch (err) {
    console.error('[webhooks/untamed-order-fulfillment] processing failed:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'untamed-order-fulfillment' })
}
