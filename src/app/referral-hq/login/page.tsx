import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSessionUser, hqEnabled, isDemoLogin } from '@/lib/referral-hq/auth'
import { LoginForm } from './LoginForm'
import '../hq.css'

export const metadata: Metadata = {
  title: 'Referral HQ | Untamed Beverages',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ReferralHqLoginPage() {
  if (!hqEnabled()) notFound()
  if (await getSessionUser()) redirect('/referral-hq')

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A] flex items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/images/referral-hq/map.jpg')] bg-cover bg-center opacity-25 blur-[2px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,10,10,0.55),#0A0A0A_75%)]"
      />
      <LoginForm demo={isDemoLogin()} />
    </div>
  )
}
