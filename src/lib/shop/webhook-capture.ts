/**
 * Best-effort raw capture of incoming AccelPay webhook payloads.
 *
 * Logs the full body (visible in Vercel logs) and stores it in `webhook_events`
 * so we can inspect exactly what AccelPay sends per event type. Never throws --
 * capture must not break order processing -- and silently no-ops if the table
 * hasn't been applied yet.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Pull a best-effort event/action label and sale id out of any shape. */
function extract(body: unknown): { eventType: string | null; saleId: number | null } {
  if (!body || typeof body !== 'object') return { eventType: null, saleId: null }
  const b = body as Record<string, any>
  const root = b.data ?? b.payload ?? b
  const sale = root?.sale ?? root?.order ?? root?.payload ?? root

  const eventType =
    (typeof b.event === 'string' && b.event) ||
    (typeof b.action === 'string' && b.action) ||
    (typeof b.type === 'string' && b.type) ||
    (typeof root?.event === 'string' && root.event) ||
    (typeof root?.status === 'string' && root.status) ||
    null

  const saleId =
    num(sale?.id) ?? num(root?.id) ?? num(b.id) ?? num(b.saleId)

  return { eventType, saleId }
}

export async function captureWebhookEvent(
  admin: SupabaseClient,
  source: string,
  body: unknown
): Promise<void> {
  try {
    console.log(
      `[webhooks/${source}] payload:`,
      JSON.stringify(body)?.slice(0, 4000)
    )
    const { eventType, saleId } = extract(body)
    await admin.from('webhook_events').insert({
      source,
      event_type: eventType,
      accelpay_sale_id: saleId,
      payload: body ?? null,
    })
  } catch {
    // Capture is best-effort; never throw to the caller.
  }
}
