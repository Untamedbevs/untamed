import Image from 'next/image'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { artSrc } from '@/lib/rewards/art'
import { formatValue, type MilestoneClaim } from '@/lib/rewards/catalog'
import type { MemberTrail } from '@/lib/rewards/member-rewards'

const STATUS: Record<MilestoneClaim['status'], { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: 'On its way', cls: 'text-[#FFD700] border-[#FFD700]/30', Icon: Clock },
  fulfilled: { label: 'Sent', cls: 'text-[#39FF14] border-[#39FF14]/30', Icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'text-[#888] border-[#2A2A2A]', Icon: XCircle },
}

/** The member's claimed milestone rewards and where each one stands. */
export function RewardStash({ trail }: { trail: MemberTrail }) {
  if (!trail.claims.length) return null
  const icons = new Map(trail.stops.map((s) => [s.milestone.id, s.milestone.reward?.icon ?? s.milestone.icon]))
  return (
    <section className="rounded-[28px] border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6">
      <h2 className="font-headline text-2xl uppercase tracking-wide text-white">Your stash</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {trail.claims.map((c) => {
          const s = STATUS[c.status]
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-black/30 p-3">
              <Image src={artSrc(icons.get(c.milestone_id))} alt="" width={52} height={52} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{c.reward_name}</div>
                <div className="text-xs text-[#A0A0A0]">
                  {c.milestone_title ?? 'Milestone'} · {formatValue(c.value_cents)}
                </div>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
                <s.Icon className="h-3 w-3" /> {s.label}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
