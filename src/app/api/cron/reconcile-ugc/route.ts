import { NextRequest, NextResponse } from 'next/server'
import { reconcileStuckVideoAssets } from '@/lib/video/mediaconvert'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Reconciles UGC video assets whose MediaConvert outputs have landed in S3 but
 * whose DB row is still `processing`/`uploaded`. Replaces the old Lambda
 * `processing-complete` webhook. Idempotent -- safe to run frequently.
 *
 * Also accepts a manual GET (with CRON_SECRET) for on-demand reconciliation.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await reconcileStuckVideoAssets()
  return NextResponse.json({ ok: true, ...result })
}
