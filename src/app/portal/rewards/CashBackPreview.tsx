import Image from 'next/image'
import { Coins, MapPin, Receipt, Send, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CASH_BACK_PREVIEW } from '@/lib/rewards/program'
import type { CashBackStatus } from '@/lib/rewards/state-rules'
import { CASH_BACK_ART, formatPoints, formatRetailValue } from '@/lib/referral-hq/program'

const { POINTS_PER_STEP, CENTS_PER_STEP, MAX_SHARE_OF_PURCHASE, PAYOUT_METHODS } = CASH_BACK_PREVIEW

function listOr(items: readonly string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}` : items[0]
}

const STEPS = [
  {
    icon: Receipt,
    text: 'Show proof of purchase for Untamed you’ve already bought.',
  },
  {
    icon: Coins,
    text: `Turn points into cash back: ${formatPoints(POINTS_PER_STEP)} points = ${formatRetailValue(
      CENTS_PER_STEP
    )} back, up to ${MAX_SHARE_OF_PURCHASE * 100}% of what you paid.`,
  },
  {
    icon: Send,
    text: `Untamed pays you directly by ${listOr(PAYOUT_METHODS)}.`,
  },
  {
    icon: ShieldCheck,
    text: 'Never a discount at checkout.',
  },
]

/**
 * Visual preview of a cash-back option that doesn't exist yet: nothing here
 * redeems, stores, or pays anything. `status` is cashBackStatus() for the
 * member's state, or null before they've told us their state.
 */
export function CashBackPreview({
  status,
  stateName,
}: {
  status: CashBackStatus | null
  stateName: string | null
}) {
  const message =
    status === null
      ? 'Confirm your state above to see whether it’s coming to you.'
      : status === 'launch'
        ? `Coming soon for ${stateName ?? 'your state’s'} members.`
        : status === 'candidate'
          ? 'We’re working on bringing this to your state.'
          : 'Cash back isn’t available in your state.'

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#FFD700]/10 blur-3xl"
      />
      <div className="relative flex flex-col sm:flex-row sm:items-start gap-5">
        <Image
          src={CASH_BACK_ART}
          alt=""
          width={120}
          height={120}
          className={cn(
            'h-24 w-24 sm:h-28 sm:w-28 shrink-0 self-center object-contain drop-shadow-[0_8px_24px_rgba(255,215,0,0.25)]',
            status === 'off' && 'grayscale opacity-50'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFD700]">Cash back: coming soon</h2>
            <span className="rounded-full border border-[#9B30FF]/50 bg-[#9B30FF]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C89BFF]">
              Preview
            </span>
          </div>
          <p className="font-wild text-3xl sm:text-4xl text-white leading-none mt-2">Points back in your pocket</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white">
            <MapPin className="w-4 h-4 shrink-0 text-[#9B30FF]" />
            {message}
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STEPS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-2 rounded-2xl border border-[#222] bg-[#0A0A0A]/60 p-3 text-xs text-[#D0D0D0]"
              >
                <Icon className="w-4 h-4 mt-px shrink-0 text-[#FFD700]" />
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              className="rounded-full bg-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#888] cursor-not-allowed"
            >
              {status === 'off' ? 'Not available in your state' : 'Coming soon'}
            </button>
            <p className="text-[11px] text-[#777] flex-1 min-w-[12rem]">
              Preview only. Nothing pays out yet, and the details may change before launch. Cash back will follow
              the Program Rules and your state’s law.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
