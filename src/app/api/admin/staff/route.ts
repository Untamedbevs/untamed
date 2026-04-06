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

export async function GET() {
  const caller = await requireSuperAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { email, full_name, role, password, contractor_specialty, auth_user_id } = body

  if (!full_name?.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }
  if (contractor_specialty && !VALID_SPECIALTIES.includes(contractor_specialty)) {
    return NextResponse.json({ error: `Invalid specialty. Must be one of: ${VALID_SPECIALTIES.join(', ')}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  // If linking to an existing auth user, pull their email
  let resolvedEmail = email?.trim().toLowerCase()
  let resolvedAuthUserId: string | null = auth_user_id || null

  if (auth_user_id) {
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(auth_user_id)
    if (authErr || !authUser?.user) {
      return NextResponse.json({ error: 'Auth user not found' }, { status: 404 })
    }
    resolvedEmail = resolvedEmail || authUser.user.email?.toLowerCase()

    const { data: alreadyLinked } = await supabase
      .from('staff')
      .select('id')
      .eq('auth_user_id', auth_user_id)
      .limit(1)

    if (alreadyLinked && alreadyLinked.length > 0) {
      return NextResponse.json({ error: 'This auth user is already linked to a staff member' }, { status: 409 })
    }
  }

  if (!resolvedEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const { data: existingByEmail } = await supabase
    .from('staff')
    .select('id')
    .eq('email', resolvedEmail)
    .limit(1)

  if (existingByEmail && existingByEmail.length > 0) {
    return NextResponse.json({ error: 'A staff member with this email already exists' }, { status: 409 })
  }

  // If no auth_user_id and a password was provided, create a new auth user
  if (!resolvedAuthUserId && password?.trim()) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: resolvedEmail,
      password: password.trim(),
      email_confirm: true,
      user_metadata: { full_name, role },
    })
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create auth account' },
        { status: 500 }
      )
    }
    resolvedAuthUserId = authData.user.id
  }

  const isContractor = role === 'contractor_full' || role === 'contractor_limited'

  const { data, error } = await supabase
    .from('staff')
    .insert({
      email: resolvedEmail,
      full_name: full_name.trim(),
      role,
      auth_user_id: resolvedAuthUserId,
      contractor_specialty: isContractor ? (contractor_specialty || null) : null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
