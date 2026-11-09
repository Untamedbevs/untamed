/**
 * Cron: send due automated-flow emails (every 10 minutes).
 * Requires `CRON_SECRET`; refuses every request while it is unset.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth/cron-auth'
import { runFlows } from '@/lib/email/flows'
import { dayKey, raiseAlert } from '@/lib/email/alerts'

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request, 'cron/email-flows')) {
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
