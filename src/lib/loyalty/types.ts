export interface LoyaltyMember {
  id: string
  email: string
  first_name: string | null
  visitor_id: string
  favorite_drink_slug: string | null
  points_balance: number
  first_utm_source: string | null
  first_utm_medium: string | null
  first_utm_campaign: string | null
  first_landing_page: string | null
  first_referrer: string | null
  first_seen_at: string | null
  total_scans: number
  created_at: string
  updated_at: string
}

export type LoyaltyTransactionType =
  | 'receipt_approved'
  | 'signup_bonus'
  | 'redemption'
  | 'adjustment'
  | 'ugc_approved'
  | 'online_order'

export interface LoyaltyTransaction {
  id: string
  member_id: string
  points: number
  type: LoyaltyTransactionType
  description: string | null
  receipt_id: string | null
  order_id: string | null
  created_by_staff_id: string | null
  created_at: string
}

export interface LoyaltyOrder {
  id: string
  accelpay_sale_id: number
  member_id: string | null
  email: string
  status: string | null
  subtotal_cents: number
  total_cents: number
  tax_cents: number
  delivery_cents: number
  discount_cents: number
  pack_count: number
  points_awarded: number
  points_claimed: boolean
  items: { listingId?: number; variantId?: number; title?: string; quantity: number; priceCents?: number }[] | null
  created_at: string
  updated_at: string
}

export interface LoyaltyReceipt {
  id: string
  member_id: string
  image_url: string
  status: 'pending' | 'approved' | 'rejected'
  points_awarded: number
  drink_slug: string | null
  admin_notes: string | null
  reviewed_by: string | null
  created_at: string
  reviewed_at: string | null
}

export interface MemberProfile {
  member: LoyaltyMember
  transactions: LoyaltyTransaction[]
  receipts: LoyaltyReceipt[]
}
