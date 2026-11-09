/**
 * Cron: Gmail sync (every 10 minutes, see vercel.json).
 *
 * Processes the unsubscribe@ mailbox, then logs staff conversations with
 * known contacts and ends outreach for anyone who replied. Details in
 * `src/lib/gmail/sync.ts` and docs/email/gmail-and-outreach.md.
 *
 * Guarded by `CRON_SECRET` (set in env) when present.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { isGmailConfigured } from '@/lib/gmail/client'
import { runGmailSync } from '@/lib/gmail/sync'
import { dayKey, raiseAlert } from '@/lib/email/alerts'

/** Stop starting new work after this long so the run ends inside maxDuration. */
const TIME_BUDGET_MS = 45_000

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isGmailConfigured()) {
    return NextResponse.json({ skipped: 'not configured' })
  }

  try {
    const result = await runGmailSync(Date.now() + TIME_BUDGET_MS)

    const problems = [
      ...(result.unsubscribe ? [result.unsubscribe] : []),
      ...result.mailboxes,
    ].filter((r) => r.error || r.failed > 0)
    if (problems.length > 0) {
      await raiseAlert({
        kind: 'gmail_sync_failure',
        severity: problems.some((p) => p.mailbox === result.unsubscribe?.mailbox) ? 'critical' : 'warning',
        message: `Gmail sync had problems with ${problems.map((p) => p.mailbox).join(', ')}`,
        details: {
          problems: problems.map((p) => ({ mailbox: p.mailbox, error: p.error || null, failed: p.failed })),
        },
        dedupeKey: dayKey('gmail_sync'),
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/gmail-sync] failed:', message)
    await raiseAlert({
      kind: 'gmail_sync_failure',
      severity: 'critical',
      message: `Gmail sync failed: ${message}`,
      dedupeKey: dayKey('gmail_sync'),
    })
    return NextResponse.json({ error: 'Gmail sync failed' }, { status: 500 })
  }
}
