import { createAdminClient } from '@/lib/supabase/admin'
import { mailboxKey } from '@/lib/referral/helpers'

/**
 * The suppression keys for an address: the address itself and its mailbox
 * key (+tag removed; Gmail dots and googlemail.com folded). addSuppression
 * stores both, so an opt-out also covers the aliases that reach the same inbox.
 */
export function suppressionKeys(email: string): string[] {
  const exact = email.toLowerCase().trim()
  return [...new Set([exact, mailboxKey(exact)])]
}

/**
 * Filter out suppressed emails from a recipient list.
 * Queries the email_suppressions table and removes any matches.
 */
export async function filterSuppressed<T extends { email: string }>(
  recipients: T[]
): Promise<{ allowed: T[]; suppressed: T[] }> {
  if (recipients.length === 0) return { allowed: [], suppressed: [] }

  const emails = [...new Set(recipients.flatMap((r) => suppressionKeys(r.email)))]
  const supabase = createAdminClient()

  const CHUNK = 500
  const suppressedSet = new Set<string>()

  for (let i = 0; i < emails.length; i += CHUNK) {
    const batch = emails.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('email_suppressions')
      .select('email')
      .in('email', batch)

    // Failing open would mail people who opted out, so a lookup error aborts.
    if (error) {
      throw new Error(`Suppression lookup failed: ${error.message}`)
    }
    for (const row of data || []) {
      suppressedSet.add(row.email.toLowerCase())
    }
  }

  const allowed: T[] = []
  const suppressed: T[] = []

  for (const r of recipients) {
    if (suppressionKeys(r.email).some((k) => suppressedSet.has(k))) {
      suppressed.push(r)
    } else {
      allowed.push(r)
    }
  }

  return { allowed, suppressed }
}

/** True when the address is on the suppression list (any reason). */
export async function isSuppressed(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('email_suppressions')
    .select('id')
    .in('email', suppressionKeys(email))
    .limit(1)
  if (error) throw new Error(`Suppression lookup failed: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * Add an email to the suppression list.
 * Uses upsert to avoid duplicates. Prefer `applyConsent()` from
 * `@/lib/messaging/consent`, which also records the consent evidence; this is
 * the fallback when that path is unavailable.
 */
export async function addSuppression(params: {
  email: string
  reason: 'hard_bounce' | 'complaint' | 'manual' | 'unsubscribe' | 'data_deletion'
  sourceMessageId?: string
  notes?: string
  throwOnError?: boolean
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('email_suppressions')
    .upsert(
      suppressionKeys(params.email).map((email) => ({
        email,
        reason: params.reason,
        source_message_id: params.sourceMessageId || null,
        notes: params.notes || null,
      })),
      { onConflict: 'email', ignoreDuplicates: true }
    )

  if (error) {
    console.error('[Suppressions] Failed to add suppression:', error.message)
    if (params.throwOnError) throw new Error(`Failed to add suppression: ${error.message}`)
  }
}
