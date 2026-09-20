import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { isMetaAdsConfigured } from '@/lib/ads/meta-graph'
import { bootstrapFlRetailCampaigns } from '@/lib/ads/meta-bootstrap'

export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isMetaAdsConfigured()) {
    return NextResponse.json({ error: 'Meta Ads API is not configured' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as { confirm?: boolean }
  if (!body.confirm) {
    return NextResponse.json(
      { error: 'Pass { confirm: true } to create paused Florida retail campaigns' },
      { status: 400 }
    )
  }

  try {
    const result = await bootstrapFlRetailCampaigns()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bootstrap failed' },
      { status: 500 }
    )
  }
}
