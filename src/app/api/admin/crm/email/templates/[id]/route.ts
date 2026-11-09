export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canDraftMarketing } from '@/lib/auth/resolve-staff'
import { sanitizeBlocks } from '@/lib/email/blocks'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('email_templates').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ template: data })
}

/** Update fields, or archive/unarchive with { is_archived }. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDraftMarketing(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_by: staff.id }
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 120)
  if (typeof body.description === 'string') patch.description = body.description.slice(0, 500)
  if (typeof body.subject === 'string') patch.subject = body.subject.slice(0, 300)
  if (typeof body.preheader === 'string') patch.preheader = body.preheader.slice(0, 300)
  if (body.blocks !== undefined) patch.blocks = sanitizeBlocks(body.blocks)
  if (typeof body.is_archived === 'boolean') patch.is_archived = body.is_archived

  const admin = createAdminClient()
  const { data, error } = await admin.from('email_templates').update(patch).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await logStaffAction(staff.id, body.is_archived === true ? 'template.archive' : 'template.update', 'email_template', id)
  return NextResponse.json({ template: data })
}
