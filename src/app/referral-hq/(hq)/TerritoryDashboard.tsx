'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import {
  Check,
  Copy,
  Flame,
  Gift,
  Link2,
  MousePointerClick,
  Package,
  RotateCcw,
  SlidersHorizontal,
  Ticket,
  Trophy as TrophyIcon,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FLAVORS,
  RANKS,
  TROPHIES,
  formatCredit,
  lifetimeCredit,
  nextRank,
  rankArt,
  rankFor,
  ratePerPack,
  rewardArt,
  totalPacks,
  trophyProgress,
  type Flavor,
  type Progress,
} from '@/lib/referral-hq/program'
import type { DemoReferrer, LedgerEntry } from '@/lib/referral-hq/mock-data'
import { FlavorMix } from './FlavorMix'
import { TerritoryMap } from './TerritoryMap'
import { TrophyCase } from './TrophyCase'
import { WeeklyChart } from './WeeklyChart'

/** Scale the demo referrer's real mix to a simulated lifetime pack count. */
function simulate(base: Progress, packs: number): Progress {
  const actual = totalPacks(base)
  if (packs === actual) return base
  const flavors = Object.keys(base.packsByFlavor) as Flavor[]
  const scaled = {} as Record<Flavor, number>
  let assigned = 0
  flavors.forEach((f, i) => {
    const share = base.packsByFlavor[f] / actual
    scaled[f] = i === flavors.length - 1 ? packs - assigned : Math.floor(packs * share)
    assigned += scaled[f]
  })
  return {
    ...base,
    packsByFlavor: scaled,
    uniqueCustomers: Math.round((base.uniqueCustomers / actual) * packs),
    businessReferrals: packs >= 150 ? 1 : base.businessReferrals,
    weekStreak: packs >= 60 ? Math.max(base.weekStreak, 4) : base.weekStreak,
  }
}

export function TerritoryDashboard({
  referrer,
  shareLink,
}: {
  referrer: DemoReferrer
  shareLink: string
}) {
  const actualPacks = totalPacks(referrer.progress)
  const [simPacks, setSimPacks] = useState<number | null>(null)
  const packs = simPacks ?? actualPacks
  const simulating = simPacks !== null && simPacks !== actualPacks

  const progress = useMemo(
    () => simulate(referrer.progress, packs),
    [referrer.progress, packs]
  )

  const rank = rankFor(packs)
  const next = nextRank(packs)
  const rankIndex = rank ? RANKS.indexOf(rank) : -1
  const floor = rank?.packs ?? 0
  const toNext = next ? next.packs - packs : 0
  const pctToNext = next ? Math.min(1, (packs - floor) / (next.packs - floor)) : 1

  const trophyBonus = TROPHIES.filter((t) => trophyProgress(t, progress) >= t.goal).reduce(
    (sum, t) => sum + t.bonusCredit,
    0
  )
  const credit = lifetimeCredit(packs, trophyBonus)
  const balance = Math.max(0, credit.total - referrer.redeemedCredit)

  return (
    <div className="space-y-6">
      {/* Rank hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#141414]">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#9B30FF]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-[#FFD700]/10 blur-3xl"
        />
        <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
            <div className="relative shrink-0 self-center">
              <div className="absolute inset-4 rounded-full bg-[#9B30FF]/30 blur-2xl" aria-hidden />
              <Image
                key={rank?.id ?? 'none'}
                src={rank ? rankArt(rank.id) : rankArt('cub')}
                alt={rank ? `${rank.name} rank crest` : 'Locked rank crest'}
                width={176}
                height={176}
                className={cn(
                  'relative h-36 w-36 sm:h-44 sm:w-44 object-contain hq-pop',
                  !rank && 'grayscale brightness-50'
                )}
                priority
              />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-condensed text-xs uppercase tracking-[0.3em] text-[#A0A0A0]">
                Welcome back, {referrer.handle} · Rank {rankIndex + 1} of {RANKS.length}
              </p>
              <h1 className="font-wild text-5xl sm:text-6xl leading-none text-white mt-2">
                {rank?.name ?? 'Unranked'}
              </h1>
              <p className="text-sm text-[#A0A0A0] mt-2">
                {rank?.tagline ?? 'Sell your first 4-pack to get on the map.'}
              </p>

              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-white">
                    {packs} packs
                  </span>
                  <span className="text-[#A0A0A0]">
                    {next ? (
                      <>
                        <span className="text-[#FFD700] font-semibold">{toNext} to {next.name}</span> · {next.packs}
                      </>
                    ) : (
                      'Summit reached'
                    )}
                  </span>
                </div>
                <div
                  className="mt-2 h-3 rounded-full bg-[#0A0A0A] border border-[#2A2A2A] overflow-hidden"
                  role="progressbar"
                  aria-valuemin={floor}
                  aria-valuemax={next?.packs ?? packs}
                  aria-valuenow={packs}
                  aria-label={next ? `Progress to ${next.name}` : 'Max rank'}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7B2D8E] via-[#9B30FF] to-[#FFD700] transition-[width] duration-700"
                    style={{ width: `${pctToNext * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <Stat
              icon={Wallet}
              label="Wild Credit"
              value={formatCredit(balance)}
              hint={`${formatCredit(credit.total)} earned lifetime`}
              highlight
            />
            <Stat
              icon={TrendingUp}
              label="Per 4-pack"
              value={formatCredit(ratePerPack(packs))}
              hint={
                RANKS.find((r) => r.packs > packs && r.ratePerPack > ratePerPack(packs))
                  ? `Rate up at ${RANKS.find((r) => r.packs > packs && r.ratePerPack > ratePerPack(packs))!.name}`
                  : 'Top rate'
              }
            />
            <Stat icon={Package} label="4-packs sold" value={String(packs)} hint="Lifetime, via your code" />
            <Stat
              icon={Ticket}
              label="Code uses"
              value={String(simulating ? Math.round((referrer.codeUses / actualPacks) * packs) : referrer.codeUses)}
              hint={`${referrer.linkClicks} link clicks`}
            />
          </div>
        </div>
      </section>

      {/* Territory */}
      <TerritoryMap packs={packs} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TrophyCase progress={progress} earnedDates={simulating ? {} : referrer.earnedDates} />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <CodeCard code={referrer.code} link={shareLink} clicks={referrer.linkClicks} uses={referrer.codeUses} />
          {next && <NextUnlock packs={packs} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Ledger entries={referrer.ledger} />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <WeeklyChart weeks={referrer.weekly} streak={progress.weekStreak} />
          <FlavorMix packsByFlavor={progress.packsByFlavor} />
        </div>
      </div>

      <DemoControls
        packs={packs}
        actual={actualPacks}
        onChange={setSimPacks}
      />
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        highlight
          ? 'border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/[0.12] to-transparent'
          : 'border-[#2A2A2A] bg-[#0A0A0A]/60'
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A0]">
        <Icon className={cn('w-3.5 h-3.5', highlight && 'text-[#FFD700]')} />
        {label}
      </div>
      <div className="mt-1.5 font-display text-3xl font-bold text-white tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-[#777] truncate">{hint}</div>
    </div>
  )
}

function CodeCard({ code, link, clicks, uses }: { code: string; link: string; clicks: number; uses: number }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  async function copy(value: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      // Clipboard can be blocked (permissions / insecure origin); the text stays selectable.
    }
  }

  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">Your code</h2>
      <button
        type="button"
        onClick={() => copy(code.toUpperCase(), 'code')}
        className="group mt-3 w-full flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#9B30FF]/50 bg-[#9B30FF]/10 px-4 py-3 text-left hover:bg-[#9B30FF]/15 transition-colors"
      >
        <span className="font-headline text-2xl tracking-[0.12em] text-white">{code.toUpperCase()}</span>
        {copied === 'code' ? (
          <Check className="w-5 h-5 text-[#FFD700]" />
        ) : (
          <Copy className="w-5 h-5 text-[#C89BFF] group-hover:text-white" />
        )}
      </button>
      <button
        type="button"
        onClick={() => copy(link, 'link')}
        className="mt-2 w-full flex items-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-xs text-[#A0A0A0] hover:text-white transition-colors"
      >
        <Link2 className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{link}</span>
        <span className="ml-auto shrink-0 font-semibold text-[#C89BFF]">{copied === 'link' ? 'Copied' : 'Copy'}</span>
      </button>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[#0A0A0A] py-2">
          <dt className="text-[10px] uppercase tracking-wider text-[#777]">Clicks</dt>
          <dd className="font-display text-lg font-bold text-white tabular-nums">{clicks}</dd>
        </div>
        <div className="rounded-xl bg-[#0A0A0A] py-2">
          <dt className="text-[10px] uppercase tracking-wider text-[#777]">Uses</dt>
          <dd className="font-display text-lg font-bold text-white tabular-nums">{uses}</dd>
        </div>
        <div className="rounded-xl bg-[#0A0A0A] py-2">
          <dt className="text-[10px] uppercase tracking-wider text-[#777]">Convert</dt>
          <dd className="font-display text-lg font-bold text-white tabular-nums">
            {clicks ? `${((uses / clicks) * 100).toFixed(1)}%` : '—'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function NextUnlock({ packs }: { packs: number }) {
  const next = nextRank(packs)!
  const lines = [
    next.bonusCredit ? `${formatCredit(next.bonusCredit)} bonus Wild Credit` : null,
    ...next.unlocks,
  ].filter(Boolean) as string[]

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#FFD700]/25 bg-gradient-to-br from-[#1d1608] via-[#141414] to-[#141414] p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFD700]">
        <Gift className="w-3.5 h-3.5" /> Next unlock
      </h2>
      <div className="mt-3 flex items-center gap-4">
        <Image
          src={rewardArt(next.rewardArt)}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 object-contain drop-shadow-[0_8px_24px_rgba(255,215,0,0.25)]"
        />
        <div className="min-w-0">
          <p className="font-wild text-3xl text-white leading-none">{next.name}</p>
          <p className="text-xs text-[#A0A0A0] mt-1">at {next.packs} packs · {next.packs - packs} to go</p>
          <ul className="mt-2 space-y-1">
            {lines.map((line) => (
              <li key={line} className="flex items-start gap-1.5 text-sm text-white">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#FFD700]" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const LEDGER_ICON: Record<LedgerEntry['kind'], LucideIcon> = {
  sale: Package,
  rank: TrophyIcon,
  trophy: Flame,
  redeem: Wallet,
}

function Ledger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">Wild Credit activity</h2>
        <button
          type="button"
          className="rounded-full border border-[#FFD700]/40 px-3 py-1 text-xs font-semibold text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
        >
          Redeem credit
        </button>
      </div>
      <ul className="mt-4 divide-y divide-[#222]">
        {entries.map((e) => {
          const Icon = LEDGER_ICON[e.kind]
          const tint = e.flavor ? FLAVORS[e.flavor].color : e.kind === 'redeem' ? '#666' : '#FFD700'
          return (
            <li key={e.id} className="flex items-center gap-3 py-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                style={{ borderColor: `${tint}55`, backgroundColor: `${tint}1A` }}
              >
                <Icon className="w-4 h-4" style={{ color: tint }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{e.label}</p>
                <p className="text-xs text-[#777] truncate">{e.detail}</p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={cn(
                    'font-display text-base font-bold tabular-nums',
                    e.amount > 0 ? 'text-[#FFD700]' : e.amount < 0 ? 'text-[#A0A0A0]' : 'text-[#555]'
                  )}
                >
                  {e.amount > 0 ? '+' : e.amount < 0 ? '−' : ''}
                  {e.amount === 0 ? 'Unlock' : formatCredit(Math.abs(e.amount))}
                </p>
                <p className="text-[11px] text-[#555]">{format(parseISO(e.date), 'MMM d')}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DemoControls({
  packs,
  actual,
  onChange,
}: {
  packs: number
  actual: number
  onChange: (n: number | null) => void
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-[#FFD700]/40 bg-[#141414]/95 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FFD700] shadow-xl shadow-black/50 backdrop-blur hover:bg-[#1A1A1A]"
      >
        <SlidersHorizontal className="w-4 h-4" /> Demo progress
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-40 sm:w-80 rounded-2xl border border-[#FFD700]/40 bg-[#141414]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#FFD700]">Simulate lifetime packs</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[#777] hover:text-white" aria-label="Close demo controls">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={300}
          value={packs}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-[#9B30FF]"
          aria-label="Simulated lifetime 4-packs"
        />
        <span className="w-10 text-right font-display text-lg font-bold text-white tabular-nums">{packs}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[0, ...RANKS.map((r) => r.packs)].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] tabular-nums',
              n === packs ? 'border-[#9B30FF] text-white bg-[#9B30FF]/20' : 'border-[#2A2A2A] text-[#A0A0A0] hover:text-white'
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-auto flex items-center gap-1 rounded-full border border-[#2A2A2A] px-2 py-0.5 text-[11px] text-[#A0A0A0] hover:text-white"
        >
          <RotateCcw className="w-3 h-3" /> Jess ({actual})
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-[#666]">
        <MousePointerClick className="w-3 h-3" /> Mock-up only — drag to watch the territory build.
      </p>
    </div>
  )
}
