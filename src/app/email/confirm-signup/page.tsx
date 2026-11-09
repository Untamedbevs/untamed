import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle, AlertCircle, Mail } from 'lucide-react'
import { maskEmail, signManageToken } from '@/lib/messaging/unsubscribe'
import { getSignupRequest, type SignupRequestView } from '@/lib/email/signup'
import { SIGNUP_CONFIRM_PAGE } from '@/lib/email/signup-copy'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Confirm your signup | Untamed Beverages',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ status?: string; t?: string }>
}

async function readRequest(token: string | undefined): Promise<SignupRequestView | 'error'> {
  if (!token) return { status: 'invalid' }
  try {
    return await getSignupRequest(token)
  } catch (err) {
    console.error('[email/confirm-signup] lookup failed:', err instanceof Error ? err.message : err)
    return 'error'
  }
}

function preferencesHref(email: string): string | null {
  try {
    return `/email/preferences?t=${encodeURIComponent(signManageToken(email))}`
  } catch {
    return null
  }
}

export default async function ConfirmSignupPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status
  const token = params.t
  const view = await readRequest(token)

  if (view === 'error') {
    return (
      <Wrapper>
        <Icon tone="error" />
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          We couldn&apos;t load this link just now. Please try again in a minute.
        </p>
        <HomeLink />
      </Wrapper>
    )
  }

  if (view.status === 'confirmed') {
    const manage = preferencesHref(view.email)
    return (
      <Wrapper>
        <Icon tone="ok" />
        <h1 className="text-2xl font-bold text-white mb-2">{SIGNUP_CONFIRM_PAGE.doneHeading}</h1>
        <p className="text-sm text-[#A0A0A0] mb-2">
          Thanks for confirming{' '}
          <span className="text-white font-mono">{maskEmail(view.email)}</span>.
        </p>
        <TopicList names={view.listNames} />
        <p className="text-xs text-[#666] mb-6">
          Every email has an unsubscribe link if you change your mind.
        </p>
        <div className="flex flex-col gap-3">
          {manage && (
            <Link
              href={manage}
              className="inline-block px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] text-sm hover:text-white hover:border-[#3A3A3A]"
            >
              Manage email preferences
            </Link>
          )}
          <HomeLink primary />
        </div>
      </Wrapper>
    )
  }

  if (view.status === 'expired') {
    return (
      <Wrapper>
        <Icon tone="error" />
        <h1 className="text-2xl font-bold text-white mb-2">This link has expired</h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          Confirmation links work for 7 days. Sign up again and we&apos;ll send you a new one.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/subscribe"
            className="inline-block px-5 py-2.5 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors"
          >
            Sign up again
          </Link>
          <HomeLink />
        </div>
      </Wrapper>
    )
  }

  if (view.status === 'invalid' || !token) {
    return (
      <Wrapper>
        <Icon tone="error" />
        <h1 className="text-2xl font-bold text-white mb-2">This link isn&apos;t valid</h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          This confirmation link is incomplete or has been changed. Try copying the whole link
          from the email, or{' '}
          <Link href="/subscribe" className="text-[#9B30FF] hover:underline">
            sign up again
          </Link>
          .
        </p>
        <HomeLink />
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Icon tone="neutral" />
      <h1 className="text-2xl font-bold text-white mb-2">{SIGNUP_CONFIRM_PAGE.heading}</h1>
      <p className="text-sm text-[#A0A0A0] mb-2">
        For <span className="text-white font-mono">{maskEmail(view.email)}</span>
      </p>
      <TopicList names={view.listNames} />

      {status === 'failed' && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4">
          We couldn&apos;t save that just now. Please try again in a minute.
        </p>
      )}

      <form method="post" action="/api/email/confirm-signup">
        <input type="hidden" name="t" value={token} />
        <button
          type="submit"
          className="w-full px-5 py-3 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors"
        >
          {SIGNUP_CONFIRM_PAGE.button}
        </button>
      </form>

      <p className="text-xs text-[#666] mt-6">
        Didn&apos;t sign up? Just close this page and you won&apos;t be subscribed.
      </p>
    </Wrapper>
  )
}

function TopicList({ names }: { names: string[] }) {
  if (names.length === 0) return <div className="mb-6" />
  return (
    <ul className="flex flex-wrap justify-center gap-2 my-5">
      {names.map((name) => (
        <li
          key={name}
          className="px-3 py-1 rounded-full border border-[#9B30FF]/40 bg-[#9B30FF]/10 text-xs text-[#D8B4FE]"
        >
          {name}
        </li>
      ))}
    </ul>
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
