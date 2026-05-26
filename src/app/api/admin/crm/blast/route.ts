export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queryRecipients, type BlastFilters, type BlastRecipient } from '@/lib/crm/blast-filters'
import { getSenderById, DEFAULT_CRM_SENDER } from '@/lib/crm/senders'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { filterSuppressed } from '@/lib/messaging/suppressions'

function recipientVars(r: BlastRecipient): Record<string, string> {
  return {
    first_name: r.firstName || r.name.split(' ')[0] || '',
    name: r.name,
    email: r.email,
  }
}

function applyVariables(text: string, variables: Record<string, string>): string {
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

const MAX_RECIPIENTS = 100_000
const INSERT_CHUNK = 1000
const PARALLEL_INSERTS = 3

export async function POST(request: NextRequest) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filters, subject, textBody, senderId } = (await request.json()) as {
      filters: BlastFilters
      subject: string
      textBody: string
      senderId?: string
    }

    const sender = getSenderById(senderId || DEFAULT_CRM_SENDER.id)

    if (!filters?.audience) {
      return NextResponse.json({ error: 'Audience is required' }, { status: 400 })
    }
    if (!subject?.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }
    if (!textBody?.trim()) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }

    const allRecipients = await queryRecipients(filters)

    if (allRecipients.length === 0) {
      return NextResponse.json({ error: 'No matching recipients' }, { status: 400 })
    }

    if (allRecipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Too many recipients (${allRecipients.length}). Maximum is ${MAX_RECIPIENTS.toLocaleString()}.` },
        { status: 400 }
      )
    }

    const { allowed: recipients, suppressed } = await filterSuppressed(allRecipients)

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: `All ${suppressed.length} recipients are on the suppression list (bounced or complained).` },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()

    const { data: campaign, error: campaignError } = await admin
      .from('messaging_campaigns')
      .insert({
        name: `Blast: ${subject.slice(0, 80)}`,
        channel: 'email',
        subject,
        text_body: textBody,
        sender_id: sender.id,
        audience_filter: filters,
        audience_count: recipients.length,
        status: 'sending',
        sent_count: 0,
        failed_count: 0,
        created_by: staff.id,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (campaignError || !campaign) {
      console.error('[blast] Failed to create campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    const scheduledRows = recipients.map((r) => {
      const vars = recipientVars(r)
      return {
        message_type: 'email',
        recipient_email: r.email,
        recipient_name: r.name,
        subject: applyVariables(subject, vars),
        body: applyVariables(textBody, vars),
        text_body: applyVariables(textBody, vars),
        scheduled_for: now,
        status: 'pending',
        related_entity_type: 'campaign',
        related_entity_id: campaign.id,
        loyalty_member_id: r.loyaltyMemberId || null,
        referral_participant_id: r.referralParticipantId || null,
        distributor_lead_id: r.distributorLeadId || null,
        sender_email: sender.email,
        created_by: staff.id,
      }
    })

    const chunks: (typeof scheduledRows)[] = []
    for (let i = 0; i < scheduledRows.length; i += INSERT_CHUNK) {
      chunks.push(scheduledRows.slice(i, i + INSERT_CHUNK))
    }

    for (let i = 0; i < chunks.length; i += PARALLEL_INSERTS) {
      const batch = chunks.slice(i, i + PARALLEL_INSERTS)
      const results = await Promise.all(
        batch.map((chunk) => admin.from('scheduled_messages').insert(chunk))
      )

      const firstError = results.find((r) => r.error)
      if (firstError?.error) {
        console.error('[blast] Failed to insert scheduled_messages chunk:', firstError.error)
        await admin
          .from('messaging_campaigns')
          .update({ status: 'cancelled', error_log: firstError.error.message })
          .eq('id', campaign.id)
        return NextResponse.json({ error: 'Failed to queue messages' }, { status: 500 })
      }
    }

    console.log(
      `[blast] Queued ${recipients.length} messages for campaign ${campaign.id} (${suppressed.length} suppressed)`
    )

    return NextResponse.json({
      campaignId: campaign.id,
      recipientCount: recipients.length,
      suppressedCount: suppressed.length,
    })
  } catch (error: unknown) {
    console.error('Error creating blast:', error)
    const msg = error instanceof Error ? error.message : 'Failed to create blast'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('messaging_campaigns')
      .select('id, name, subject, sender_id, audience_count, sent_count, failed_count, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaigns: data || [] })
  } catch (error: unknown) {
    console.error('Error listing campaigns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
