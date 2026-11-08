import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, resolveAlias } from '@/lib/email/smtp'
import { buildMagicLinkEmail } from '@/lib/auth/magic-link-email'
import { safeReturnPath } from '@/lib/auth/safe-return-path'

const TEMPLATE_SLUG = 'portal-magic-link'
const MAX_PER_HOUR = 5

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
 * Host header. The request origin is used only when NEXT_PUBLIC_SITE_URL is
 * unset (local dev), or, so a bad value can't stop sign-in, when it isn't a
 * valid http(s) URL; that case is logged.
 */
function linkOrigin(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    const site = parseHttpOrigin(configured)
    if (site) return site
    console.error(
      '[magic-link] NEXT_PUBLIC_SITE_URL is not an http(s) URL; using the request origin'
    )
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
 * The address the per-recipient cap is counted on: the mailbox with any
 * `+tag` removed from the local part, so `name+1@x` and `name+2@x` share
 * `name@x`'s limit. Only the count uses it; the email still goes to the
 * address that was entered.
 */
function rateLimitMailbox(email: string): { base: string; local: string; domain: string } {
  const at = email.lastIndexOf('@')
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const plus = local.indexOf('+')
  const baseLocal = plus > 0 ? local.slice(0, plus) : local
  return { base: `${baseLocal}@${domain}`, local: baseLocal, domain }
}

/**
 * Sign-in emails sent in the last hour to the mailbox or any `+tag` variant
 * of it. Returns null when a lookup fails, so the caller can keep its
 * fail-open behavior.
 */
async function recentSendCount(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<number | null> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const mailbox = rateLimitMailbox(email)

  const exact = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('to_email', mailbox.base)
    .eq('template_slug', TEMPLATE_SLUG)
    .gte('sent_at', since)
  if (exact.error) {
    console.error('[magic-link] rate-limit lookup failed', exact.error.message)
    return null
  }
  let count = exact.count || 0

  // `+tag` variants. The pattern is not escaped, so `_`, `%` and `*` in the
  // address only widen the match; rows are then compared exactly here. A
  // backslash would be read as a LIKE escape, so those addresses (rare) keep
  // the exact-address count only.
  if (!mailbox.base.includes('\\')) {
    const variants = await admin
      .from('email_messages')
      .select('to_email')
      .like('to_email', `${mailbox.local}+%@${mailbox.domain}`)
      .eq('template_slug', TEMPLATE_SLUG)
      .gte('sent_at', since)
      .limit(500)
    if (variants.error) {
      console.error('[magic-link] rate-limit lookup failed', variants.error.message)
    } else {
      for (const row of variants.data || []) {
        const to = typeof row.to_email === 'string' ? row.to_email : ''
        if (to !== mailbox.base && rateLimitMailbox(to).base === mailbox.base) count++
      }
    }
  }

  return count
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new MagicLinkError('Enter a valid email address.', 400)
  }

  const origin = linkOrigin(args.origin)
  const returnTo = safeReturnPath(args.returnTo)

  const admin = createAdminClient()
  // Fails open: if the lookup errors, the email is still sent, so a database
  // hiccup can't block sign-in.
  const count = await recentSendCount(admin, email)
  if (count !== null && count >= MAX_PER_HOUR) {
    throw new MagicLinkError(
      'Too many sign-in emails. Please wait a bit and try again.',
      429
    )
  }

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
  const from = resolveAlias('support')

  let messageId: string
  try {
    messageId = await sendEmail({
      to: email,
      from,
      replyTo: from,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  } catch (err) {
    console.error(
      '[magic-link] SMTP send failed',
      err instanceof Error ? err.message : err
    )
    throw new MagicLinkError(
      'Could not send the sign-in email. Please try again.',
      500
    )
  }

  // Store a redacted row so the rate limit works. The live link and code
  // stay out of the log.
  const { error: logError } = await admin.from('email_messages').insert({
    from_email: from,
    to_email: email,
    subject: message.subject,
    body_html: '<p>Sign-in email sent. Link and code omitted from the log.</p>',
    body_text: 'Sign-in email sent. Link and code omitted from the log.',
    direction: 'outbound',
    status: 'sent',
    ses_message_id: messageId,
    thread_id: messageId,
    template_slug: TEMPLATE_SLUG,
    sent_at: new Date().toISOString(),
  })
  if (logError) {
    console.error('[magic-link] log insert failed', logError.message)
  }
}
