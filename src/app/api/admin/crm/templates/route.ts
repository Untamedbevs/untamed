export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { parseTemplateInput } from '@/lib/crm/template-input'

/** GET ?kind=campaign|transactional&archived=1 */
export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const kind = request.nextUrl.searchParams.get('kind')
  const includeArchived = request.nextUrl.searchParams.get('archived') === '1'

  let q = createAdminClient().from('email_templates').select('*').order('name')
  if (kind === 'campaign' || kind === 'transactional') q = q.eq('kind', kind)
  if (!includeArchived) q = q.eq('is_archived', false)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data || [] })
}

export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseTemplateInput(await request.json(), { requireAll: true })
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('email_templates')
    .insert({ ...parsed.value, created_by: staff.id })
    .select('*')
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'A template with that slug already exists' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ template: data })
}
