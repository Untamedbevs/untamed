export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canDraftMarketing } from '@/lib/auth/resolve-staff'
import { sanitizeBlocks } from '@/lib/email/blocks'
import { logStaffAction } from '@/lib/audit'

const CATEGORIES = ['campaign', 'flow', 'outreach']

export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const category = request.nextUrl.searchParams.get('category')
  const includeArchived = request.nextUrl.searchParams.get('archived') === '1'
  const admin = createAdminClient()
  let query = admin
    .from('email_templates')
    .select('id, name, description, category, subject, preheader, blocks, is_archived, updated_at')
    .order('updated_at', { ascending: false })
  if (category && CATEGORIES.includes(category)) query = query.eq('category', category)
  if (!includeArchived) query = query.eq('is_archived', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data || [] })
}

export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDraftMarketing(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_templates')
    .insert({
      name,
      description: typeof body.description === 'string' ? body.description.slice(0, 500) : null,
      category: CATEGORIES.includes(body.category) ? body.category : 'campaign',
      subject: typeof body.subject === 'string' ? body.subject.slice(0, 300) : '',
      preheader: typeof body.preheader === 'string' ? body.preheader.slice(0, 300) : null,
      blocks: sanitizeBlocks(body.blocks),
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staff.id, 'template.create', 'email_template', data.id, { name })
  return NextResponse.json({ template: data })
}
