/**
 * Online order loyalty crediting (AccelPay / BevCart).
 *
 * Online purchases earn points automatically — no receipt upload. The AccelPay
 * `new_order` webhook (and a reconciliation cron) funnel sales through
 * `creditOnlineOrder`, which records each sale exactly once (idempotent on the
 * AccelPay sale id) and either credits the matching member immediately or holds
 * the points as a pending credit until someone signs up with that email.
 *
 * Receipt uploads are now reserved for IN-STORE / ON-PREMISE purchases.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { POINTS } from './constants'

export interface ParsedSaleItem {
  listingId?: number
  variantId?: number
  title?: string
  quantity: number
  priceCents?: number
}

export interface ParsedSale {
  saleId: number
  email: string | null
  status?: string | null
  subtotalCents: number
  totalCents: number
  taxCents: number
  deliveryCents: number
  discountCents: number
  items: ParsedSaleItem[]
  packCount: number
  /** Original payload, stored for debugging since AccelPay shapes can change. */
  raw?: unknown
}

export type CreditResult =
  | { status: 'credited'; orderId: string; memberId: string; points: number }
  | { status: 'pending'; orderId: string; points: number }
  | { status: 'duplicate' }

// ---------------------------------------------------------------------------
// Points math
// ---------------------------------------------------------------------------
export function packCountFromItems(items: ParsedSaleItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
}

export function pointsForPacks(packCount: number): number {
  return Math.max(0, packCount) * POINTS.PER_PACK
}

// ---------------------------------------------------------------------------
// Payload parsing (defensive — AccelPay payloads "are subject to change")
// ---------------------------------------------------------------------------
function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** AccelPay money fields are dollar amounts; store them as integer cents. */
function toCents(value: unknown): number {
  return Math.round(num(value) * 100)
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length ? t : null
}

/**
 * Pull a normalized sale out of whatever AccelPay sends. Handles the documented
 * `bc-sale` value ({ payload: Sale, items }) plus common webhook envelopes
 * ({ event, data }, { sale }, { order }, or the sale object at the root).
 */
export function parseAccelPaySale(body: unknown): ParsedSale | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, any>

  const root = b.data ?? b.payload ?? b
  const sale = root?.sale ?? root?.order ?? root?.payload ?? root

  const saleId = num(sale?.id ?? root?.id ?? b.id ?? b.saleId)
  if (!saleId) return null

  const rawItems: any[] = Array.isArray(root?.items)
    ? root.items
    : Array.isArray(sale?.items)
      ? sale.items
      : Array.isArray(b.items)
        ? b.items
        : []

  const items: ParsedSaleItem[] = rawItems.map((it) => ({
    listingId: num(it?.variant?.listingId ?? it?.listingId) || undefined,
    variantId: num(it?.variant?.id ?? it?.variantId) || undefined,
    title: str(it?.title) ?? undefined,
    quantity: num(it?.quantity),
    priceCents: toCents(it?.price),
  }))

  const email =
    str(sale?.email) ??
    str(sale?.customerEmail) ??
    str(sale?.customer?.email) ??
    str(root?.email) ??
    str(root?.customer?.email) ??
    str(root?.address?.email) ??
    str(b.email)

  return {
    saleId,
    email: email ? email.toLowerCase() : null,
    status: str(sale?.status) ?? str(root?.status),
    subtotalCents: toCents(sale?.subtotal),
    totalCents: toCents(sale?.total),
    taxCents: toCents(sale?.tax),
    deliveryCents: toCents(sale?.deliveryFee ?? sale?.delivery_fee),
    discountCents: toCents(sale?.discountAmount ?? sale?.discount_amount),
    items,
    packCount: packCountFromItems(items),
    raw: body,
  }
}

// ---------------------------------------------------------------------------
// Crediting
// ---------------------------------------------------------------------------
async function awardOrderPoints(
  admin: SupabaseClient,
  orderId: string,
  memberId: string,
  currentBalance: number,
  points: number
): Promise<void> {
  await admin.from('loyalty_transactions').insert({
    member_id: memberId,
    points,
    type: 'online_order',
    description: `Online order (+${points} pts)`,
    order_id: orderId,
  })

  await admin
    .from('loyalty_members')
    .update({ points_balance: currentBalance + points })
    .eq('id', memberId)

  await admin
    .from('loyalty_orders')
    .update({ member_id: memberId, points_claimed: true })
    .eq('id', orderId)
}

/**
 * Record an AccelPay sale and credit points. Idempotent: a sale id we've
 * already stored is a no-op (`duplicate`). Returns `pending` when no member
 * matches the order email yet.
 */
export async function creditOnlineOrder(
  admin: SupabaseClient,
  sale: ParsedSale
): Promise<CreditResult> {
  const email = sale.email ? sale.email.toLowerCase().trim() : null
  const packCount = sale.packCount || packCountFromItems(sale.items)
  const points = pointsForPacks(packCount)

  let memberId: string | null = null
  let memberBalance = 0
  if (email) {
    const { data: member } = await admin
      .from('loyalty_members')
      .select('id, points_balance')
      .eq('email', email)
      .maybeSingle()
    if (member) {
      memberId = member.id as string
      memberBalance = (member.points_balance as number) ?? 0
    }
  }

  const { data: order, error } = await admin
    .from('loyalty_orders')
    .insert({
      accelpay_sale_id: sale.saleId,
      member_id: memberId,
      email: email || 'unknown',
      status: sale.status ?? null,
      subtotal_cents: sale.subtotalCents,
      total_cents: sale.totalCents,
      tax_cents: sale.taxCents,
      delivery_cents: sale.deliveryCents,
      discount_cents: sale.discountCents,
      pack_count: packCount,
      points_awarded: points,
      points_claimed: false,
      items: sale.items,
      raw_payload: sale.raw ?? null,
    })
    .select('id')
    .single()

  if (error) {
    // Unique violation on accelpay_sale_id => we've already processed this sale.
    if ((error as { code?: string }).code === '23505') {
      return { status: 'duplicate' }
    }
    throw error
  }

  const orderId = order.id as string

  if (memberId && points > 0) {
    await awardOrderPoints(admin, orderId, memberId, memberBalance, points)
    return { status: 'credited', orderId, memberId, points }
  }

  return { status: 'pending', orderId, points }
}

/**
 * Attach any pending online-order credits (member_id NULL) for `email` to the
 * given member and credit the points. Called whenever a member is provisioned
 * or linked, so points banked before signup land automatically. Idempotent via
 * a conditional claim on `points_claimed`.
 */
export async function claimPendingOrdersForMember(
  admin: SupabaseClient,
  memberId: string,
  email: string
): Promise<number> {
  const normalized = email.toLowerCase().trim()
  if (!normalized) return 0

  const { data: pending } = await admin
    .from('loyalty_orders')
    .select('id, points_awarded')
    .eq('points_claimed', false)
    .is('member_id', null)
    .ilike('email', normalized)

  if (!pending || pending.length === 0) return 0

  const { data: member } = await admin
    .from('loyalty_members')
    .select('points_balance')
    .eq('id', memberId)
    .maybeSingle()

  let balance = (member?.points_balance as number) ?? 0
  let totalAwarded = 0

  for (const order of pending) {
    // Atomically claim — only one caller wins if two run concurrently.
    const { data: claimed } = await admin
      .from('loyalty_orders')
      .update({ member_id: memberId, points_claimed: true })
      .eq('id', order.id)
      .eq('points_claimed', false)
      .select('id')
      .maybeSingle()

    if (!claimed) continue

    const pts = (order.points_awarded as number) ?? 0
    if (pts > 0) {
      await admin.from('loyalty_transactions').insert({
        member_id: memberId,
        points: pts,
        type: 'online_order',
        description: `Online order (+${pts} pts)`,
        order_id: order.id,
      })
      balance += pts
      totalAwarded += pts
    }
  }

  if (totalAwarded > 0) {
    await admin
      .from('loyalty_members')
      .update({ points_balance: balance })
      .eq('id', memberId)
  }

  return totalAwarded
}
