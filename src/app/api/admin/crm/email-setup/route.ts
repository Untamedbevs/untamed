export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { resolveStaff, canDraftMarketing, canSendMarketing } from '@/lib/auth/resolve-staff'
import { getMarketingReadiness } from '@/lib/email/config'
import { getEmailSettings } from '@/lib/email/settings'
import { getEmailLists } from '@/lib/messaging/consent'
import {
  REPERMISSION_COPY,
  REPERMISSION_COPY_VERSION,
  isRepermissionCopyApproved,
} from '@/lib/email/consent-copy'

/**
 * What staff need to know before sending: setup problems, the kill switch,
 * lists, approval threshold, their permissions, and the permission-request copy.
 */
export async function GET() {
  const staff = await resolveStaff()
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let lists: Awaited<ReturnType<typeof getEmailLists>> = []
  let listsError: string | null = null
  try {
    lists = await getEmailLists()
  } catch (err) {
    listsError = err instanceof Error ? err.message : 'Could not load lists'
  }

  const readiness = getMarketingReadiness()
  if (listsError) {
    readiness.ready = false
    readiness.issues.unshift('Email lists could not be loaded. Have migrations 00027 and 00028 been applied?')
  }
  const settings = await getEmailSettings()
  if (settings.marketing_paused) {
    readiness.ready = false
    readiness.issues.unshift(
      `Marketing is paused${settings.marketing_paused_reason ? `: ${settings.marketing_paused_reason}` : ''}. Resume it on the email dashboard.`
    )
  }

  return NextResponse.json({
    readiness,
    lists,
    settings: {
      approvalThreshold: settings.approval_threshold,
      weeklyFrequencyCap: settings.weekly_frequency_cap,
      quietHours: [settings.quiet_hours_start, settings.quiet_hours_end],
      marketingPaused: settings.marketing_paused,
    },
    permissions: {
      canDraft: canDraftMarketing(staff.role),
      canSend: canSendMarketing(staff.role),
    },
    repermission: {
      version: REPERMISSION_COPY_VERSION,
      approved: isRepermissionCopyApproved(),
      copy: REPERMISSION_COPY,
    },
  })
}
