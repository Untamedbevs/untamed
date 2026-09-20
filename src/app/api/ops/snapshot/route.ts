import { NextResponse } from 'next/server'
import { authorizeOps } from '@/lib/ops/auth'
import { buildUntamedSnapshot } from '@/lib/ops/snapshot'

export async function GET(request: Request) {
  const denied = authorizeOps(request)
  if (denied) return denied
  try {
    return NextResponse.json(await buildUntamedSnapshot())
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
