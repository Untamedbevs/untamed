import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { reconcileStuckVideoAssets } from '@/lib/video/mediaconvert'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * True only when CRON_SECRET is set and the request carries it as
 * `Authorization: Bearer <secret>` (Vercel Cron sends exactly that). A missing
 * or empty CRON_SECRET refuses every request instead of skipping the check.
 */
function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/reconcile-ugc] CRON_SECRET is not set; refusing request')
    return false
  }
  // Hash both sides so the comparison is constant-time regardless of length.
  const given = createHash('sha256').update(request.headers.get('authorization') ?? '').digest()
  const expected = createHash('sha256').update(`Bearer ${cronSecret}`).digest()
  return timingSafeEqual(given, expected)
}

/**
 * Reconciles UGC video assets whose MediaConvert outputs have landed in S3 but
 * whose DB row is still `processing`/`uploaded`. Replaces the old Lambda
 * `processing-complete` webhook. Idempotent -- safe to run frequently.
 *
 * Also accepts a manual GET (with CRON_SECRET) for on-demand reconciliation.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await reconcileStuckVideoAssets()
  return NextResponse.json({ ok: true, ...result })
}
