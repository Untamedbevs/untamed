import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Filter out suppressed emails from a recipient list.
 * Queries the email_suppressions table and removes any matches.
 */
export async function filterSuppressed<T extends { email: string }>(
  recipients: T[]
): Promise<{ allowed: T[]; suppressed: T[] }> {
  if (recipients.length === 0) return { allowed: [], suppressed: [] }

  const emails = [...new Set(recipients.map((r) => r.email.toLowerCase()))]
  const supabase = createAdminClient()

  const CHUNK = 500
  const suppressedSet = new Set<string>()

  for (let i = 0; i < emails.length; i += CHUNK) {
    const batch = emails.slice(i, i + CHUNK)
    const { data } = await supabase
      .from('email_suppressions')
      .select('email')
      .in('email', batch)

    if (data) {
      for (const row of data) {
        suppressedSet.add(row.email.toLowerCase())
      }
    }
  }

  const allowed: T[] = []
  const suppressed: T[] = []

  for (const r of recipients) {
    if (suppressedSet.has(r.email.toLowerCase())) {
      suppressed.push(r)
    } else {
      allowed.push(r)
    }
  }

  return { allowed, suppressed }
}

/**
 * Add an email to the suppression list.
 * Uses upsert to avoid duplicates.
 */
export async function addSuppression(params: {
  email: string
  reason: 'hard_bounce' | 'complaint' | 'manual' | 'unsubscribe'
  sourceMessageId?: string
  notes?: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('email_suppressions')
    .upsert(
      {
        email: params.email.toLowerCase().trim(),
        reason: params.reason,
        source_message_id: params.sourceMessageId || null,
        notes: params.notes || null,
      },
      { onConflict: 'email', ignoreDuplicates: true }
    )

  if (error) {
    console.error('[Suppressions] Failed to add suppression:', error.message)
  }
}
