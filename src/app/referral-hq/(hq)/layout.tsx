import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getSessionUser, hqEnabled } from '@/lib/referral-hq/auth'
import { signOut } from '../actions'
import { HqNav } from './HqNav'
import '../hq.css'

export const metadata: Metadata = {
  title: 'Referral HQ | Untamed Beverages',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ReferralHqLayout({ children }: { children: React.ReactNode }) {
  if (!hqEnabled()) notFound()
  if (!(await getSessionUser())) redirect('/referral-hq/login')

  // overflow-x-clip (not hidden) so the sticky header still sticks to the viewport.
  return (
    <div className="min-h-screen bg-[#0A0A0A] overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-[#2A2A2A] bg-[#0A0A0A]/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl h-16 px-4 lg:px-6 flex items-center gap-4">
          <Link href="/referral-hq" className="flex items-center gap-3 shrink-0">
            <Image src="/images/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="hidden sm:block font-headline text-lg uppercase tracking-wider text-white">
              Referral HQ
            </span>
          </Link>
          <HqNav />
          <form action={signOut} className="ml-auto">
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>
      <div className="border-b border-[#FFD700]/20 bg-[#FFD700]/[0.06] text-center text-[11px] uppercase tracking-[0.2em] text-[#FFD700]/80 py-1.5 px-4">
        Mock-up · demo data · reward numbers are draft
      </div>
      <main className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-8">{children}</main>
    </div>
  )
}
