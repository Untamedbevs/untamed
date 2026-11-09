/**
 * Cron: outreach sequences (every 15 minutes, see vercel.json).
 *
 * Sends each due sequence step from the enrolling staff member's mailbox
 * after re-checking replies, suppression, and the sender's daily cap.
 * Details in `src/lib/gmail/outreach-run.ts`.
 *
 * Guarded by `CRON_SECRET` (set in env) when present.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { runOutreach } from '@/lib/gmail/outreach-run'
import { dayKey, raiseAlert } from '@/lib/email/alerts'

/** Stop starting new sends after this long so the run ends inside maxDuration. */
const TIME_BUDGET_MS = 45_000

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await runOutreach(Date.now() + TIME_BUDGET_MS)
    if (result.failed > 0 || result.errors.length > 0) {
      await raiseAlert({
        kind: 'outreach_failure',
        severity: 'warning',
        message: `Outreach: ${result.failed} step(s) failed to send and will retry in an hour`,
        details: { errors: result.errors },
        dedupeKey: dayKey('outreach_failure'),
      })
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/outreach] failed:', message)
    await raiseAlert({
      kind: 'outreach_failure',
      severity: 'warning',
      message: `Outreach run failed: ${message}`,
      dedupeKey: dayKey('outreach_failure'),
    })
    return NextResponse.json({ error: 'Outreach run failed' }, { status: 500 })
  }
}
