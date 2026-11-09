import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureMemberForAuthUser, grantSignupBonusIfMissing } from '@/lib/auth/link-identities'
import { APP_ACCOUNT_METADATA } from '@/lib/auth/app-account'

/**
 * One shared test customer for walking through signup, Pack Rewards
 * onboarding, and the portal as a real member would. Admins sign in as it
 * with a one-time link from View As and reset it to a fresh signup whenever
 * they want to run onboarding again. Mail to this address lands in Eric's
 * inbox (plus addressing), so emails can be checked too.
 */
export const TEST_CUSTOMER = {
  email: 'eric+packtest@companyengineers.com',
  firstName: 'Test',
} as const

// A brand-new signup has only its first name; no password flags, so the
// portal asks it to set a password just like a real new member.
const FRESH_METADATA = { first_name: TEST_CUSTOMER.firstName }

export interface TestCustomer {
  memberId: string
  authUserId: string
}

async function findAuthUserId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from('loyalty_members')
    .select('auth_user_id')
    .eq('email', TEST_CUSTOMER.email)
    .maybeSingle()
  if (data?.auth_user_id) return data.auth_user_id as string

  // No member row yet: the login may still exist from an earlier attempt.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: TEST_CUSTOMER.email })
  return link.data?.user?.id ?? null
}

/** Creates the test customer the same way a real signup does, if it doesn't exist yet. */
export async function ensureTestCustomer(admin: SupabaseClient): Promise<TestCustomer> {
  let authUserId = await findAuthUserId(admin)
  if (!authUserId) {
    const created = await admin.auth.admin.createUser({
      email: TEST_CUSTOMER.email,
      email_confirm: true,
      user_metadata: FRESH_METADATA,
      app_metadata: APP_ACCOUNT_METADATA,
    })
    if (created.error || !created.data.user) {
      throw new Error(`Could not create the test customer login: ${created.error?.message}`)
    }
    authUserId = created.data.user.id
  }

  const member = await ensureMemberForAuthUser(admin, authUserId, TEST_CUSTOMER.email, {
    firstName: TEST_CUSTOMER.firstName,
  })
  if (!member) throw new Error('Could not create the test customer membership')
  return { memberId: member.loyaltyMemberId, authUserId }
}

/** Whether a signed-in user is the test customer, who sees Pack Rewards like staff do. */
export async function isTestCustomer(admin: SupabaseClient, authUserId: string): Promise<boolean> {
  const { data } = await admin
    .from('loyalty_members')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('email', TEST_CUSTOMER.email)
    .maybeSingle()
  return !!data
}

/**
 * Puts the test customer back to a fresh signup: no enrollment, spirit
 * animal, Hunts, claims, redemptions, receipts or UGC, and only the signup
 * bonus in the ledger. Its login and referral code stay the same.
 */
export async function resetTestCustomer(admin: SupabaseClient): Promise<TestCustomer> {
  const customer = await ensureTestCustomer(admin)
  const { memberId } = customer

  // Rows that point at ledger entries go before the ledger, and the ledger before receipts.
  const tables: [string, string][] = [
    ['reward_milestone_claims', 'member_id'],
    ['promotion_submissions', 'member_id'],
    ['loyalty_redemptions', 'member_id'],
    ['loyalty_transactions', 'member_id'],
    ['loyalty_receipts', 'member_id'],
    ['loyalty_program_consents', 'member_id'],
    ['ugc_submissions', 'loyalty_member_id'],
  ]
  for (const [table, column] of tables) {
    const { error } = await admin.from(table).delete().eq(column, memberId)
    if (error) throw new Error(`Reset failed on ${table}: ${error.message}`)
  }

  const { error } = await admin
    .from('loyalty_members')
    .update({
      first_name: TEST_CUSTOMER.firstName,
      points_balance: 0,
      favorite_drink_slug: null,
      birthdate: null,
      residence_state: null,
      program_enrolled_at: null,
      program_terms_version: null,
      program_status: 'active',
      program_status_reason: null,
      is_trade_account: false,
      referred_by_participant_id: null,
      referral_credited_at: null,
    })
    .eq('id', memberId)
  if (error) throw new Error(`Reset failed on the membership: ${error.message}`)

  await grantSignupBonusIfMissing(admin, memberId)
  await admin.auth.admin.updateUserById(customer.authUserId, { user_metadata: FRESH_METADATA })
  return customer
}

/** A one-time portal sign-in link for the test customer, on the given site. */
export async function testCustomerSignInLink(admin: SupabaseClient, origin: string): Promise<string> {
  await ensureTestCustomer(admin)
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: TEST_CUSTOMER.email })
  const tokenHash = link.data?.properties?.hashed_token
  if (link.error || !tokenHash) {
    throw new Error(`Could not make a sign-in link: ${link.error?.message ?? 'no token'}`)
  }
  const callback = new URL('/portal/auth/callback', origin)
  callback.searchParams.set('token_hash', tokenHash)
  callback.searchParams.set('type', link.data.properties.verification_type || 'magiclink')
  callback.searchParams.set('returnTo', '/portal')
  return callback.toString()
}
