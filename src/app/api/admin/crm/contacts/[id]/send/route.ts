export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canViewContacts } from '@/lib/auth/resolve-staff'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'
import { sendAsStaff, SuppressedRecipientError } from '@/lib/gmail/send'
import { replySubject } from '@/lib/gmail/outreach'

/**
 * One-to-one email to a contact from the signed-in staff member's address.
 * Body: { subject, body, replyToMessageId? } where replyToMessageId is an
 * `email_messages` id in this contact's conversation to reply to.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { subject?: string; body?: string; replyToMessageId?: string }
  let subject = (body.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
  const text = (body.body || '').trim()
  if (!text) return NextResponse.json({ error: 'Write a message first' }, { status: 400 })
  if (text.length > 20_000) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

  const admin = createAdminClient()
  const { data: contact } = await admin.from('email_contacts').select('id, email').eq('id', id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  // Replying: thread headers always; the Gmail thread id only belongs to
  // the mailbox it came from, so it's used only when that's the sender's.
  let threadId: string | null = null
  let inReplyTo: string | null = null
  if (body.replyToMessageId) {
    if (!isUuid(body.replyToMessageId)) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    const { data: original } = await admin
      .from('email_messages')
      .select('id, subject, email_contact_id, to_email, from_email, mailbox, gmail_thread_id, rfc_message_id')
      .eq('id', body.replyToMessageId)
      .maybeSingle()
    const belongs =
      original &&
      (original.email_contact_id === contact.id ||
        original.to_email === contact.email ||
        (original.from_email || '').toLowerCase() === contact.email)
    if (!original || !belongs) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    inReplyTo = original.rfc_message_id || null
    if (original.mailbox && original.mailbox === staff.email.trim().toLowerCase()) threadId = original.gmail_thread_id || null
    if (!subject) subject = replySubject(original.subject || '')
  }
  if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })

  try {
    const result = await sendAsStaff({
      staff: { id: staff.id, email: staff.email, full_name: staff.full_name },
      to: contact.email,
      subject,
      body: text,
      contactId: contact.id,
      threadId,
      inReplyTo,
      references: inReplyTo,
    })
    await logStaffAction(staff.id, 'outreach.send_one', 'email_contact', contact.id, {
      subject,
      transport: result.transport,
      reply: !!body.replyToMessageId,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof SuppressedRecipientError) {
      return NextResponse.json({ error: 'This address is suppressed (unsubscribed, bounced, or blocked), so it can’t be emailed.' }, { status: 409 })
    }
    const message = err instanceof Error ? err.message : 'Send failed'
    console.error(`[contacts/send] ${contact.id}:`, message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
