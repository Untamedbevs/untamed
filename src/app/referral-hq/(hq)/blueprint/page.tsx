import Image from 'next/image'
import { ArrowRight, CircleHelp, Coins, TrendingUp } from 'lucide-react'
import {
  BASE_CREDIT_PER_PACK,
  RANKS,
  TROPHIES,
  formatCredit,
  lifetimeCredit,
  rankArt,
  rewardArt,
  trophyArt,
} from '@/lib/referral-hq/program'

const OPEN_QUESTIONS = [
  'Does a "sale" count per 4-pack, per can-equivalent (4 cans), or per order? The draft counts 4-packs.',
  'Is Wild Credit store credit only, or can it ever cash out? (Draft: store credit, applied at checkout.)',
  'Do refunds / chargebacks claw back credit and milestone progress?',
  'Can a referrer use their own code? (Draft: no — self-purchases don\'t count.)',
  'Does progress ever reset (seasons), or is it lifetime? Seasons keep veterans hunting; lifetime feels fairer.',
  'Alcohol incentive rules vary by state — confirm with compliance which rewards (free product, credit, merch) are allowed where Untamed ships.',
]

export default function BlueprintPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="font-condensed text-xs uppercase tracking-[0.3em] text-[#A0A0A0]">Program blueprint · draft v0.1</p>
        <h1 className="font-wild text-5xl text-white mt-2 leading-none">Claim Your Territory</h1>
        <p className="text-[#A0A0A0] mt-3">
          Referrers earn <span className="text-[#FFD700] font-semibold">{formatCredit(BASE_CREDIT_PER_PACK)} Wild Credit</span> for
          every 4-pack sold through their code. Lifetime sales move them up seven ranks along a trail on their
          territory map. Each rank burns back the fog, pays a one-time unlock, and the higher ranks raise the
          per-pack rate. Trophies are side hunts for bonus credit.
        </p>
      </header>

      {/* Rank ladder */}
      <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
          <TrendingUp className="w-3.5 h-3.5" /> Rank ladder
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#777] border-b border-[#222]">
                <th className="py-2 pl-5 sm:pl-6 font-semibold">Rank</th>
                <th className="py-2 font-semibold">Lifetime 4-packs</th>
                <th className="py-2 font-semibold">Rate / pack</th>
                <th className="py-2 font-semibold">Unlock</th>
                <th className="py-2 pr-6 font-semibold text-right">Credit earned by here*</th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((r, i) => {
                const prevRate = i > 0 ? RANKS[i - 1].ratePerPack : BASE_CREDIT_PER_PACK
                const unlocks = [r.bonusCredit ? `${formatCredit(r.bonusCredit)} bonus credit` : null, ...r.unlocks].filter(Boolean)
                return (
                  <tr key={r.id} className="border-b border-[#1d1d1d] last:border-0 align-middle">
                    <td className="py-3 pl-5 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <Image src={rankArt(r.id)} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
                        <div>
                          <p className="font-wild text-2xl text-white leading-none">{r.name}</p>
                          <p className="text-xs text-[#777] italic mt-0.5">{r.tagline}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-display text-xl font-bold text-white tabular-nums">{r.packs}</td>
                    <td className="py-3">
                      <span className="font-display text-xl font-bold text-white tabular-nums">{formatCredit(r.ratePerPack)}</span>
                      {r.ratePerPack > prevRate && (
                        <span className="ml-2 rounded-full bg-[#FFD700]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#FFD700]">Rate up</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Image src={rewardArt(r.rewardArt)} alt="" width={48} height={48} className="h-12 w-12 object-contain shrink-0" />
                        <ul className="text-white">
                          {unlocks.map((u) => (
                            <li key={u as string}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    </td>
                    <td className="py-3 pr-6 text-right font-display text-lg text-[#FFD700] tabular-nums">
                      {formatCredit(lifetimeCredit(r.packs).total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 sm:px-6 py-3 text-xs text-[#666] border-t border-[#222]">
          *Per-pack credit plus rank bonuses, before trophy bonuses. Use this column to sanity-check cost per
          referrer against margin on each 4-pack.
        </p>
      </section>

      {/* Trophies */}
      <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
          <Coins className="w-3.5 h-3.5" /> Trophies (side hunts)
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {TROPHIES.map((t) => (
            <li key={t.id} className="flex items-center gap-4 rounded-2xl border border-[#222] bg-[#0A0A0A]/60 p-3">
              <Image src={trophyArt(t.id)} alt="" width={64} height={64} className="h-16 w-16 object-contain shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">{t.name}</p>
                <p className="text-sm text-[#A0A0A0]">{t.description}</p>
              </div>
              <span className="shrink-0 font-display text-lg font-bold text-[#FFD700]">+{formatCredit(t.bonusCredit)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Mechanics */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'The territory map',
            body: 'Starts shrouded in fog with only the trailhead visible. Each rank claimed burns away the fog around its clearing and lights the trail to the next one. The summit is Legend.',
          },
          {
            title: 'Wild Credit',
            body: 'Credited when an order with the code is fulfilled (not just placed), so returns don\'t need clawbacks. Shown as a running balance with a ledger, redeemable at checkout.',
          },
          {
            title: 'Code usage',
            body: 'Clicks and per-order paid conversions already land in referral_events. 4-pack counts by flavor, unique buyers, and weekly streaks can be derived from the attributed orders\' line items.',
          },
        ].map((card) => (
          <div key={card.title} className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5">
            <p className="flex items-center gap-2 font-bold text-white">
              <ArrowRight className="w-4 h-4 text-[#9B30FF]" /> {card.title}
            </p>
            <p className="mt-2 text-sm text-[#A0A0A0]">{card.body}</p>
          </div>
        ))}
      </section>

      {/* Open questions */}
      <section className="rounded-3xl border border-[#FFD700]/25 bg-[#FFD700]/[0.04] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFD700]">
          <CircleHelp className="w-3.5 h-3.5" /> Open questions for Untamed
        </div>
        <ol className="mt-3 space-y-2 list-decimal pl-5 text-sm text-[#D0D0D0] marker:text-[#FFD700]">
          {OPEN_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
