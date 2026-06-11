import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'archived']).optional(),
  admin_notes: z.string().max(5000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updates: Record<string, unknown> = {}

    if (parsed.data.status) {
      updates.status = parsed.data.status
      if (parsed.data.status === 'replied') {
        updates.replied_at = new Date().toISOString()
      }
    }
    if (parsed.data.admin_notes !== undefined) {
      updates.admin_notes = parsed.data.admin_notes
    }

    const { error } = await supabase
      .from('contact_submissions')
      .update(updates)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
