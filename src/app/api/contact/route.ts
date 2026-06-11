import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const SUBJECTS = ['general', 'partnership', 'media', 'distribution', 'support', 'feedback'] as const

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required'),
  subject: z.enum(SUBJECTS),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
  // Honeypot — bots fill this, humans don't see it
  website: z.string().max(0, 'Invalid submission').optional(),
})

// Simple in-memory rate limit: max 3 submissions per IP per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 3

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) return true

  entry.count++
  return false
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    // Honeypot check — if website field has content, it's a bot
    if (parsed.data.website) {
      // Silently accept to not tip off bots, but don't store
      return NextResponse.json({ success: true })
    }

    const data = parsed.data
    const supabase = createAdminClient()

    const { error: insertError } = await supabase
      .from('contact_submissions')
      .insert({
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        subject: data.subject,
        message: data.message.trim(),
        ip_address: ip !== 'unknown' ? ip : null,
        user_agent: request.headers.get('user-agent') || null,
      })

    if (insertError) throw insertError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact] Failed:', err)
    return NextResponse.json({ error: 'Failed to submit message' }, { status: 500 })
  }
}
