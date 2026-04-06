import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

const VALID_ROLES = ['super_admin', 'admin', 'contractor_full', 'contractor_limited']
const VALID_SPECIALTIES = ['sales', 'fulfillment', 'marketing', 'production', 'customer_service', 'other']

async function requireSuperAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff || staff.role !== 'super_admin') return null
  return staff
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireSuperAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const supabase = createAdminClient()

  const allowed = ['full_name', 'email', 'role', 'is_active', 'contractor_specialty']
  const update: Record<string, unknown> = {}

  for (const field of allowed) {
    if (body[field] !== undefined) {
      update[field] = body[field]
    }
  }

  if (update.role && !VALID_ROLES.includes(update.role as string)) {
    return NextResponse.json({ error: `Invalid role` }, { status: 400 })
  }
  if (update.contractor_specialty && !VALID_SPECIALTIES.includes(update.contractor_specialty as string)) {
    return NextResponse.json({ error: `Invalid specialty` }, { status: 400 })
  }

  const isContractorRole =
    (update.role as string) === 'contractor_full' ||
    (update.role as string) === 'contractor_limited'

  if (update.role && !isContractorRole) {
    update.contractor_specialty = null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (id === caller.id && update.role && update.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'You cannot demote yourself' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('staff')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireSuperAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  if (id === caller.id) {
    return NextResponse.json(
      { error: 'You cannot deactivate yourself' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
