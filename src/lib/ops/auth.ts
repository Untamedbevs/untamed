import { NextResponse } from 'next/server'

export function authorizeOps(request: Request): NextResponse | null {
  const expected = process.env.CE_OPS_SECRET?.trim()
  if (!expected) {
    return NextResponse.json({ error: 'CE_OPS_SECRET is not configured' }, { status: 503 })
  }
  const header = request.headers.get('authorization') || ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  const alt = request.headers.get('x-ce-ops-secret')?.trim() || ''
  if (bearer === expected || alt === expected) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
