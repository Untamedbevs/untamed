/**
 * TypeScript types for loyalty receipts (multi-image portal flow).
 *
 * Mirrors the columns of:
 *  - loyalty_receipts (legacy single-image table from migration 00004)
 *  - loyalty_receipt_assets (per-image normalized table from migration 00017)
 */

export type LoyaltyReceiptStatus = 'pending' | 'approved' | 'rejected'

export interface LoyaltyReceiptClaimedItem {
  drinkSlug: string
  quantity: number
}

export interface LoyaltyReceipt {
  id: string
  member_id: string
  image_url: string
  status: LoyaltyReceiptStatus
  points_awarded: number
  drink_slug: string | null
  claimed_items: LoyaltyReceiptClaimedItem[]
  admin_notes: string | null
  reviewed_by: string | null
  created_at: string
  reviewed_at: string | null
}

export interface LoyaltyReceiptAsset {
  id: string
  receipt_id: string
  s3_key: string
  url: string
  mime_type: string | null
  width: number | null
  height: number | null
  file_size_bytes: number | null
  display_order: number
  created_at: string
}

export interface LoyaltyReceiptWithAssets extends LoyaltyReceipt {
  assets: LoyaltyReceiptAsset[]
}
