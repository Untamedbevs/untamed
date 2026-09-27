import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, resolveAlias } from '@/lib/email/smtp'
import { buildMagicLinkEmail } from '@/lib/auth/magic-link-email'

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

function safeReturnPath(value: string | undefined): string {
  if (!value) return '/portal'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/portal'
  }
  return value
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

  let origin: URL
  try {
    origin = new URL(args.origin)
  } catch {
    throw new MagicLinkError('Could not send the sign-in email.', 400)
  }
  if (origin.protocol !== 'https:' && origin.protocol !== 'http:') {
    throw new MagicLinkError('Could not send the sign-in email.', 400)
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('to_email', email)
    .eq('template_slug', TEMPLATE_SLUG)
    .gte('sent_at', since)

  if (countError) {
    console.error('[magic-link] rate-limit lookup failed', countError.message)
  } else if ((count || 0) >= MAX_PER_HOUR) {
    throw new MagicLinkError(
      'Too many sign-in emails. Please wait a bit and try again.',
      429
    )
  }

  const metadata = args.metadata || {}
  const linkOptions = {
    redirectTo: `${origin.origin}/portal/auth/callback?returnTo=${encodeURIComponent(safeReturnPath(args.returnTo))}`,
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

  const callback = new URL('/portal/auth/callback', origin.origin)
  callback.searchParams.set('token_hash', tokenHash)
  callback.searchParams.set('type', otpType || 'magiclink')
  callback.searchParams.set('returnTo', safeReturnPath(args.returnTo))

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
