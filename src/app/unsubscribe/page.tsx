import Link from 'next/link'
import { CheckCircle, AlertCircle, Mail } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string; email?: string; msg?: string }>
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status
  const email = params.email
  const msg = params.msg

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
            <span className="text-white font-mono">{email}</span> from all Untamed
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
      </Wrapper>
    )
  }

  if (status === 'error') {
    return (
      <Wrapper>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/15 text-red-400 mb-5">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Unsubscribe link expired
        </h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          {msg || 'This link is no longer valid.'} Email{' '}
          <a
            href="mailto:unsubscribe@untamedbeverages.com"
            className="text-[#9B30FF] hover:underline"
          >
            unsubscribe@untamedbeverages.com
          </a>{' '}
          and we&apos;ll remove you manually within 1 business day.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] text-sm hover:text-white hover:border-[#3A3A3A]"
        >
          Back to Untamed
        </Link>
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
      <Link
        href="/"
        className="inline-block px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] text-sm hover:text-white hover:border-[#3A3A3A]"
      >
        Back to Untamed
      </Link>
    </Wrapper>
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
