import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

/**
 * GET /api/admin/staff/auth-users
 * Lists all Supabase auth users and indicates which are already linked to staff rows.
 */
export async function GET() {
  const caller = await requireSuperAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = createAdminClient()

  const { data: authList, error: authError } = await supabase.auth.admin.listUsers()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const { data: staffRows } = await supabase
    .from('staff')
    .select('auth_user_id, full_name')

  const staffByAuthId = new Map(
    (staffRows || [])
      .filter(s => s.auth_user_id)
      .map(s => [s.auth_user_id, s.full_name])
  )

  const users = (authList.users || []).map(u => ({
    id: u.id,
    email: u.email || '',
    full_name: u.user_metadata?.full_name || u.user_metadata?.name || '',
    created_at: u.created_at,
    is_linked: staffByAuthId.has(u.id),
    linked_staff_name: staffByAuthId.get(u.id) || null,
  }))

  return NextResponse.json(users)
}

/**
 * PUT /api/admin/staff/auth-users
 * Update an auth user's metadata (full_name).
 * Body: { auth_user_id: string, full_name: string }
 */
export async function PUT(request: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { auth_user_id, full_name } = await request.json()

  if (!auth_user_id || typeof full_name !== 'string') {
    return NextResponse.json({ error: 'auth_user_id and full_name are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.updateUserById(auth_user_id, {
    user_metadata: { full_name: full_name.trim() },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email || '',
    full_name: data.user.user_metadata?.full_name || '',
  })
}
