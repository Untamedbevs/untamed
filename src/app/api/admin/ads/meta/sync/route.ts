import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { isMetaAdsConfigured } from '@/lib/ads/meta-graph'
import { syncMetaSpendToDaily } from '@/lib/ads/meta-sync'

export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isMetaAdsConfigured()) {
    return NextResponse.json({ error: 'Meta Ads API is not configured' }, { status: 400 })
  }

  const days = Math.min(90, Math.max(7, Number(request.nextUrl.searchParams.get('days')) || 30))

  try {
    const result = await syncMetaSpendToDaily(days)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
