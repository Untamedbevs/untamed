import { SupabaseClient } from '@supabase/supabase-js'
import { RESERVED_CODES, CODE_REGEX } from './constants'
import { POINTS } from '@/lib/loyalty/constants'
import { applyPoints } from '@/lib/rewards/ledger'
import { CAPS } from '@/lib/rewards/program'
import { attributionBelongsToOrder } from '@/lib/tracking/attribution-window'

export function isValidReferralCode(code: string): { valid: boolean; error?: string } {
  if (code.length < 2 || code.length > 20) {
    return { valid: false, error: 'Code must be 2-20 characters' }
  }
  if (!CODE_REGEX.test(code)) {
    return {
      valid: false,
      error: 'Code can only contain lowercase letters, numbers, and hyphens (cannot start or end with hyphen)',
    }
  }
  if (RESERVED_CODES.has(code)) {
    return { valid: false, error: 'This code is reserved' }
  }
  return { valid: true }
}

/**
 * The inbox an address delivers to, for self-referral and repeat-customer
 * checks: lowercased, with any +tag removed, and for Gmail with dots removed
 * and googlemail.com folded into gmail.com.
 */
export function mailboxKey(email: string): string {
  const e = email.toLowerCase().trim()
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  let local = e.slice(0, at).split('+')[0]
  let domain = e.slice(at + 1)
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  return `${local}@${domain}`
}

function sameMailbox(a: string, b: string): boolean {
  return mailboxKey(a) === mailboxKey(b)
}

/**
 * PostgREST or() filter that narrows loyalty_orders to rows that may share a
 * mailbox with this address (the base address and its +tag variants). The
 * caller still confirms each row with sameMailbox. Gmail dot variants are
 * not matched by this filter.
 */
function mailboxVariantFilter(email: string): string {
  const e = email.toLowerCase().trim()
  const at = e.lastIndexOf('@')
  // LIKE-escape % _ \ ; PostgREST reads * as %, so a literal * becomes the
  // one-character _ (the sameMailbox check afterwards is exact).
  const like = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, '_')
  // Double-quote each value so commas or parentheses can't break the or() list.
  const quote = (s: string) => `"${s.replace(/["\\]/g, (c) => `\\${c}`)}"`
  if (at < 1) return `email.ilike.${quote(like(e))}`
  const base = e.slice(0, at).split('+')[0]
  const domain = e.slice(at + 1)
  return `email.ilike.${quote(like(`${base}@${domain}`))},email.ilike.${quote(`${like(`${base}+`)}*${like(`@${domain}`)}`)}`
}

function generateCodeFromName(name: string): string {
  // CODE_MAX_LENGTH is 20; reserve 4 chars for the collision suffix
  // (`Math.random()*9000 + 1000` → always 4 digits) so the suffixed code
  // still fits inside the validation bounds.
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 16) || 'untamed'
}

export async function generateUniqueCode(
  supabase: SupabaseClient,
  baseName: string
): Promise<string> {
  const baseCode = generateCodeFromName(baseName)
  let candidate = baseCode

  for (let i = 0; i < 100; i++) {
    // Generated codes follow the same rules as member-chosen ones: a name like
    // "Admin" or "Untamed" (reserved) or "A" (too short) gets a numeric suffix.
    if (!isValidReferralCode(candidate).valid) {
      candidate = `${baseCode}${Math.floor(Math.random() * 9000) + 1000}`
      continue
    }
    const { data: existing } = await supabase
      .from('referral_participants')
      .select('id')
      .eq('referral_code', candidate)
      .maybeSingle()

    const { data: historyHit } = await supabase
      .from('referral_code_history')
      .select('id')
      .eq('old_code', candidate)
      .maybeSingle()

    if (!existing && !historyHit) return candidate

    candidate = `${baseCode}${Math.floor(Math.random() * 9000) + 1000}`
  }

  return `${baseCode}${Date.now().toString(36).slice(-6)}`
}

export async function resolveReferralCode(
  supabase: SupabaseClient,
  code: string
): Promise<{
  id: string
  email: string
  referral_code: string
  display_name: string | null
  loyalty_member_id: string
} | null> {
  const { data: participant } = await supabase
    .from('referral_participants')
    .select('id, email, referral_code, display_name, loyalty_member_id')
    .eq('referral_code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (participant) return participant

  const { data: history } = await supabase
    .from('referral_code_history')
    .select('participant_id')
    .eq('old_code', code)
    .maybeSingle()

  if (!history) return null

  const { data: fromHistory } = await supabase
    .from('referral_participants')
    .select('id, email, referral_code, display_name, loyalty_member_id')
    .eq('id', history.participant_id)
    .eq('is_active', true)
    .maybeSingle()

  return fromHistory
}

export function buildShareLinks(
  siteUrl: string,
  referralCode: string
): { consumerLink: string; distributorLink: string } {
  return {
    consumerLink: `${siteUrl}/?ref=${referralCode}`,
    distributorLink: `${siteUrl}/retail?ref=${referralCode}`,
  }
}

/**
 * Find or create a referral_participant for a loyalty member. Used by the
 * portal so an authenticated loyalty member can land on /portal/referrals
 * and immediately see their dashboard, even if they never explicitly
 * "joined" the referral program at /referral.
 */
export async function ensureReferralParticipant(
  supabase: SupabaseClient,
  args: {
    loyaltyMemberId: string
    email: string
    displayName: string | null
  }
): Promise<{
  id: string
  loyalty_member_id: string
  email: string
  referral_code: string
  display_name: string | null
  referred_by_participant_id: string | null
  total_clicks: number
  consumer_signups: number
  distributor_leads: number
  paid_conversions: number
  custom_message: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}> {
  const normalizedEmail = args.email.toLowerCase().trim()

  const { data: existing } = await supabase
    .from('referral_participants')
    .select('*')
    .eq('loyalty_member_id', args.loyaltyMemberId)
    .maybeSingle()

  if (existing) return existing

  const referralCode = await generateUniqueCode(
    supabase,
    args.displayName || normalizedEmail.split('@')[0]
  )

  const { data: created, error } = await supabase
    .from('referral_participants')
    .insert({
      loyalty_member_id: args.loyaltyMemberId,
      email: normalizedEmail,
      referral_code: referralCode,
      display_name: args.displayName,
    })
    .select()
    .single()

  if (error || !created) {
    throw new Error(
      `Failed to create referral participant: ${error?.message || 'unknown error'}`
    )
  }

  return created
}

/**
 * Credit a referrer's loyalty balance through the locked ledger, so it can't
 * overwrite a change landing at the same time. The referral program pays
 * flat, instant points -- no tiers, no claiming.
 */
async function creditReferrerLoyaltyPoints(
  supabase: SupabaseClient,
  loyaltyMemberId: string,
  points: number,
  type: 'referral_signup' | 'referral_purchase',
  description: string
): Promise<void> {
  await applyPoints(supabase, { memberId: loyaltyMemberId, points, type, description })
}

/**
 * Credits a referral reward only while the referrer is under the yearly cap.
 * Prefers loyalty_apply_referral_points (migration 00035), which counts and
 * inserts under one member-row lock so concurrent credits cannot pass the cap.
 * Until that migration is applied, falls back to the separate count plus
 * applyPoints, which is not atomic. Returns whether points were credited.
 */
async function creditReferrerWithinYearlyCap(
  supabase: SupabaseClient,
  loyaltyMemberId: string,
  points: number,
  type: 'referral_signup' | 'referral_purchase',
  description: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('loyalty_apply_referral_points', {
    p_member_id: loyaltyMemberId,
    p_points: points,
    p_type: type,
    p_description: description,
    p_cap: CAPS.REFERRAL_CREDITS_PER_YEAR,
  })
  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as { capped?: boolean } | undefined
    return !row?.capped
  }
  // PGRST202: function not in the schema cache; 42883: undefined function.
  if (error.code !== 'PGRST202' && error.code !== '42883') {
    throw new Error(`referral credit failed: ${error.message}`)
  }
  if (!(await isUnderYearlyReferralCap(supabase, loyaltyMemberId, type))) return false
  await creditReferrerLoyaltyPoints(supabase, loyaltyMemberId, points, type, description)
  return true
}

/**
 * Whether a referrer is still under the Program Rules' yearly referral cap
 * (CAPS.REFERRAL_CREDITS_PER_YEAR per calendar year, UTC, the same year
 * boundary the portal's "Rewarded this year" count uses) for one kind of
 * referral reward. Counts the referrer's positive ledger rows of that type,
 * since applyPoints writes exactly one per credit. Fails closed: if the count
 * can't be read, no points are credited.
 *
 * Used only as the fallback before migration 00035 is applied; not atomic, so
 * two credits landing at the same instant can both pass at 24.
 */
async function isUnderYearlyReferralCap(
  supabase: SupabaseClient,
  loyaltyMemberId: string,
  type: 'referral_signup' | 'referral_purchase'
): Promise<boolean> {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString()
  const { count, error } = await supabase
    .from('loyalty_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', loyaltyMemberId)
    .eq('type', type)
    .gt('points', 0)
    .gte('created_at', yearStart)
  if (error || count === null) {
    console.error('[referral] yearly cap count failed; not crediting:', error?.message)
    return false
  }
  return count < CAPS.REFERRAL_CREDITS_PER_YEAR
}

/**
 * Credit a referrer when a referred consumer signs up. Resolves the referral
 * code, increments the participant's consumer signups, logs the event, marks
 * the matching warm-intro invite converted, and instantly credits the flat
 * referral-signup points to the referrer's loyalty balance.
 *
 * Guards: self-referrals earn nothing, each referred email can only ever
 * credit a given referrer once, and a referrer earns points for at most
 * CAPS.REFERRAL_CREDITS_PER_YEAR friends per calendar year. Best-effort:
 * never throws so it can't fail the signup it accompanies.
 */
export async function creditConsumerReferral(
  supabase: SupabaseClient,
  refCode: string,
  referredEmail: string
): Promise<void> {
  try {
    const code = refCode?.trim()
    if (!code) return

    const referrer = await resolveReferralCode(supabase, code)
    if (!referrer) return

    const normalizedEmail = referredEmail.toLowerCase().trim()

    // Self-referral guard: signing yourself up earns nothing.
    if (sameMailbox(normalizedEmail, referrer.email)) return

    // Dedupe guard: a referred email only credits a referrer once, ever.
    const { data: priorSignup } = await supabase
      .from('referral_events')
      .select('id')
      .eq('participant_id', referrer.id)
      .eq('event_type', 'consumer_signup')
      .eq('referred_email', normalizedEmail)
      .limit(1)
      .maybeSingle()
    if (priorSignup) return

    const { data: refParticipant } = await supabase
      .from('referral_participants')
      .select('consumer_signups')
      .eq('id', referrer.id)
      .single()

    if (!refParticipant) return

    const newSignups = (refParticipant.consumer_signups || 0) + 1

    await Promise.all([
      supabase
        .from('referral_participants')
        .update({ consumer_signups: newSignups })
        .eq('id', referrer.id),
      supabase.from('referral_events').insert({
        participant_id: referrer.id,
        event_type: 'consumer_signup',
        referred_email: normalizedEmail,
      }),
    ])

    await supabase
      .from('referral_invites')
      .update({ status: 'converted', converted_at: new Date().toISOString() })
      .eq('participant_id', referrer.id)
      .eq('referred_email', normalizedEmail)
      .eq('invite_type', 'consumer')
      .neq('status', 'converted')

    // Program Rules: at most CAPS.REFERRAL_CREDITS_PER_YEAR friends rewarded
    // per referrer per calendar year. Past the cap the signup is still
    // tracked above; it just earns no points.
    await creditReferrerWithinYearlyCap(
      supabase,
      referrer.loyalty_member_id,
      POINTS.REFERRAL_SIGNUP,
      'referral_signup',
      'A friend joined the pack through your link'
    )
  } catch {
    // Referral crediting is best-effort; never throw to the caller.
  }
}

/**
 * Credit a referrer for a paid AccelPay order. Resolves the order + its stored
 * attribution (ref code), then logs a `paid_conversion` event for the buyer
 * (always, for conversion tracking) and -- unless it's a self-referral --
 * increments the referrer's paid_conversions. The referred friend's FIRST
 * purchase also instantly credits flat referral-purchase points to the
 * referrer's loyalty balance. Idempotent: an atomic claim on
 * `conversion_credited` guarantees a sale is only ever credited once, no
 * matter how many times this runs. Best-effort: never throws.
 */
export async function creditPaidConversion(
  supabase: SupabaseClient,
  accelPaySaleId: number
): Promise<void> {
  try {
    if (!accelPaySaleId) return

    const { data: order } = await supabase
      .from('loyalty_orders')
      .select('id, email, created_at, raw_payload')
      .eq('accelpay_sale_id', accelPaySaleId)
      .maybeSingle()
    if (!order) return // Order row not created yet; the other path will retry.

    const { data: attribution } = await supabase
      .from('loyalty_order_attributions')
      .select('ref_code, conversion_credited, created_at')
      .eq('accelpay_sale_id', accelPaySaleId)
      .maybeSingle()
    if (!attribution || attribution.conversion_credited) return
    // A code attached long before this sale (e.g. posted for a sale id that
    // didn't exist yet) isn't the buyer's. Left unclaimed so the buyer's own
    // post, which replaces it, can still be credited.
    if (!attributionBelongsToOrder(attribution.created_at, order)) return

    const refCode = (attribution.ref_code as string | null)?.trim()
    if (!refCode) return

    const referrer = await resolveReferralCode(supabase, refCode)
    if (!referrer) return

    // Atomic claim -- only one caller wins, guaranteeing once-per-sale.
    const { data: claimed } = await supabase
      .from('loyalty_order_attributions')
      .update({ conversion_credited: true })
      .eq('accelpay_sale_id', accelPaySaleId)
      .eq('conversion_credited', false)
      .select('id')
      .maybeSingle()
    if (!claimed) return

    const buyerEmail = (order.email as string | null)?.toLowerCase().trim() || null
    // Compare mailboxes, not strings: name+1@x reaches name@x's inbox.
    const isSelfReferral = !!buyerEmail && sameMailbox(buyerEmail, referrer.email)

    // Is this the buyer's first tracked purchase through this referrer?
    // Checked BEFORE inserting the new event so the new row doesn't count.
    let isFirstPurchase = false
    if (buyerEmail && !isSelfReferral) {
      const { data: priorPurchase } = await supabase
        .from('referral_events')
        .select('id')
        .eq('participant_id', referrer.id)
        .eq('event_type', 'paid_conversion')
        .eq('referred_email', buyerEmail)
        .limit(1)
        .maybeSingle()
      // A friend who has ordered from us before isn't a new customer. Look for
      // earlier orders from the same mailbox, including its +tag variants.
      const { data: earlierOrders, error: earlierError } = await supabase
        .from('loyalty_orders')
        .select('id, email')
        .or(mailboxVariantFilter(buyerEmail))
        .neq('id', order.id)
        .lt('created_at', order.created_at as string)
        .limit(50)
      if (earlierError) {
        console.error('[referral] earlier-order lookup failed; no first-purchase bonus:', earlierError.message)
      }
      // A failed lookup pays no bonus rather than treating the buyer as new.
      const earlierOrder =
        !!earlierError ||
        (earlierOrders || []).some((o) => typeof o.email === 'string' && sameMailbox(o.email, buyerEmail))
      isFirstPurchase = !priorPurchase && !earlierOrder
    }

    // Always log the conversion event (for tracking), even for self-referrals.
    await supabase.from('referral_events').insert({
      participant_id: referrer.id,
      event_type: 'paid_conversion',
      referred_email: buyerEmail,
      metadata: {
        accelpay_sale_id: accelPaySaleId,
        loyalty_order_id: order.id,
        self_referral: isSelfReferral,
      },
    })

    // Self-referrals are tracked but earn no referral reward points.
    if (isSelfReferral) return

    const { data: refParticipant } = await supabase
      .from('referral_participants')
      .select('paid_conversions')
      .eq('id', referrer.id)
      .single()
    if (!refParticipant) return

    await supabase
      .from('referral_participants')
      .update({ paid_conversions: (refParticipant.paid_conversions || 0) + 1 })
      .eq('id', referrer.id)

    // The Program Rules (src/app/rewards/rules/page.tsx) cap the first-purchase
    // bonus at the same CAPS.REFERRAL_CREDITS_PER_YEAR friends per calendar
    // year, listed separately from the signup reward, so it is counted on its
    // own ledger type.
    if (isFirstPurchase) {
      await creditReferrerWithinYearlyCap(
        supabase,
        referrer.loyalty_member_id,
        POINTS.REFERRAL_FIRST_PURCHASE,
        'referral_purchase',
        'A friend you referred made their first purchase'
      )
    }
  } catch {
    // Paid-conversion crediting is best-effort; never throw to the caller.
  }
}
