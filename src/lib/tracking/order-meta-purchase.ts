/**
 * Meta Conversions API Purchase for AccelPay orders.
 *
 * Checkout happens inside the AccelPay iframe, so there is no confirmation page
 * for the browser Pixel; this server event is the only Purchase signal. Its
 * match quality depends on two halves arriving from different places:
 *   - the `loyalty_orders` row (order webhook / reconcile cron): value + buyer
 *     contact details
 *   - the `loyalty_order_attributions` row (`bc-sale` in the browser): _fbp,
 *     _fbc, IP, user agent
 * Called from both paths; it sends once both are present. The reconcile cron
 * sweeps orders whose browser half never arrived and sends them without it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isMetaCapiConfigured, sendMetaCapiEvent } from '@/lib/tracking/meta-capi'

const MAX_EVENT_AGE_SECONDS = 7 * 86400 - 3600

interface BrowserContext {
  fbp: string | null
  fbc: string | null
  client_ip: string | null
  client_user_agent: string | null
  event_source_url: string | null
}

function str(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const t = String(value).trim()
  return t.length ? t : null
}

export async function sendOrderPurchaseToMeta(
  admin: SupabaseClient,
  accelPaySaleId: number,
  options: { requireBrowserContext?: boolean } = {}
): Promise<void> {
  if (!accelPaySaleId || !isMetaCapiConfigured()) return

  try {
    const { data: browser } = await admin
      .from('loyalty_order_attributions')
      .select('fbp, fbc, client_ip, client_user_agent, event_source_url')
      .eq('accelpay_sale_id', accelPaySaleId)
      .maybeSingle<BrowserContext>()

    const hasBrowserContext = Boolean(browser?.client_ip || browser?.client_user_agent)
    if (options.requireBrowserContext && !hasBrowserContext) return

    const { data: order } = await admin
      .from('loyalty_orders')
      .update({ meta_purchase_sent_at: new Date().toISOString() })
      .eq('accelpay_sale_id', accelPaySaleId)
      .is('meta_purchase_sent_at', null)
      .select('total_cents, pack_count, email, created_at, raw_payload')
      .maybeSingle()
    if (!order) return // Not created yet, or already sent.

    const raw = (order.raw_payload ?? {}) as Record<string, any>
    const buyer = (raw.buyerDetail ?? raw.shippingDetail ?? {}) as Record<string, unknown>
    const shipping = (raw.shippingDetail ?? {}) as Record<string, unknown>

    const createdAt = Number(raw.createdAt)
    const eventTime = Number.isFinite(createdAt) && createdAt > 0
      ? Math.floor(createdAt)
      : Math.floor(new Date(order.created_at as string).getTime() / 1000)
    if (Date.now() / 1000 - eventTime > MAX_EVENT_AGE_SECONDS) return

    const totalCents = Number(order.total_cents) || 0
    if (totalCents <= 0) return

    const [firstName, ...rest] = (str(buyer.name) ?? str(shipping.name) ?? '').split(/\s+/)

    const result = await sendMetaCapiEvent({
      eventName: 'Purchase',
      eventId: `purchase:${accelPaySaleId}`,
      eventTime,
      eventSourceUrl: browser?.event_source_url || 'https://untamedbeverages.com/shop',
      userData: {
        email: str(buyer.email) ?? str(order.email),
        phone: str(buyer.phone) ?? str(shipping.phone),
        firstName: firstName || null,
        lastName: rest.join(' ') || null,
        city: str(buyer.city) ?? str(shipping.city),
        state: str(buyer.province) ?? str(shipping.province),
        zip: str(buyer.zip) ?? str(shipping.zip),
        country: str(buyer.country) ?? str(shipping.country),
        externalId: str(raw.customerId),
        fbp: browser?.fbp ?? null,
        fbc: browser?.fbc ?? null,
        clientIpAddress: browser?.client_ip ?? null,
        clientUserAgent: browser?.client_user_agent ?? null,
      },
      customData: {
        value: totalCents / 100,
        currency: 'USD',
        content_type: 'product',
        num_items: Number(order.pack_count) || undefined,
        order_id: String(accelPaySaleId),
      },
    })

    if (!result.ok && !result.skipped) {
      // Release the claim so the reconcile cron retries.
      await admin
        .from('loyalty_orders')
        .update({ meta_purchase_sent_at: null })
        .eq('accelpay_sale_id', accelPaySaleId)
    }
  } catch (err) {
    console.error('[sendOrderPurchaseToMeta] failed for sale', accelPaySaleId, err)
  }
}

/** Send Purchases for recent orders whose browser half never arrived. */
export async function sweepPendingMetaPurchases(admin: SupabaseClient): Promise<number> {
  if (!isMetaCapiConfigured()) return 0
  const now = Date.now()
  const { data } = await admin
    .from('loyalty_orders')
    .select('accelpay_sale_id')
    .is('meta_purchase_sent_at', null)
    .lt('created_at', new Date(now - 10 * 60 * 1000).toISOString())
    .gt('created_at', new Date(now - 6 * 86400 * 1000).toISOString())
    .limit(100)

  for (const row of data ?? []) {
    await sendOrderPurchaseToMeta(admin, Number(row.accelpay_sale_id))
  }
  return data?.length ?? 0
}
