import { SupabaseClient } from '@supabase/supabase-js'
import { RESERVED_CODES, CODE_REGEX } from './constants'
import { POINTS } from '@/lib/loyalty/constants'

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
 * Insert a loyalty transaction for a referrer and bump their balance.
 * The referral program pays flat, instant points -- no tiers, no claiming.
 */
async function creditReferrerLoyaltyPoints(
  supabase: SupabaseClient,
  loyaltyMemberId: string,
  points: number,
  type: 'referral_signup' | 'referral_purchase',
  description: string
): Promise<void> {
  const { data: member } = await supabase
    .from('loyalty_members')
    .select('points_balance')
    .eq('id', loyaltyMemberId)
    .maybeSingle()
  if (!member) return

  await supabase.from('loyalty_transactions').insert({
    member_id: loyaltyMemberId,
    points,
    type,
    description,
  })

  await supabase
    .from('loyalty_members')
    .update({ points_balance: ((member.points_balance as number) || 0) + points })
    .eq('id', loyaltyMemberId)
}

/**
 * Credit a referrer when a referred consumer signs up. Resolves the referral
 * code, increments the participant's consumer signups, logs the event, marks
 * the matching warm-intro invite converted, and instantly credits the flat
 * referral-signup points to the referrer's loyalty balance.
 *
 * Guards: self-referrals earn nothing, and each referred email can only ever
 * credit a given referrer once. Best-effort: never throws so it can't fail
 * the signup it accompanies.
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
    if (normalizedEmail === referrer.email.toLowerCase().trim()) return

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

    await creditReferrerLoyaltyPoints(
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
      .select('id, email')
      .eq('accelpay_sale_id', accelPaySaleId)
      .maybeSingle()
    if (!order) return // Order row not created yet; the other path will retry.

    const { data: attribution } = await supabase
      .from('loyalty_order_attributions')
      .select('ref_code, conversion_credited')
      .eq('accelpay_sale_id', accelPaySaleId)
      .maybeSingle()
    if (!attribution || attribution.conversion_credited) return

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
    const isSelfReferral =
      !!buyerEmail && buyerEmail === referrer.email.toLowerCase().trim()

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
      isFirstPurchase = !priorPurchase
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

    if (isFirstPurchase) {
      await creditReferrerLoyaltyPoints(
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
