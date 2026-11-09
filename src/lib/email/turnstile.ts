/**
 * Cloudflare Turnstile bot check for the public email forms.
 *
 * Optional. With TURNSTILE_SECRET_KEY unset, every check passes and the forms
 * rely on their honeypot field and rate limits. Set it together with
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY (which shows the widget), or every submit
 * fails for lack of a token.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function getSecret(): string | undefined {
  const secret = process.env.TURNSTILE_SECRET_KEY
  return secret && secret.trim() ? secret.trim() : undefined
}

export function isTurnstileEnabled(): boolean {
  return Boolean(getSecret())
}

/** True when the token is valid, or when Turnstile isn't configured. Fails closed. */
export async function verifyTurnstile(token: unknown, ipAddress: string | null): Promise<boolean> {
  const secret = getSecret()
  if (!secret) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false

  const body = new URLSearchParams({ secret, response: token })
  if (ipAddress) body.set('remoteip', ipAddress)

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[turnstile] siteverify returned', res.status)
      return false
    }
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (data.success !== true) {
      console.warn('[turnstile] token rejected:', (data['error-codes'] || []).join(', '))
    }
    return data.success === true
  } catch (err) {
    console.error('[turnstile] siteverify failed:', err instanceof Error ? err.message : err)
    return false
  }
}
