/**
 * Records the AccelPay checkout marketing checkbox as an opt-in.
 *
 * Only a ticked box counts, and only once the checkbox wording is approved
 * (see CHECKOUT_CONSENT in `@/lib/email/consent-copy`). An unticked box means
 * "didn't opt in this time", so it never changes existing consent. Never
 * throws: order processing must not fail because of email consent.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { applyConsent } from '@/lib/messaging/consent'
import { CHECKOUT_CONSENT, isCheckoutConsentApproved } from '@/lib/email/consent-copy'

export async function recordCheckoutConsent(sale: {
  saleId: number
  email: string | null
  acceptsMarketing: boolean | null
}): Promise<'recorded' | 'skipped'> {
  if (sale.acceptsMarketing !== true || !sale.email) return 'skipped'
  if (!isCheckoutConsentApproved()) return 'skipped'

  try {
    await applyConsent({
      email: sale.email,
      action: 'opt_in',
      source: 'checkout',
      lists: CHECKOUT_CONSENT.lists,
      sourceDetail: `AccelPay sale ${sale.saleId}`,
      consentText: CHECKOUT_CONSENT.text,
      consentTextVersion: CHECKOUT_CONSENT.version,
      ageAttested: CHECKOUT_CONSENT.ageVerifiedAtCheckout,
      ageText: CHECKOUT_CONSENT.ageVerifiedAtCheckout ? CHECKOUT_CONSENT.ageText : null,
    })
    return 'recorded'
  } catch (err) {
    console.error(`[checkout-consent] sale ${sale.saleId}:`, err instanceof Error ? err.message : err)
    return 'skipped'
  }
}

export interface CheckoutBackfillResult {
  approved: boolean
  /** Distinct buyers with a ticked box on a stored order. */
  tickedBuyers: number
  /** Already recorded from checkout, or later opted out/suppressed: left alone. */
  skipped: number
  /** Would be (dry run) or were recorded. */
  toRecord: number
  recorded: number
}

const PAGE = 1000

/**
 * Record checkout opt-ins from orders placed before the wording was approved.
 * Conservative: anyone suppressed, or who has ever opted out, unsubscribed,
 * complained, or bounced, is skipped so an old tick can't re-subscribe them.
 */
export async function backfillCheckoutConsent(apply: boolean): Promise<CheckoutBackfillResult> {
  const admin = createAdminClient()
  const approved = isCheckoutConsentApproved()

  // Most recent ticked order per buyer.
  const latest = new Map<string, { saleId: number; orderedAt: string | null }>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('loyalty_orders')
      .select('accelpay_sale_id, email, created_at')
      .eq('raw_payload->>buyerAcceptsMarketing', 'true')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Order lookup failed: ${error.message}`)
    for (const o of data || []) {
      const email = (o.email || '').trim().toLowerCase()
      if (email && email !== 'unknown') latest.set(email, { saleId: o.accelpay_sale_id, orderedAt: o.created_at })
    }
    if (!data || data.length < PAGE) break
  }

  const emails = [...latest.keys()]
  const blocked = new Set<string>()
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200)
    const [{ data: suppressed, error: sErr }, { data: events, error: eErr }] = await Promise.all([
      admin.from('email_suppressions').select('email').in('email', chunk),
      admin
        .from('email_consent_events')
        .select('email, action, source')
        .in('email', chunk)
        .or('action.in.(opt_out,unsubscribe_all,complaint,hard_bounce),source.eq.checkout'),
    ])
    if (sErr || eErr) throw new Error(`Consent lookup failed: ${(sErr || eErr)!.message}`)
    for (const r of suppressed || []) blocked.add(r.email.toLowerCase())
    for (const r of events || []) blocked.add(r.email.toLowerCase())
  }

  const todo = emails.filter((e) => !blocked.has(e))
  let recorded = 0
  if (apply && approved) {
    for (const email of todo) {
      const order = latest.get(email)!
      await applyConsent({
        email,
        action: 'opt_in',
        source: 'checkout',
        lists: CHECKOUT_CONSENT.lists,
        sourceDetail: `AccelPay sale ${order.saleId} (ordered ${order.orderedAt?.slice(0, 10) || 'unknown'}; recorded by backfill)`,
        consentText: CHECKOUT_CONSENT.text,
        consentTextVersion: CHECKOUT_CONSENT.version,
        ageAttested: CHECKOUT_CONSENT.ageVerifiedAtCheckout,
        ageText: CHECKOUT_CONSENT.ageVerifiedAtCheckout ? CHECKOUT_CONSENT.ageText : null,
      })
      recorded++
    }
  }

  return {
    approved,
    tickedBuyers: emails.length,
    skipped: emails.length - todo.length,
    toRecord: todo.length,
    recorded,
  }
}
