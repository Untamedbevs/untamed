import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralCode } from '@/lib/referral/helpers'
import { applyOrderAttribution } from '@/lib/tracking/order-attribution'
import { sendOrderPurchaseToMeta } from '@/lib/tracking/order-meta-purchase'
import { ATTRIBUTION_WINDOW_MS, isUuid } from '@/lib/tracking/attribution-window'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** A positive integer sale id that fits a BIGINT exactly, or null. */
function parseSaleId(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d{1,16}$/.test(value.trim())
        ? Number(value.trim())
        : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * Client-side order attribution receiver.
 *
 * The AccelPay cart fires a `bc-sale` postMessage when a purchase completes.
 * At that moment the browser still holds the `ut_visitor_id` (base/UTM) and
 * `ut_ref` (referral) cookies plus the AccelPay sale id -- none of which appear
 * in the server-side order webhook. `AccelPaySaleTracker` POSTs them here so we
 * can attribute the order. Crediting itself requires a real AccelPay-sourced
 * `loyalty_orders` row, so fabricated sale ids can never credit anything.
 *
 * Nothing proves the caller is the buyer, so attribution is only accepted
 * while the sale is fresh (see lib/tracking/attribution-window):
 *   - once the order row is older than ATTRIBUTION_WINDOW_MS, nothing is
 *     written;
 *   - the first post for a sale id creates the row and fixes its `created_at`
 *     (the "attached at" time). Later posts change nothing: they never fill,
 *     replace or renew the row, whether or not the order exists yet;
 *   - crediting, the UTM snapshot and the Meta send ignore a row attached more
 *     than ATTACHED_BEFORE_SALE_MS before the sale.
 * So a code posted for a sale id well ahead of the sale stays too old to
 * count, and a post after the buyer's cannot add to their row. What remains:
 * a post within ATTACHED_BEFORE_SALE_MS before the sale, or one made when the
 * buyer's tracker never posted, still counts, because nothing in the post
 * proves it came from the buyer's checkout.
 */
export async function POST(request: NextRequest) {
  let body: {
    saleId?: unknown
    visitorId?: unknown
    refCode?: unknown
    fbp?: unknown
    fbc?: unknown
    pageUrl?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const saleId = parseSaleId(body.saleId)
  if (saleId === null) {
    return NextResponse.json({ error: 'Valid saleId is required' }, { status: 400 })
  }

  // The client's visitor id is a crypto.randomUUID; anything else is dropped.
  const rawVisitorId = typeof body.visitorId === 'string' ? body.visitorId.trim() : ''
  const visitorFingerprint = isUuid(rawVisitorId) ? rawVisitorId : null
  const rawRefCode = typeof body.refCode === 'string' ? body.refCode.trim() : ''
  const refCode = rawRefCode && rawRefCode.length <= 100 ? rawRefCode : null

  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
  const browser = {
    fbp: text(body.fbp, 200),
    fbc: text(body.fbc, 500),
    event_source_url: text(body.pageUrl, 1000),
    client_ip: text(request.headers.get('x-forwarded-for')?.split(',')[0], 100),
    client_user_agent: text(request.headers.get('user-agent'), 1000),
  }

  try {
    const admin = createAdminClient()
    const now = Date.now()

    const { data: order, error: orderError } = await admin
      .from('loyalty_orders')
      .select('created_at')
      .eq('accelpay_sale_id', saleId)
      .maybeSingle()
    if (orderError) throw new Error(`order lookup failed: ${orderError.message}`)

    if (order) {
      const savedAt = Date.parse(order.created_at as string)
      // Too late (or unreadable): the buyer's tracker posts within seconds.
      if (!Number.isFinite(savedAt) || now - savedAt >= ATTRIBUTION_WINDOW_MS) {
        return NextResponse.json({ ok: true })
      }
    }

    // A stale/invalid ref code should not block base (UTM) attribution.
    let validRefCode: string | null = null
    if (refCode) {
      const referrer = await resolveReferralCode(admin, refCode)
      if (referrer) validRefCode = refCode
    }

    // The first post for a sale id is the only one that counts. The buyer's
    // tracker posts once per sale; a later post is someone else, and filling
    // in fields the buyer left empty (an unreferred order's ref code, or the
    // Meta browser fields) would let them take that order's referral credit
    // or put their browser in the buyer's Purchase event.
    const { data: existing, error: existingError } = await admin
      .from('loyalty_order_attributions')
      .select('id')
      .eq('accelpay_sale_id', saleId)
      .maybeSingle()
    if (existingError) throw new Error(`attribution lookup failed: ${existingError.message}`)

    if (!existing) {
      const { error: insertError } = await admin
        .from('loyalty_order_attributions')
        .insert({
          accelpay_sale_id: saleId,
          visitor_fingerprint: visitorFingerprint,
          ref_code: validRefCode,
          ...browser,
        })
      // A concurrent insert (unique violation) is fine; the row now exists.
      if (insertError && (insertError as { code?: string }).code !== '23505') {
        throw insertError
      }
    }

    await applyOrderAttribution(admin, saleId)
    await sendOrderPurchaseToMeta(admin, saleId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[tracking/attribute-order] failed:', err)
    return NextResponse.json({ error: 'Attribution failed' }, { status: 500 })
  }
}
