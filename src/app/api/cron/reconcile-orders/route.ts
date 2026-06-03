import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { accelPayConfigured, fetchRecentSales } from '@/lib/shop/accelpay-api'
import { creditOnlineOrder, parseAccelPaySale } from '@/lib/loyalty/orders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Safety-net reconciliation: pulls recently completed AccelPay sales and credits
 * any the `new_order` webhook missed. Crediting is idempotent (unique sale id),
 * so re-processing already-recorded sales is a no-op.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!accelPayConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'ACCELPAY_API_TOKEN not set' })
  }

  // Look back 3 days by default; AccelPay times are UTC unix seconds.
  const lookbackHours = Number(
    new URL(request.url).searchParams.get('hours') || '72'
  )
  const startTime = Math.floor(Date.now() / 1000) - lookbackHours * 3600

  let sales: any[]
  try {
    sales = await fetchRecentSales({ startTime, saleStatus: 'complete', limit: 150 })
  } catch (err) {
    console.error('[cron/reconcile-orders] fetch failed:', err)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }

  const admin = createAdminClient()
  let credited = 0
  let pending = 0
  let duplicate = 0
  let skipped = 0

  for (const raw of sales) {
    const sale = parseAccelPaySale(raw)
    if (!sale) {
      skipped++
      continue
    }
    try {
      const result = await creditOnlineOrder(admin, sale)
      if (result.status === 'credited') credited++
      else if (result.status === 'pending') pending++
      else duplicate++
    } catch (err) {
      console.error('[cron/reconcile-orders] credit failed for sale', sale.saleId, err)
      skipped++
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: sales.length,
    credited,
    pending,
    duplicate,
    skipped,
  })
}
