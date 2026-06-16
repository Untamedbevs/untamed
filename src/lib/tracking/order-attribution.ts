/**
 * Online order attribution orchestrator (AccelPay).
 *
 * Ties an AccelPay sale into both attribution systems once both halves are
 * known -- the durable `loyalty_order_attributions` row (visitor fingerprint +
 * referral code captured client-side from `bc-sale`) and the `loyalty_orders`
 * row (created by the order webhook / reconcile cron). Called from BOTH the
 * client attribution endpoint and `creditOnlineOrder`, so it completes whenever
 * the second of the two rows lands, regardless of arrival order.
 *
 * Step 1 (base attribution): snapshot the visitor's first-touch UTM onto the
 * order, link the visitor to the buyer's member, and backfill the member's
 * first-touch UTM. Step 2 (referral): fire the per-order `paid_conversion`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { creditPaidConversion } from '@/lib/referral/helpers'

interface VisitorAttribution {
  first_utm_source: string | null
  first_utm_medium: string | null
  first_utm_campaign: string | null
  first_landing_page: string | null
  first_referrer: string | null
}

async function applyBaseAttribution(
  admin: SupabaseClient,
  accelPaySaleId: number
): Promise<void> {
  const { data: order } = await admin
    .from('loyalty_orders')
    .select('id, member_id')
    .eq('accelpay_sale_id', accelPaySaleId)
    .maybeSingle()
  if (!order) return // Order row not created yet; the other path will retry.

  const { data: attribution } = await admin
    .from('loyalty_order_attributions')
    .select('visitor_fingerprint, ref_code, attribution_applied')
    .eq('accelpay_sale_id', accelPaySaleId)
    .maybeSingle()
  if (!attribution || attribution.attribution_applied) return

  const fingerprint = (attribution.visitor_fingerprint as string | null) || null
  const refCode = (attribution.ref_code as string | null) || null

  let visitor: (VisitorAttribution & { id: string }) | null = null
  if (fingerprint) {
    const { data } = await admin
      .from('visitors')
      .select(
        'id, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_page, first_referrer'
      )
      .eq('fingerprint', fingerprint)
      .maybeSingle()
    visitor = (data as (VisitorAttribution & { id: string }) | null) || null
  }

  // Snapshot the per-order attribution (UTM + ref code) onto the order.
  await admin
    .from('loyalty_orders')
    .update({
      visitor_fingerprint: fingerprint,
      attributed_ref_code: refCode,
      first_utm_source: visitor?.first_utm_source ?? null,
      first_utm_medium: visitor?.first_utm_medium ?? null,
      first_utm_campaign: visitor?.first_utm_campaign ?? null,
      first_landing_page: visitor?.first_landing_page ?? null,
      first_referrer: visitor?.first_referrer ?? null,
    })
    .eq('id', order.id)

  // Link the visitor to the buyer's member and backfill first-touch UTM where
  // the member doesn't already have it (waterfall completion).
  const memberId = order.member_id as string | null
  if (visitor && memberId) {
    await admin
      .from('visitors')
      .update({ loyalty_member_id: memberId })
      .eq('id', visitor.id)
      .is('loyalty_member_id', null)

    const { data: member } = await admin
      .from('loyalty_members')
      .select('first_utm_source, first_utm_medium, first_utm_campaign')
      .eq('id', memberId)
      .maybeSingle()

    if (
      member &&
      !member.first_utm_source &&
      !member.first_utm_medium &&
      !member.first_utm_campaign
    ) {
      await admin
        .from('loyalty_members')
        .update({
          first_utm_source: visitor.first_utm_source,
          first_utm_medium: visitor.first_utm_medium,
          first_utm_campaign: visitor.first_utm_campaign,
          first_landing_page: visitor.first_landing_page,
          first_referrer: visitor.first_referrer,
        })
        .eq('id', memberId)
    }
  }

  await admin
    .from('loyalty_order_attributions')
    .update({ attribution_applied: true })
    .eq('accelpay_sale_id', accelPaySaleId)
}

/**
 * Idempotent, best-effort: applies base UTM/visitor attribution to an order and
 * then credits any referral paid_conversion. Safe to call multiple times and
 * from both the client endpoint and the order pipeline.
 */
export async function applyOrderAttribution(
  admin: SupabaseClient,
  accelPaySaleId: number
): Promise<void> {
  if (!accelPaySaleId) return
  try {
    await applyBaseAttribution(admin, accelPaySaleId)
  } catch (err) {
    console.error('[applyOrderAttribution] base attribution failed:', err)
  }
  // Referral crediting is itself best-effort and idempotent.
  await creditPaidConversion(admin, accelPaySaleId)
}
