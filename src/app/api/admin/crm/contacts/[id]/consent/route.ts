export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts, canManageContactData } from '@/lib/auth/resolve-staff'
import { applyConsent, isUuid, requestEvidence } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'

/**
 * Staff consent changes for one contact.
 * Body: { action: 'opt_in' | 'opt_out' | 'unsubscribe_all', lists?: string[],
 *         evidenceNote: string, ageVerified?: boolean }
 *
 * Recording an opt-in is admin-only and needs written evidence of where and
 * how the person agreed (e.g. "signed trade-show sheet, 2026-10-02").
 * Honoring an opt-out is open to any staff who can see contacts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    lists?: string[]
    evidenceNote?: string
    ageVerified?: boolean
  }

  const action = body.action
  if (action !== 'opt_in' && action !== 'opt_out' && action !== 'unsubscribe_all') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const evidenceNote = (body.evidenceNote || '').trim().slice(0, 1000)
  if (action === 'opt_in') {
    if (!canManageContactData(staff.role)) {
      return NextResponse.json({ error: 'Only admins can record an opt-in' }, { status: 403 })
    }
    if (evidenceNote.length < 10) {
      return NextResponse.json(
        { error: 'Describe the evidence: where, when, and how they agreed.' },
        { status: 400 }
      )
    }
  }

  const lists = Array.isArray(body.lists) ? body.lists.filter((l) => typeof l === 'string') : []
  if (action !== 'unsubscribe_all' && lists.length === 0) {
    return NextResponse.json({ error: 'Choose at least one list' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: contact } = await admin.from('email_contacts').select('email').eq('id', id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const evidence = requestEvidence(request.headers)
  try {
    const result = await applyConsent({
      email: contact.email,
      action,
      source: 'admin',
      lists: action === 'unsubscribe_all' ? undefined : lists,
      sourceDetail: `/admin/crm/contacts/${id}`,
      actorStaffId: staff.id,
      evidenceNote: evidenceNote || (action === 'opt_in' ? null : 'Recorded by staff'),
      ageAttested: action === 'opt_in' && body.ageVerified === true,
      ageText: action === 'opt_in' && body.ageVerified === true ? 'Age 21+ confirmed by staff from the evidence above' : null,
      // Staff IP/browser describe who recorded it, not the contact.
      userAgent: evidence.userAgent,
      ipAddress: evidence.ipAddress,
    })
    await logStaffAction(staff.id, `contact.${action}`, 'email_contact', id, { lists, evidenceNote: evidenceNote || null })
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Consent update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
