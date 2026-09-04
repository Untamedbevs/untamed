import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { geocodeQuery } from '@/lib/retail/geocode'

export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await request.json()) as { query?: string }
    const query = body.query?.trim() || ''
    if (query.length < 3) {
      return NextResponse.json({ error: 'Enter a street address, city, or ZIP' }, { status: 400 })
    }
    const candidates = await geocodeQuery(query)
    return NextResponse.json({ candidates })
  } catch {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
