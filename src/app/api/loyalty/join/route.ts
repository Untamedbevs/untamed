import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { visitorId, email, firstName, drinkSlug } = body

    if (!visitorId || !email) {
      return NextResponse.json(
        { error: 'visitorId and email are required' },
        { status: 400 }
      )
    }

    const origin = request.nextUrl.origin
    const identifyRes = await fetch(`${origin}/api/tracking/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, email, firstName, drinkSlug }),
    })

    if (!identifyRes.ok) {
      const err = await identifyRes.json()
      return NextResponse.json(err, { status: identifyRes.status })
    }

    const result = await identifyRes.json()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Join failed' }, { status: 500 })
  }
}
