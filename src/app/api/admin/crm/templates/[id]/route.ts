export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { parseTemplateInput } from '@/lib/crm/template-input'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data, error } = await createAdminClient().from('email_templates').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return NextResponse.json({ template: data })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const parsed = parseTemplateInput(await request.json(), { requireAll: false })
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('email_templates')
    .update(parsed.value)
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    const msg = error.code === '23505' ? 'A template with that slug already exists' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ template: data })
}

/** Archive rather than delete, so past campaigns keep their template link. */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { error } = await createAdminClient()
    .from('email_templates')
    .update({ is_archived: true })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
