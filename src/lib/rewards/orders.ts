import type { SupabaseClient } from '@supabase/supabase-js'
import { drinks, type Drink } from '@/lib/drinks'
import { TEST_CUSTOMER } from '@/lib/rewards/test-customer'

/** One product line of a past order, matched to its drink for the picture card. */
export interface OrderLine {
  drink: Pick<Drink, 'slug' | 'name' | 'flavor' | 'color' | 'colorLight' | 'colorDark' | 'canImage' | 'animalImage'> | null
  title: string
  quantity: number
  priceCents: number
}

export interface MemberOrder {
  id: string
  placedAt: string
  status: string
  totalCents: number
  packCount: number
  pointsAwarded: number
  lines: OrderLine[]
}

interface RawItem {
  title?: string
  quantity?: number
  listingId?: number | string
  priceCents?: number
}

const DRINK_BY_LISTING = new Map(drinks.map((d) => [d.bevCartListingId, d]))

function drinkCard(d: Drink): NonNullable<OrderLine['drink']> {
  return {
    slug: d.slug,
    name: d.name,
    flavor: d.flavor,
    color: d.color,
    colorLight: d.colorLight,
    colorDark: d.colorDark,
    canImage: d.canImage,
    animalImage: d.animalImage,
  }
}

function toLine(item: RawItem): OrderLine {
  const drink = DRINK_BY_LISTING.get(String(item.listingId ?? ''))
  return {
    drink: drink ? drinkCard(drink) : null,
    title: item.title || '12oz 4-Pack',
    quantity: Number(item.quantity) || 1,
    priceCents: Number(item.priceCents) || 0,
  }
}

/**
 * Sample history for the shared test customer, so the order gallery can be
 * reviewed without placing real orders. It never touches loyalty_orders, so
 * sales reports stay clean.
 */
function sampleOrders(): MemberOrder[] {
  const day = 86_400_000
  const ago = (days: number) => new Date(Date.now() - days * day).toISOString()
  const bySlug = (slug: string) => drinks.find((d) => d.slug === slug)!
  const order = (id: string, days: number, status: string, lines: [string, number][]): MemberOrder => {
    const orderLines = lines.map(([slug, quantity]) => ({
      drink: drinkCard(bySlug(slug)),
      title: '12oz 4-Pack',
      quantity,
      priceCents: bySlug(slug).priceCents,
    }))
    const totalCents = orderLines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0)
    const packCount = lines.reduce((sum, [, q]) => sum + q, 0)
    return { id, placedAt: ago(days), status, totalCents, packCount, pointsAwarded: totalCents, lines: orderLines }
  }
  return [
    order('sample-3', 6, 'processing', [['cheetah', 2], ['black-panther', 1]]),
    order('sample-2', 34, 'fulfilled', [['lioness', 1], ['cougar', 1], ['black-panther', 2]]),
    order('sample-1', 81, 'complete', [['cheetah', 1]]),
  ]
}

/** The member's online orders, newest first, each line matched to its drink. */
export async function loadMemberOrders(
  admin: SupabaseClient,
  member: { id: string; email: string },
  limit = 24
): Promise<MemberOrder[]> {
  const { data } = await admin
    .from('loyalty_orders')
    .select('id, created_at, status, total_cents, pack_count, points_awarded, items')
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  const orders: MemberOrder[] = (data || []).map((o) => ({
    id: o.id as string,
    placedAt: o.created_at as string,
    status: (o.status as string) || 'processing',
    totalCents: (o.total_cents as number) ?? 0,
    packCount: (o.pack_count as number) ?? 0,
    pointsAwarded: (o.points_awarded as number) ?? 0,
    lines: Array.isArray(o.items) ? (o.items as RawItem[]).map(toLine) : [],
  }))

  if (orders.length === 0 && member.email === TEST_CUSTOMER.email) return sampleOrders()
  return orders
}

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  processing: { label: 'On its way', tone: '#FFD700' },
  fulfilled: { label: 'Delivered', tone: '#39FF14' },
  complete: { label: 'Delivered', tone: '#39FF14' },
  cancelled: { label: 'Cancelled', tone: '#FF6B6B' },
  refunded: { label: 'Refunded', tone: '#A0A0A0' },
}

export const formatUsd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
