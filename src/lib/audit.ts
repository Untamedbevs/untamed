/**
 * Staff audit log for sensitive actions (sends, approvals, consent and data
 * requests, flow and settings changes). Best-effort: never throws.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export async function logStaffAction(
  staffId: string | null,
  action: string,
  entityType?: string | null,
  entityId?: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('staff_audit_log').insert({
      staff_id: staffId,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details,
    })
    if (error) console.error('[audit] insert failed:', error.message)
  } catch (err) {
    console.error('[audit] failed:', err instanceof Error ? err.message : err)
  }
}
