import Link from 'next/link'
import { Megaphone } from 'lucide-react'

export function PresaleBanner() {
  return (
    <div className="bg-gradient-to-r from-panther-dark via-untamed-black-light to-panther-dark border-b border-panther-light/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs sm:text-sm text-untamed-white-muted leading-relaxed">
          <Megaphone className="hidden sm:inline w-3.5 h-3.5 shrink-0 text-[#FFD700]" aria-hidden="true" />
          <span className="font-semibold uppercase tracking-wider text-[#FFD700]">
            Presale starts soon!
          </span>
          <span>
            Our buttons will go live when we&apos;re ready to receive orders. Until then, please
            join our{' '}
            <Link
              href="/referral"
              className="text-untamed-white underline underline-offset-2 decoration-untamed-white/40 hover:text-[#FFD700] hover:decoration-[#FFD700] transition-colors"
            >
              referral
            </Link>{' '}
            and{' '}
            <Link
              href="/rewards"
              className="text-untamed-white underline underline-offset-2 decoration-untamed-white/40 hover:text-[#FFD700] hover:decoration-[#FFD700] transition-colors"
            >
              rewards
            </Link>{' '}
            programs!
          </span>
        </p>
      </div>
    </div>
  )
}
