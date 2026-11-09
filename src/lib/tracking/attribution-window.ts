/**
 * Freshness rules for anonymous AccelPay order attribution.
 *
 * /api/tracking/attribute-order is posted by the buyer's own browser within
 * seconds of checkout (AccelPaySaleTracker on `bc-sale`), but nothing proves
 * the caller is the buyer. So attribution only counts when it was attached
 * close to the sale: data attached more than ATTACHED_BEFORE_SALE_MS before
 * the sale (for example a referral code posted for a sale id before that sale
 * existed) is ignored when crediting referrals, snapshotting UTM and sending
 * the Meta Purchase.
 *
 * `loyalty_order_attributions.created_at` is the "attached at" time. It is
 * set once, by the column default when the row is inserted; nothing renews
 * or re-stamps it. A row posted for a sale id well ahead of the sale therefore
 * stays too old to count, however often it is re-posted. A row posted within
 * ATTACHED_BEFORE_SALE_MS before the sale is not told apart from the buyer's
 * and does count.
 */

/**
 * How long after the order row is saved the attribute-order route still
 * accepts posts for it. The buyer's tracker posts within seconds.
 */
export const ATTRIBUTION_WINDOW_MS = 2 * 60 * 60 * 1000

/**
 * How long before the sale attribution may have been attached and still
 * count. The buyer's tracker posts after the sale, so this only absorbs clock
 * differences between AccelPay's sale time and ours.
 */
export const ATTACHED_BEFORE_SALE_MS = 10 * 60 * 1000

/**
 * How far before the saved time AccelPay's own sale time may be and still be
 * trusted. The reconcile cron can save a sale the webhook missed days later
 * (72h lookback by default).
 */
const MAX_SALE_TO_SAVE_MS = 7 * 24 * 60 * 60 * 1000
/** Clock skew allowed between AccelPay's sale time and our saved time. */
const MAX_SALE_AFTER_SAVE_MS = 5 * 60 * 1000

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a canonical UUID string (what the client's crypto.randomUUID makes). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

function parseTime(value: unknown): number {
  return typeof value === 'string' ? Date.parse(value) : NaN
}

/** AccelPay's sale time from the stored payload (unix seconds or ms), or NaN. */
function saleTimeFromPayload(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return NaN
  const value = (raw as Record<string, unknown>).createdAt
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())
        ? Number(value)
        : NaN
  if (!Number.isFinite(n) || n <= 0) return NaN
  return n < 1e12 ? n * 1000 : n
}

/**
 * When the sale happened, in ms: AccelPay's own sale time from the stored
 * payload when it is plausible, else when the order row was saved. Using the
 * sale time keeps the buyer's attribution valid when the reconcile cron saves
 * an order the webhook missed hours later. NaN when the order has no
 * readable time.
 */
export function orderSaleTimeMs(order: { created_at?: unknown; raw_payload?: unknown }): number {
  const saved = parseTime(order.created_at)
  if (!Number.isFinite(saved)) return NaN
  const sold = saleTimeFromPayload(order.raw_payload)
  if (
    Number.isFinite(sold) &&
    sold <= saved + MAX_SALE_AFTER_SAVE_MS &&
    sold >= saved - MAX_SALE_TO_SAVE_MS
  ) {
    return Math.min(saved, sold)
  }
  return saved
}

/**
 * Whether attribution attached at `attachedAt` can belong to a sale made at
 * `saleTimeMs`: false when it was attached more than ATTACHED_BEFORE_SALE_MS
 * before the sale. Fails closed when either time is unreadable.
 */
export function attachedNearSale(attachedAt: unknown, saleTimeMs: number): boolean {
  const attached = parseTime(attachedAt)
  if (!Number.isFinite(attached) || !Number.isFinite(saleTimeMs)) return false
  return attached >= saleTimeMs - ATTACHED_BEFORE_SALE_MS
}

/** attachedNearSale against a saved `loyalty_orders` row. */
export function attributionBelongsToOrder(
  attachedAt: unknown,
  order: { created_at?: unknown; raw_payload?: unknown }
): boolean {
  return attachedNearSale(attachedAt, orderSaleTimeMs(order))
}
