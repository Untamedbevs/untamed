export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts } from '@/lib/auth/resolve-staff'

const PAGE_SIZE = 50

/**
 * Contact search for staff.
 * Query: q (email or name), list (slug), status ('subscribed' | 'unsubscribed'
 * with list), suppressed ('1'), page.
 */
export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const params = request.nextUrl.searchParams
  const q = (params.get('q') || '').trim().slice(0, 200)
  const list = params.get('list') || ''
  const status = params.get('status') === 'unsubscribed' ? 'unsubscribed' : 'subscribed'
  const suppressedOnly = params.get('suppressed') === '1'
  const page = Math.max(0, parseInt(params.get('page') || '0', 10) || 0)

  const admin = createAdminClient()

  if (suppressedOnly) {
    // Page through the suppression list itself; a deleted contact still shows.
    const { data: rows, count, error } = await admin
      .from('email_suppressions')
      .select('email, reason, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const emails = (rows || []).map((r) => r.email.toLowerCase())
    const { data: contacts } = emails.length
      ? await admin
          .from('email_contacts')
          .select('id, email, first_name, last_name, sources, first_source, age_verified_at, country_code, repermission_sent_at, created_at, email_consents(list_slug, status)')
          .in('email', emails)
      : { data: [] }
    const byEmail = new Map((contacts || []).map((c) => [c.email, c]))

    return NextResponse.json({
      contacts: (rows || []).map((r) => {
        const email = r.email.toLowerCase()
        const c = byEmail.get(email)
        return c
          ? { ...c, suppression: r.reason }
          : {
              id: null, email, first_name: null, last_name: null, sources: [], first_source: null,
              age_verified_at: null, country_code: null, repermission_sent_at: null,
              created_at: r.created_at, email_consents: [], suppression: r.reason,
            }
      }),
      total: count || 0,
      page,
      pageSize: PAGE_SIZE,
      summary: page === 0 ? await summary(admin) : undefined,
    })
  }

  const consentSelect = list
    ? 'email_consents!inner(list_slug, status)'
    : 'email_consents(list_slug, status)'

  let query = admin
    .from('email_contacts')
    .select(
      `id, email, first_name, last_name, sources, first_source, age_verified_at, country_code, repermission_sent_at, created_at, ${consentSelect}`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (q) {
    // Strip PostgREST filter syntax characters from free text.
    const safe = q.replace(/[,()*%\\]/g, ' ').trim()
    if (safe) {
      query = query.or(`email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`)
    }
  }
  if (list) {
    query = query.eq('email_consents.list_slug', list).eq('email_consents.status', status)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const emails = (data || []).map((c) => c.email)
  const suppressionByEmail = new Map<string, string>()
  if (emails.length > 0) {
    const { data: rows } = await admin.from('email_suppressions').select('email, reason').in('email', emails)
    for (const r of rows || []) suppressionByEmail.set(r.email.toLowerCase(), r.reason)
  }

  return NextResponse.json({
    contacts: (data || []).map((c) => ({
      ...c,
      suppression: suppressionByEmail.get(c.email) || null,
    })),
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
    summary: page === 0 ? await summary(admin) : undefined,
  })
}

async function summary(admin: ReturnType<typeof createAdminClient>) {
  const [{ count: contacts }, { count: suppressed }, { data: lists }] = await Promise.all([
    admin.from('email_contacts').select('id', { count: 'exact', head: true }),
    admin.from('email_suppressions').select('id', { count: 'exact', head: true }),
    admin.from('email_lists').select('slug, name, audience, is_active').order('sort_order'),
  ])

  const listCounts = await Promise.all(
    (lists || []).map(async (l) => {
      const { count } = await admin
        .from('email_consents')
        .select('contact_id', { count: 'exact', head: true })
        .eq('list_slug', l.slug)
        .eq('status', 'subscribed')
      return { ...l, subscribed: count || 0 }
    })
  )

  return { contacts: contacts || 0, suppressed: suppressed || 0, lists: listCounts }
}
