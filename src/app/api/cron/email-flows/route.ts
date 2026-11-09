/**
 * Cron: send due automated-flow emails (every 10 minutes).
 * Guarded by `CRON_SECRET` (set in env) when present.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { runFlows } from '@/lib/email/flows'
import { dayKey, raiseAlert } from '@/lib/email/alerts'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await runFlows())
  } catch (err) {
    console.error('[cron/email-flows] failed:', err)
    await raiseAlert({
      kind: 'flow_failure',
      severity: 'critical',
      message: `The automated flows runner crashed: ${err instanceof Error ? err.message : String(err)}`,
      dedupeKey: dayKey('flow_crash'),
    })
    return NextResponse.json({ error: 'Flow run failed' }, { status: 500 })
  }
}
