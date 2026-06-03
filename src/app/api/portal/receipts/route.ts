import { NextRequest, NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const ALLOWED_DRINK_SLUGS = new Set([
  'black-panther',
  'cheetah',
  'cougar',
  'lioness',
])

const MAX_ASSETS_PER_RECEIPT = 10
const MAX_QUANTITY_PER_ITEM = 100

interface IncomingAsset {
  s3Key: string
  url: string
  mimeType?: string
  width?: number
  height?: number
  fileSizeBytes?: number
  displayOrder?: number
}

interface IncomingItem {
  drinkSlug: string
  quantity: number
}

interface CreateBody {
  /** @deprecated kept for backward compat — use `items` instead */
  drinkSlug?: string
  items?: IncomingItem[]
  assets: IncomingAsset[]
}

// ---------------------------------------------------------------------------
// GET /api/portal/receipts — list caller's own receipts with assets joined
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!member.loyaltyMember) {
      return NextResponse.json(
        {
          error: 'NOT_A_LOYALTY_MEMBER',
          message: 'Join the loyalty program to track receipts.',
        },
        { status: 403 }
      )
    }

    const admin = createAdminClient()
    const { data: receipts, error } = await admin
      .from('loyalty_receipts')
      .select('*')
      .eq('member_id', member.loyaltyMember.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[portal/receipts GET] List failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const receiptIds = (receipts || []).map((r) => r.id)
    let assetsByReceipt: Record<string, unknown[]> = {}

    if (receiptIds.length > 0) {
      const { data: assets } = await admin
        .from('loyalty_receipt_assets')
        .select('*')
        .in('receipt_id', receiptIds)
        .order('display_order', { ascending: true })

      assetsByReceipt = (assets || []).reduce(
        (acc: Record<string, unknown[]>, a: { receipt_id: string }) => {
          if (!acc[a.receipt_id]) acc[a.receipt_id] = []
          acc[a.receipt_id].push(a)
          return acc
        },
        {}
      )
    }

    const enriched = (receipts || []).map((r) => ({
      ...r,
      assets: assetsByReceipt[r.id] || [],
    }))

    return NextResponse.json({ receipts: enriched })
  } catch (error) {
    console.error('[portal/receipts GET] Failed:', error)
    return NextResponse.json({ error: 'Failed to load receipts' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/portal/receipts — create a new receipt with N images
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!member.loyaltyMember) {
      return NextResponse.json(
        {
          error: 'NOT_A_LOYALTY_MEMBER',
          message: 'Join the loyalty program to upload receipts.',
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as CreateBody

    if (!Array.isArray(body.assets) || body.assets.length === 0) {
      return NextResponse.json(
        { error: 'At least one receipt image is required.' },
        { status: 400 }
      )
    }
    if (body.assets.length > MAX_ASSETS_PER_RECEIPT) {
      return NextResponse.json(
        { error: `You can upload at most ${MAX_ASSETS_PER_RECEIPT} images per receipt.` },
        { status: 400 }
      )
    }

    const drinkSlug = body.drinkSlug?.trim() || null
    if (drinkSlug && !ALLOWED_DRINK_SLUGS.has(drinkSlug)) {
      return NextResponse.json({ error: 'Invalid drink' }, { status: 400 })
    }

    // Normalize line items: drop blanks/zeros, dedupe by slug, validate.
    const itemsMap = new Map<string, number>()
    for (const raw of body.items || []) {
      if (!raw || typeof raw.drinkSlug !== 'string') continue
      const slug = raw.drinkSlug.trim()
      if (!ALLOWED_DRINK_SLUGS.has(slug)) {
        return NextResponse.json({ error: `Invalid drink: ${slug}` }, { status: 400 })
      }
      const qty = Math.floor(Number(raw.quantity) || 0)
      if (qty <= 0) continue
      if (qty > MAX_QUANTITY_PER_ITEM) {
        return NextResponse.json(
          {
            error: `Quantity for ${slug} exceeds max (${MAX_QUANTITY_PER_ITEM}).`,
          },
          { status: 400 }
        )
      }
      itemsMap.set(slug, (itemsMap.get(slug) || 0) + qty)
    }
    const claimedItems = Array.from(itemsMap.entries()).map(
      ([drinkSlug, quantity]) => ({ drinkSlug, quantity })
    )

    // Back-populate drink_slug for the legacy admin badge:
    // pick the slug with the highest claimed quantity, fall back to the
    // explicit drinkSlug, then null.
    const topItem = [...claimedItems].sort((a, b) => b.quantity - a.quantity)[0]
    const resolvedDrinkSlug = topItem?.drinkSlug || drinkSlug || null

    // Ownership gate: every s3 key must live under this user's prefix.
    const ownsAllAssets = body.assets.every((a) =>
      typeof a.s3Key === 'string' &&
      a.s3Key.startsWith(`user-uploads/${member.authUserId}/`)
    )
    if (!ownsAllAssets) {
      return NextResponse.json(
        { error: 'One or more files do not belong to your account.' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    // Sort assets by client-provided displayOrder to determine the "cover".
    const orderedAssets = [...body.assets]
      .map((a, i) => ({ ...a, displayOrder: a.displayOrder ?? i }))
      .sort((a, b) => a.displayOrder - b.displayOrder)
    const coverUrl = orderedAssets[0].url

    const { data: receipt, error: receiptError } = await admin
      .from('loyalty_receipts')
      .insert({
        member_id: member.loyaltyMember.id,
        image_url: coverUrl,
        status: 'pending',
        drink_slug: resolvedDrinkSlug,
        claimed_items: claimedItems,
      })
      .select('*')
      .single()

    if (receiptError || !receipt) {
      console.error('[portal/receipts POST] Insert receipt failed:', receiptError)
      return NextResponse.json(
        { error: 'Failed to save receipt', details: receiptError?.message },
        { status: 500 }
      )
    }

    const assetRows = orderedAssets.map((a, i) => ({
      receipt_id: receipt.id,
      s3_key: a.s3Key,
      url: a.url,
      mime_type: a.mimeType || null,
      width: a.width ?? null,
      height: a.height ?? null,
      file_size_bytes: a.fileSizeBytes ?? null,
      display_order: i,
    }))

    const { data: assets, error: assetError } = await admin
      .from('loyalty_receipt_assets')
      .insert(assetRows)
      .select('*')

    if (assetError) {
      console.error('[portal/receipts POST] Insert assets failed:', assetError)
      // Rollback the parent receipt so we don't leave an empty row.
      await admin.from('loyalty_receipts').delete().eq('id', receipt.id)
      return NextResponse.json(
        {
          error: 'Failed to save receipt images',
          details: assetError.message,
          code: assetError.code,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      receipt: { ...receipt, assets: assets || [] },
    })
  } catch (error) {
    console.error('[portal/receipts POST] Failed:', error)
    return NextResponse.json({ error: 'Receipt upload failed' }, { status: 500 })
  }
}
