import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, resolveAlias, type SendResult } from '@/lib/email/transport'
import { APP_ACCOUNT_METADATA, isAppAccount } from '@/lib/auth/app-account'
import { buildMagicLinkEmail } from '@/lib/auth/magic-link-email'
import { safeReturnPath } from '@/lib/auth/safe-return-path'
import { mailboxKey, mailboxVariantFilter } from '@/lib/referral/helpers'
import { isSingleEmailAddress } from '@/lib/messaging/address'

const TEMPLATE_SLUG = 'portal-magic-link'
const MAX_PER_HOUR = 5
const CANDIDATE_LIMIT = 500
const TOO_MANY = 'Too many sign-in emails. Please wait a bit and try again.'
/**
 * The public site, the same default other code uses when NEXT_PUBLIC_SITE_URL
 * is unset (unsubscribe route, portal pages, crm/recipient-vars).
 */
const CANONICAL_SITE_ORIGIN = 'https://untamedbeverages.com'

export class MagicLinkError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/**
 * The origin the emailed sign-in link points at. The link carries a live
 * token_hash, so it uses the configured site URL rather than the request's
 * Host header. When NEXT_PUBLIC_SITE_URL is unset or not a valid http(s) URL:
 *   - in a deployed environment (Vercel sets VERCEL_ENV) the link uses the
 *     canonical site, never the request origin; this is logged;
 *   - in local development (no VERCEL_ENV) it uses the request origin.
 */
function linkOrigin(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    const site = parseHttpOrigin(configured)
    if (site) return site
  }
  const problem = configured ? 'is not an http(s) URL' : 'is not set'
  if (process.env.VERCEL_ENV) {
    console.error(`[magic-link] NEXT_PUBLIC_SITE_URL ${problem}; using ${CANONICAL_SITE_ORIGIN}`)
    return CANONICAL_SITE_ORIGIN
  }
  if (configured) {
    console.error(`[magic-link] NEXT_PUBLIC_SITE_URL ${problem}; using the request origin (local)`)
  }
  const request = parseHttpOrigin(requestOrigin)
  if (!request) {
    throw new MagicLinkError('Could not send the sign-in email.', 400)
  }
  return request
}

function parseHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

/**
 * Sign-in emails sent in the last hour to this mailbox, counted on
 * mailboxKey (the referral code's key: +tags removed, and for Gmail dots
 * removed and googlemail.com folded in), so every spelling that reaches one
 * inbox shares one limit. Only the count uses it; the email still goes to
 * the address that was entered. An escaped ILIKE narrows the rows and each
 * one is then confirmed with mailboxKey. If that lookup fails, the exact
 * address is counted instead; null when that fails too, so the caller can
 * keep its fail-open behavior.
 */
async function recentSendCount(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<number | null> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const key = mailboxKey(email)

  const candidates = await admin
    .from('email_messages')
    .select('to_email')
    .eq('template_slug', TEMPLATE_SLUG)
    .gte('sent_at', since)
    .or(mailboxVariantFilter(email, 'to_email'))
    .order('sent_at', { ascending: false })
    .limit(CANDIDATE_LIMIT)
  if (!candidates.error) {
    const rows = candidates.data || []
    const matched = rows.filter(
      (row) => typeof row.to_email === 'string' && mailboxKey(row.to_email) === key
    ).length
    if (rows.length < CANDIDATE_LIMIT) return matched
    // The pattern also matches look-alike addresses, and anyone can create
    // those rows through this endpoint. When the read is full, this mailbox's
    // own rows may be cut off, so also count the exact address, which no
    // look-alike can push out.
    const exact = await countExact(admin, email, since)
    return exact === null ? matched : Math.max(matched, exact)
  }
  console.error(
    '[magic-link] rate-limit lookup failed; counting the exact address only',
    candidates.error.message
  )

  return countExact(admin, email, since)
}

async function countExact(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  since: string
): Promise<number | null> {
  const exact = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('to_email', email)
    .eq('template_slug', TEMPLATE_SLUG)
    .gte('sent_at', since)
  if (exact.error) {
    console.error('[magic-link] rate-limit lookup failed', exact.error.message)
    return null
  }
  return exact.count || 0
}

const SEND_FAILED = 'Could not send the sign-in email. Please try again.'

/**
 * The app creates portal users already confirmed and marked as its own
 * (createUser with email_confirm: true and APP_ACCOUNT_METADATA, below and in
 * the staff route). An existing auth user that is unconfirmed or unmarked was
 * created outside the app, for example by Supabase's public sign-up, which
 * sets its own password and user_metadata and may have been confirmed by the
 * customer clicking Supabase's own sign-up email. Signing the customer in
 * through it would share the account with whoever made it, so it is deleted
 * and replaced with a fresh, marked user carrying the requester's metadata.
 * Returns true when it replaced the user (the caller then generates a new
 * link).
 *
 * Unmarked users never get member or lead rows linked (the linking gate), and
 * links made before the marker existed are ON DELETE SET NULL and are rebuilt
 * for the new user at sign-in. staff and ugc_submissions rows are ON DELETE
 * CASCADE, so a user that owns any of those is never deleted: a confirmed
 * staff login is marked instead (an admin created it), and anything else is
 * left alone and logged.
 */
async function replaceOutsideUser(
  admin: ReturnType<typeof createAdminClient>,
  linkUser: { id?: string; email_confirmed_at?: string | null } | null | undefined,
  email: string,
  metadata: Record<string, string>
): Promise<boolean> {
  if (!linkUser?.id) return false

  // Decide from the user record itself before deleting anything.
  const { data: fetched, error: fetchError } = await admin.auth.admin.getUserById(linkUser.id)
  if (fetchError || !fetched?.user) {
    console.error('[magic-link] could not re-read the auth user', fetchError?.message)
    throw new MagicLinkError(SEND_FAILED, 500)
  }
  const user = fetched.user
  if (user.email_confirmed_at && isAppAccount(user)) return false
  if ((user.email || '').toLowerCase() !== email) {
    console.error('[magic-link] generateLink returned a user for another address')
    throw new MagicLinkError(SEND_FAILED, 500)
  }

  for (const table of ['staff', 'ugc_submissions']) {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('auth_user_id', user.id)
    if (error) {
      console.error(`[magic-link] ${table} lookup failed; not sending`, error.message)
      throw new MagicLinkError(SEND_FAILED, 500)
    }
    if ((count || 0) > 0) {
      if (table === 'staff' && user.email_confirmed_at) {
        // A staff row means an admin set this login up; adopt it.
        const marked = await admin.auth.admin.updateUserById(user.id, {
          app_metadata: { ...(user.app_metadata || {}), ...APP_ACCOUNT_METADATA },
        })
        if (marked.error) console.error('[magic-link] could not mark a staff login', marked.error.message)
        return false
      }
      console.error(
        `[magic-link] auth user ${user.id} was not created by the app but owns ${table} rows; ` +
          'left in place. Recreate it in Supabase Auth.'
      )
      return false
    }
  }

  const removed = await admin.auth.admin.deleteUser(user.id)
  if (removed.error) {
    console.error('[magic-link] deleteUser failed', removed.error.message)
    throw new MagicLinkError(SEND_FAILED, 500)
  }
  console.warn(`[magic-link] replaced auth user ${user.id} created outside the app`)

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: APP_ACCOUNT_METADATA,
  })
  if (created.error && !/already been registered/i.test(created.error.message)) {
    console.error('[magic-link] createUser failed', created.error.message)
    throw new MagicLinkError(SEND_FAILED, 500)
  }
  return true
}

function isUserMissing(error: { status?: number; code?: string; message?: string }): boolean {
  const message = (error.message || '').toLowerCase()
  return (
    error.status === 404 ||
    error.code === 'user_not_found' ||
    message.includes('user not found') ||
    message.includes('user with this email not found')
  )
}

export async function sendPortalMagicLink(args: {
  email: string
  origin: string
  returnTo?: string
  metadata?: Record<string, string>
}): Promise<void> {
  const email = args.email.trim().toLowerCase()
  // isSingleEmailAddress is the rule the SMTP sender enforces (printable
  // ASCII, one plain address); checking it here gives a 400 instead of a
  // failed send.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isSingleEmailAddress(email)) {
    throw new MagicLinkError('Enter a valid email address.', 400)
  }

  const origin = linkOrigin(args.origin)
  const returnTo = safeReturnPath(args.returnTo)

  const admin = createAdminClient()
  // Fails open: if the lookup errors, the email is still sent, so a database
  // hiccup can't block sign-in.
  const count = await recentSendCount(admin, email)
  if (count !== null && count >= MAX_PER_HOUR) {
    throw new MagicLinkError(TOO_MANY, 429)
  }

  // Reserve this send in the log before doing any work, then count again.
  // Requests sent at the same moment all read the same first count; after
  // the insert, every request that gets past the second count has its own
  // row in it, so at most MAX_PER_HOUR can be sent. The row is removed if
  // the send does not happen.
  const from = resolveAlias('support')
  const reservationId = await reserveLogRow(admin, email, from)
  if (reservationId) {
    const after = await recentSendCount(admin, email)
    if (after !== null && after > MAX_PER_HOUR) {
      await releaseLogRow(admin, reservationId)
      throw new MagicLinkError(TOO_MANY, 429)
    }
  }

  try {
    await generateAndSend(admin, { ...args, email }, origin, returnTo, from, reservationId)
  } catch (err) {
    if (reservationId) await releaseLogRow(admin, reservationId)
    throw err
  }
}

const LOG_BODY_TEXT = 'Sign-in email sent. Link and code omitted from the log.'

/**
 * Insert the redacted log row the rate limit counts. The live link and code
 * never go in the log. Returns null if the insert fails, so a database
 * hiccup can't block sign-in (the row is then written after the send).
 */
async function reserveLogRow(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  from: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('email_messages')
    .insert({
      from_email: from,
      to_email: email,
      subject: 'Sign-in email',
      body_html: `<p>${LOG_BODY_TEXT}</p>`,
      body_text: LOG_BODY_TEXT,
      direction: 'outbound',
      status: 'sent',
      template_slug: TEMPLATE_SLUG,
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    console.error('[magic-link] log reservation failed', error?.message)
    return null
  }
  return data.id as string
}

async function releaseLogRow(
  admin: ReturnType<typeof createAdminClient>,
  id: string
): Promise<void> {
  const { error } = await admin.from('email_messages').delete().eq('id', id)
  if (error) console.error('[magic-link] could not remove unused log row', error.message)
}

async function generateAndSend(
  admin: ReturnType<typeof createAdminClient>,
  args: { email: string; metadata?: Record<string, string> },
  origin: string,
  returnTo: string,
  from: string,
  reservationId: string | null
): Promise<void> {
  const { email } = args

  const metadata = args.metadata || {}
  const linkOptions = {
    redirectTo: `${origin}/portal/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
    ...(Object.keys(metadata).length > 0 ? { data: metadata } : {}),
  }

  let link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: linkOptions,
  })

  if (link.error && isUserMissing(link.error)) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: APP_ACCOUNT_METADATA,
    })
    if (created.error && !/already been registered/i.test(created.error.message)) {
      console.error('[magic-link] createUser failed', created.error.message)
      throw new MagicLinkError(
        'Could not send the sign-in email. Please try again.',
        500
      )
    }
    link = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: linkOptions,
    })
  } else if (
    !link.error &&
    (await replaceOutsideUser(admin, link.data?.user, email, metadata))
  ) {
    link = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: linkOptions,
    })
    // Someone re-created an outside user in between: send nothing.
    const user = link.data?.user
    if (!link.error && user?.id && (!user.email_confirmed_at || !isAppAccount(user))) {
      console.error('[magic-link] user is still not the app account after replacement; not sending')
      throw new MagicLinkError(SEND_FAILED, 500)
    }
  }

  if (link.error || !link.data?.properties) {
    console.error('[magic-link] generateLink failed', link.error?.message)
    throw new MagicLinkError(
      'Could not send the sign-in email. Please try again.',
      500
    )
  }

  const { hashed_token: tokenHash, email_otp: code, verification_type: otpType } =
    link.data.properties
  if (!tokenHash || !code) {
    console.error('[magic-link] generateLink missing token')
    throw new MagicLinkError(
      'Could not send the sign-in email. Please try again.',
      500
    )
  }

  const callback = new URL('/portal/auth/callback', origin)
  callback.searchParams.set('token_hash', tokenHash)
  callback.searchParams.set('type', otpType || 'magiclink')
  callback.searchParams.set('returnTo', returnTo)

  const message = buildMagicLinkEmail({
    confirmationUrl: callback.toString(),
    code,
  })

  let sent: SendResult
  try {
    sent = await sendEmail({
      to: email,
      from,
      replyTo: from,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  } catch (err) {
    console.error(
      '[magic-link] email send failed',
      err instanceof Error ? err.message : err
    )
    throw new MagicLinkError(
      'Could not send the sign-in email. Please try again.',
      500
    )
  }

  // The email is out: from here on nothing may throw, or the caller would
  // remove the reserved row and the send would stop counting. Fill in the
  // reserved row, or write one now if the reservation failed. The live link
  // and code stay out of the log.
  const { error: logError } = reservationId
    ? await admin
        .from('email_messages')
        .update({ subject: message.subject, ses_message_id: sent.messageId, thread_id: sent.messageId })
        .eq('id', reservationId)
    : await admin.from('email_messages').insert({
        from_email: from,
        to_email: email,
        subject: message.subject,
        body_html: `<p>${LOG_BODY_TEXT}</p>`,
        body_text: LOG_BODY_TEXT,
        direction: 'outbound',
        status: 'sent',
        ses_message_id: sent.messageId,
        thread_id: sent.messageId,
        template_slug: TEMPLATE_SLUG,
        stream: 'transactional',
        transport: sent.transport,
        sent_at: new Date().toISOString(),
      })
  if (logError) {
    console.error('[magic-link] log write failed', logError.message)
  }
}
