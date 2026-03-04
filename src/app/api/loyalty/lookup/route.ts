import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: member } = await supabase
      .from('loyalty_members')
      .select('*')
      .eq('email', normalizedEmail)
      .single()

    if (!member) {
      return NextResponse.json({ found: false })
    }

    const { data: transactions } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: receipts } = await supabase
      .from('loyalty_receipts')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      found: true,
      member,
      transactions: transactions || [],
      receipts: receipts || [],
    })
  } catch {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
