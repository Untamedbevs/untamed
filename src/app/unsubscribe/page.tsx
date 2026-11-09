import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle, AlertCircle, Mail } from 'lucide-react'
import { maskEmail, signManageToken, verifyUnsubscribeToken } from '@/lib/messaging/unsubscribe'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unsubscribe | Untamed Beverages',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ status?: string; t?: string }>
}

function emailFromToken(token: string | undefined): string | null {
  if (!token) return null
  try {
    return verifyUnsubscribeToken(token)?.e || null
  } catch {
    return null
  }
}

/** Preference-center link for the verified address, signed here so the URL never carries one. */
function preferencesHref(email: string | null): string | null {
  if (!email) return null
  try {
    return `/email/preferences?t=${encodeURIComponent(signManageToken(email))}`
  } catch {
    return null
  }
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status
  const token = params.t
  const email = emailFromToken(token)
  const manageHref = preferencesHref(email)

  if (status === 'ok') {
    return (
      <Wrapper>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-5">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">You&apos;re unsubscribed</h1>
        {email && (
          <p className="text-sm text-[#A0A0A0] mb-1">
            We&apos;ve removed{' '}
            <span className="text-white font-mono">{maskEmail(email)}</span> from all Untamed
            email lists.
          </p>
        )}
        <p className="text-sm text-[#A0A0A0] mb-6">
          You won&apos;t receive any further marketing or referral emails from us.
        </p>
        <p className="text-xs text-[#666] mb-6">
          Note: transactional emails directly related to a purchase, account, or
          loyalty receipt may still be sent.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors"
        >
          Back to Untamed
        </Link>
        {manageHref && (
          <p className="text-xs text-[#666] mt-6">
            Unsubscribed by mistake?{' '}
            <Link href={manageHref} className="text-[#9B30FF] hover:underline">
              Manage your preferences
            </Link>
          </p>
        )}
      </Wrapper>
    )
  }

  if (status === 'error' || (token && !email)) {
    return (
      <Wrapper>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/15 text-red-400 mb-5">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {email ? 'Something went wrong' : 'This link isn’t valid'}
        </h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          {email
            ? 'We couldn’t process your unsubscribe just now. Please try again in a minute, or email '
            : 'This unsubscribe link is incomplete or has been changed. Email '}
          <a
            href="mailto:unsubscribe@untamedbeverages.com"
            className="text-[#9B30FF] hover:underline"
          >
            unsubscribe@untamedbeverages.com
          </a>{' '}
          and we&apos;ll remove you manually within 1 business day.
        </p>
        {email && token && <ConfirmForm token={token} label="Try again" />}
        <Link
          href="/"
          className="inline-block mt-4 px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] text-sm hover:text-white hover:border-[#3A3A3A]"
        >
          Back to Untamed
        </Link>
      </Wrapper>
    )
  }

  if (email && token) {
    return (
      <Wrapper>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-5">
          <Mail className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Unsubscribe?</h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          Stop all Untamed marketing email to{' '}
          <span className="text-white font-mono">{maskEmail(email)}</span>. Takes effect
          immediately.
        </p>
        <ConfirmForm token={token} label="Unsubscribe from all Untamed emails" />
        {manageHref && (
          <p className="text-sm text-[#A0A0A0] mt-4">
            Rather choose topics or take a break?{' '}
            <Link href={manageHref} className="text-[#9B30FF] hover:underline">
              Manage preferences instead
            </Link>
          </p>
        )}
        <p className="text-xs text-[#666] mt-6">
          Transactional emails about a purchase, your account, or a loyalty receipt
          may still be sent.
        </p>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-5">
        <Mail className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Unsubscribe</h1>
      <p className="text-sm text-[#A0A0A0] mb-6">
        Use the unsubscribe link in any Untamed email to opt out of further messages.
        If your link expired or doesn&apos;t work, email{' '}
        <a
          href="mailto:unsubscribe@untamedbeverages.com"
          className="text-[#9B30FF] hover:underline"
        >
          unsubscribe@untamedbeverages.com
        </a>{' '}
        and we&apos;ll remove you within 1 business day.
      </p>
      <div className="flex flex-col gap-3">
        <Link
          href="/email/preferences"
          className="inline-block px-5 py-2.5 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors"
        >
          Email me a preferences link
        </Link>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] text-sm hover:text-white hover:border-[#3A3A3A]"
        >
          Back to Untamed
        </Link>
      </div>
    </Wrapper>
  )
}

function ConfirmForm({ token, label }: { token: string; label: string }) {
  return (
    <form method="post" action="/api/unsubscribe">
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="confirm" value="1" />
      <button
        type="submit"
        className="w-full px-5 py-3 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors"
      >
        {label}
      </button>
    </form>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-[#2A2A2A] bg-[#111] p-8 text-center">
        {children}
      </div>
    </main>
  )
}
