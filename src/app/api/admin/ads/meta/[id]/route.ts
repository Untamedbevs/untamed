import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { isMetaAdsConfigured } from '@/lib/ads/meta-graph'
import { updateEntityStatus } from '@/lib/ads/meta-client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isMetaAdsConfigured()) {
    return NextResponse.json({ error: 'Meta Ads API is not configured' }, { status: 400 })
  }

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as { status?: string }
  if (body.status !== 'ACTIVE' && body.status !== 'PAUSED') {
    return NextResponse.json({ error: 'status must be ACTIVE or PAUSED' }, { status: 400 })
  }

  try {
    const result = await updateEntityStatus(id, body.status)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    )
  }
}
