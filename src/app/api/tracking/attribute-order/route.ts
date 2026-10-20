import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralCode } from '@/lib/referral/helpers'
import { applyOrderAttribution } from '@/lib/tracking/order-attribution'
import { sendOrderPurchaseToMeta } from '@/lib/tracking/order-meta-purchase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Client-side order attribution receiver.
 *
 * The AccelPay cart fires a `bc-sale` postMessage when a purchase completes.
 * At that moment the browser still holds the `ut_visitor_id` (base/UTM) and
 * `ut_ref` (referral) cookies plus the AccelPay sale id -- none of which appear
 * in the server-side order webhook. `AccelPaySaleTracker` POSTs them here so we
 * can attribute the order. Crediting itself requires a real AccelPay-sourced
 * `loyalty_orders` row, so fabricated sale ids can never credit anything.
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

  const saleId = Number(body.saleId)
  if (!Number.isFinite(saleId) || saleId <= 0) {
    return NextResponse.json({ error: 'Valid saleId is required' }, { status: 400 })
  }

  const visitorFingerprint =
    typeof body.visitorId === 'string' && body.visitorId.trim()
      ? body.visitorId.trim()
      : null
  const refCode =
    typeof body.refCode === 'string' && body.refCode.trim()
      ? body.refCode.trim()
      : null

  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
  const browser = {
    fbp: text(body.fbp, 200),
    fbc: text(body.fbc, 500),
    event_source_url: text(body.pageUrl, 1000),
    client_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    client_user_agent: text(request.headers.get('user-agent'), 1000),
  }

  try {
    const admin = createAdminClient()

    // A stale/invalid ref code should not block base (UTM) attribution.
    let validRefCode: string | null = null
    if (refCode) {
      const referrer = await resolveReferralCode(admin, refCode)
      if (referrer) validRefCode = refCode
    }

    const { data: existing } = await admin
      .from('loyalty_order_attributions')
      .select('id, visitor_fingerprint, ref_code, fbp, fbc, client_ip, client_user_agent, event_source_url')
      .eq('accelpay_sale_id', saleId)
      .maybeSingle()

    if (existing) {
      // Fill only missing fields; never clobber already-applied/credited state.
      const update: Record<string, unknown> = {}
      if (!existing.visitor_fingerprint && visitorFingerprint) {
        update.visitor_fingerprint = visitorFingerprint
      }
      if (!existing.ref_code && validRefCode) {
        update.ref_code = validRefCode
      }
      for (const [key, value] of Object.entries(browser)) {
        if (value && !existing[key as keyof typeof existing]) update[key] = value
      }
      if (Object.keys(update).length > 0) {
        await admin
          .from('loyalty_order_attributions')
          .update(update)
          .eq('accelpay_sale_id', saleId)
      }
    } else {
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
