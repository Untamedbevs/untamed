import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle, AlertCircle, Mail } from 'lucide-react'
import { maskEmail, verifyConfirmToken } from '@/lib/messaging/unsubscribe'
import { REPERMISSION_COPY, type RepermissionAudience } from '@/lib/email/consent-copy'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Email preferences | Untamed Beverages',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ status?: string; t?: string; a?: string }>
}

function readToken(token: string | undefined) {
  if (!token) return null
  try {
    return verifyConfirmToken(token)
  } catch {
    return null
  }
}

export default async function EmailConfirmPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status
  const token = params.t

  if (status === 'ok') {
    const audience: RepermissionAudience = params.a === 'trade' ? 'trade' : 'consumer'
    return (
      <Wrapper>
        <Icon tone="ok" />
        <h1 className="text-2xl font-bold text-white mb-2">You&apos;re in</h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          {audience === 'trade'
            ? 'Thanks. We’ll send occasional trade and wholesale updates.'
            : 'Thanks. We’ll keep you posted on new drinks, offers, and community news.'}{' '}
          Every email has an unsubscribe link if you change your mind.
        </p>
        <HomeLink primary />
      </Wrapper>
    )
  }

  const result = readToken(token)

  if (!result || !result.ok || !token) {
    const expired = (result && !result.ok && result.reason === 'expired') || status === 'expired'
    return (
      <Wrapper>
        <Icon tone="error" />
        <h1 className="text-2xl font-bold text-white mb-2">
          {expired ? 'This link has expired' : 'This link isn’t valid'}
        </h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          {expired
            ? 'Confirmation links work for 90 days. '
            : 'This confirmation link is incomplete or has been changed. '}
          You can still reach us at{' '}
          <a href="mailto:support@untamedbeverages.com" className="text-[#9B30FF] hover:underline">
            support@untamedbeverages.com
          </a>
          .
        </p>
        <HomeLink />
      </Wrapper>
    )
  }

  const { payload } = result
  const copy = REPERMISSION_COPY[payload.a]

  return (
    <Wrapper>
      <Icon tone="neutral" />
      <h1 className="text-2xl font-bold text-white mb-2">{copy.pageHeading}</h1>
      <p className="text-sm text-[#A0A0A0] mb-6">
        For <span className="text-white font-mono">{maskEmail(payload.e)}</span>
      </p>

      {status === 'age_required' && (
        <Notice>Please confirm you&apos;re 21 or older to continue.</Notice>
      )}
      {status === 'failed' && (
        <Notice>We couldn&apos;t save that just now. Please try again in a minute.</Notice>
      )}

      <form method="post" action="/api/email/confirm" className="text-left">
        <input type="hidden" name="t" value={token} />
        <p className="text-sm text-white leading-relaxed mb-4 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4">
          {copy.consentText}
        </p>
        {copy.ageText && (
          <label className="flex items-start gap-3 text-sm text-[#D0D0D0] mb-6 cursor-pointer">
            <input
              type="checkbox"
              name="age"
              value="yes"
              required
              className="mt-0.5 h-4 w-4 accent-[#9B30FF]"
            />
            <span>{copy.ageText}</span>
          </label>
        )}
        <button
          type="submit"
          className="w-full px-5 py-3 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors"
        >
          {copy.ctaLabel}
        </button>
      </form>

      <p className="text-xs text-[#666] mt-6">
        Not interested? Just close this page. We won&apos;t ask again.
      </p>
    </Wrapper>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4">
      {children}
    </p>
  )
}

function Icon({ tone }: { tone: 'ok' | 'error' | 'neutral' }) {
  if (tone === 'error') {
    return (
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/15 text-red-400 mb-5">
        <AlertCircle className="w-7 h-7" />
      </div>
    )
  }
  const IconComponent = tone === 'ok' ? CheckCircle : Mail
  return (
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-5">
      <IconComponent className="w-7 h-7" />
    </div>
  )
}

function HomeLink({ primary = false }: { primary?: boolean }) {
  return (
    <Link
      href="/"
      className={
        primary
          ? 'inline-block px-5 py-2.5 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors'
          : 'inline-block px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] text-sm hover:text-white hover:border-[#3A3A3A]'
      }
    >
      Back to Untamed
    </Link>
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
