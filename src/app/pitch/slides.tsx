'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import {
  Anchor,
  Check,
  Clock,
  Crown,
  Flag,
  Home,
  Hotel,
  Martini,
  Minus,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Wine,
  X,
} from 'lucide-react'
import { drinks, groupImages } from '@/lib/drinks'
import {
  BREAK_EVEN,
  DISCLAIMER,
  DOORS_VELOCITY_MATRIX,
  EBITDA_SCENARIOS,
  FIVE_YEAR_BASE,
  RAISE,
  RETURN_SCENARIO,
  REVENUE_SCENARIOS,
  ROADMAP,
  YEAR5_SCENARIOS,
  YEARS,
} from './deck-data'
import { BreakEvenChart, RevenueBarChart, ScenarioLineChart } from './charts'

/* ============================================
   Shared building blocks
   ============================================ */

function SlideShell({
  kicker,
  title,
  intro,
  children,
  footnote,
}: {
  kicker: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  footnote?: string
}) {
  return (
    <div className="flex h-full w-full flex-col px-6 pb-20 pt-16 sm:px-10 md:px-16 md:pt-20 lg:px-24">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <p className="font-condensed text-xs font-bold uppercase tracking-[0.35em] text-gradient-wild md:text-sm">
          {kicker}
        </p>
        <h2 className="mt-3 font-condensed text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
          {title}
        </h2>
        {intro && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-untamed-white-muted md:text-lg">{intro}</p>
        )}
        <div className="mt-8 flex flex-1 flex-col justify-center md:mt-10">{children}</div>
        {footnote && (
          <p className="mt-6 text-[11px] leading-relaxed text-muted md:text-xs">{footnote}</p>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  title,
  body,
  accent = '#FFD700',
}: {
  icon?: ReactNode
  title: string
  body?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-untamed-black-card p-5 md:p-6">
      {icon && (
        <div
          className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          {icon}
        </div>
      )}
      <h3 className="font-condensed text-base font-bold uppercase tracking-wide md:text-lg">{title}</h3>
      {body && <p className="mt-2 text-xs leading-relaxed text-untamed-white-muted md:text-sm">{body}</p>}
    </div>
  )
}

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFD700]/10">
        <Check className="h-3.5 w-3.5 text-[#FFD700]" />
      </span>
      <span className="text-sm leading-relaxed text-untamed-white md:text-base">{children}</span>
    </li>
  )
}

function CompareMark({ value }: { value: 'yes' | 'no' | 'limited' | 'rarely' }) {
  if (value === 'yes') return <Check className="mx-auto h-5 w-5 text-[#FFD700]" />
  if (value === 'no') return <X className="mx-auto h-5 w-5 text-muted" />
  return (
    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-untamed-white-muted">
      <Minus className="h-4 w-4" />
      {value}
    </span>
  )
}

/* ============================================
   Section: Cover
   ============================================ */

function CoverSlide() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="relative z-10 flex flex-col items-center">
        <Image
          src="/images/logo-mark.png"
          alt="Untamed Beverages logo"
          width={120}
          height={120}
          className="h-20 w-20 md:h-28 md:w-28"
          priority
        />
        <h1 className="mt-6 font-headline text-5xl uppercase tracking-wide sm:text-7xl md:text-8xl">
          Untamed
        </h1>
        <p className="mt-2 font-condensed text-lg font-bold uppercase tracking-[0.3em] text-untamed-silver md:text-2xl">
          The Ready-to-Serve Martini Company
        </p>
        <p className="mt-8 font-condensed text-2xl font-bold uppercase tracking-tight text-gradient-wild sm:text-3xl md:text-5xl">
          Not Ready-to-Drink. Ready-to-Serve.
        </p>
        <p className="mt-4 max-w-xl text-sm text-untamed-white-muted md:text-lg">
          Premium cocktails crafted for the glass, not the can.
        </p>
        <p className="mt-10 font-condensed text-[11px] uppercase tracking-[0.3em] text-muted md:text-xs">
          Investor Presentation — Confidential
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center opacity-25">
        <Image
          src={groupImages.front}
          alt=""
          width={1200}
          height={500}
          className="h-auto w-[900px] max-w-none translate-y-1/3"
          priority
        />
      </div>
    </div>
  )
}

/* ============================================
   Section: The Category
   ============================================ */

function OpportunitySlide() {
  const wants = [
    { icon: <Sparkles className="h-5 w-5" />, title: 'Premium cocktail experiences' },
    { icon: <Home className="h-5 w-5" />, title: 'Entertaining at home' },
    { icon: <Clock className="h-5 w-5" />, title: 'Convenience without compromise' },
    { icon: <Martini className="h-5 w-5" />, title: 'Bar-quality drinks without the bartender' },
  ]
  return (
    <SlideShell
      kicker="The Category"
      title="Consumers want better at-home cocktails"
      intro="Yet most canned cocktails focus on convenience over experience — forcing a trade-off between quality, presentation, and ease."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {wants.map((w) => (
          <StatCard key={w.title} icon={w.icon} title={w.title} />
        ))}
      </div>
      <p className="mt-8 font-condensed text-xl font-bold uppercase leading-snug tracking-tight md:text-3xl">
        The market is crowded with RTD brands.{' '}
        <span className="text-gradient-wild">The RTS category is largely undefined.</span>
      </p>
    </SlideShell>
  )
}

function ProblemSlide() {
  return (
    <SlideShell kicker="The Category" title="Today's cocktail options miss the mark">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
          <h3 className="font-condensed text-lg font-bold uppercase tracking-wide md:text-xl">
            Ready-to-Drink cans
          </h3>
          <ul className="mt-4 space-y-3">
            {['Convenient, but lack sophistication', 'Poor serving experience', 'Often taste artificial or overly sweet'].map(
              (t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-untamed-white-muted md:text-base">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {t}
                </li>
              )
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
          <h3 className="font-condensed text-lg font-bold uppercase tracking-wide md:text-xl">
            Cocktails from scratch
          </h3>
          <ul className="mt-4 space-y-3">
            {['Time-consuming', 'Requires multiple ingredients and tools', 'Inconsistent results'].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-untamed-white-muted md:text-base">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-8 font-condensed text-xl font-bold uppercase tracking-tight md:text-3xl">
        Consumers want <span className="text-gradient-wild">both quality and convenience.</span>
      </p>
    </SlideShell>
  )
}

function SolutionSlide() {
  return (
    <SlideShell
      kicker="The Category"
      title={
        <>
          Introducing <span className="text-gradient-wild">Untamed</span>
        </>
      }
      intro="A premium ready-to-serve martini designed to deliver a true cocktail experience at home."
    >
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-4 md:gap-6">
            {['Chill', 'Pour', 'Serve'].map((step, i) => (
              <div key={step} className="flex items-center gap-4 md:gap-6">
                {i > 0 && <span className="h-px w-6 bg-card-border md:w-10" />}
                <span className="font-condensed text-3xl font-bold uppercase tracking-tight sm:text-4xl md:text-5xl">
                  {step}
                  <span className="text-gradient-wild">.</span>
                </span>
              </div>
            ))}
          </div>
          <ul className="mt-8 space-y-3">
            <CheckItem>No mixing. No measuring. No compromise.</CheckItem>
            <CheckItem>Bar-quality cocktails in seconds.</CheckItem>
            <CheckItem>Crafted for glassware, designed for sharing.</CheckItem>
          </ul>
        </div>
        <div className="hidden justify-center md:flex">
          <Image
            src={groupImages.front}
            alt="Untamed martini lineup"
            width={640}
            height={420}
            className="h-auto w-full max-w-md"
          />
        </div>
      </div>
    </SlideShell>
  )
}

function RtsVsRtdSlide() {
  return (
    <SlideShell kicker="The Category" title="Ready-to-Serve changes everything">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-untamed-white-muted">
            RTD — Ready-to-Drink
          </p>
          <ul className="mt-4 space-y-3">
            {['Single serve', 'Drink from the package', 'Convenience focused', 'Often lower ABV', 'Viewed as casual'].map(
              (t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-untamed-white-muted md:text-base">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {t}
                </li>
              )
            )}
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-[#FFD700]/40 bg-untamed-black-card p-6 md:p-8">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-gradient-wild">
            RTS — Ready-to-Serve
          </p>
          <ul className="mt-4 space-y-3">
            {[
              'Crafted for glassware',
              'Designed for sharing',
              'Cocktail occasion focused',
              'Premium experience',
              'Entertaining friendly',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm md:text-base">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD700]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-8 font-condensed text-xl font-bold uppercase tracking-tight md:text-3xl">
        Untamed is building <span className="text-gradient-wild">the RTS martini category.</span>
      </p>
    </SlideShell>
  )
}

function TrendsSlide() {
  const trends = [
    {
      icon: <TrendingUp className="h-5 w-5" />,
      title: 'Growth in premium spirits',
      body: 'Consumers are trading up across the spirits aisle.',
    },
    {
      icon: <Home className="h-5 w-5" />,
      title: 'Increased home entertaining',
      body: 'The occasion moved home — the experience expectation came with it.',
    },
    {
      icon: <Martini className="h-5 w-5" />,
      title: 'Restaurant-quality at home',
      body: 'People want bar-level drinks without leaving the house.',
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: 'Convenience with premium credentials',
      body: 'Effortless products win — when they still feel elevated.',
    },
  ]
  return (
    <SlideShell kicker="The Category" title="Consumers are trading up">
      <div className="grid gap-4 sm:grid-cols-2">
        {trends.map((t) => (
          <StatCard key={t.title} icon={t.icon} title={t.title} body={t.body} />
        ))}
      </div>
      <p className="mt-8 font-condensed text-xl font-bold uppercase tracking-tight md:text-3xl">
        Less effort. <span className="text-gradient-wild">Better experiences.</span>
      </p>
    </SlideShell>
  )
}

/* ============================================
   Section: The Product
   ============================================ */

function WhyUntamedWinsSlide() {
  const points = [
    { title: 'Two full martinis per can', body: 'Every 12 oz can pours two complete cocktails.' },
    { title: '15% ALC/VOL', body: 'Real cocktail strength — not a seltzer in disguise.' },
    { title: 'Premium martini recipes', body: 'Crafted flavor profiles built around premium vodka.' },
    { title: 'Premium packaging', body: 'Designed to look at home on a bar cart, not a cooler.' },
    { title: 'Roughly $3 per cocktail', body: 'Bar-quality martinis at an exceptional value.' },
    { title: 'Memorable feline branding', body: 'Four big-cat personalities consumers connect with.' },
  ]
  return (
    <SlideShell kicker="The Product" title="Why Untamed wins">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((p) => (
          <div key={p.title} className="rounded-2xl border border-card-border bg-untamed-black-card p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFD700]/10">
                <Check className="h-3.5 w-3.5 text-[#FFD700]" />
              </span>
              <div>
                <h3 className="font-condensed text-base font-bold uppercase tracking-wide md:text-lg">{p.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-untamed-white-muted md:text-sm">{p.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SlideShell>
  )
}

function ProductLineSlide() {
  return (
    <SlideShell
      kicker="The Product"
      title={
        <>
          Four personalities. <span className="text-gradient-wild">One untamed spirit.</span>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {drinks.map((d) => (
          <div
            key={d.slug}
            className="flex flex-col items-center rounded-2xl border border-card-border bg-untamed-black-card p-4 text-center md:p-6"
            style={{ boxShadow: `0 0 40px -18px ${d.colorGlow}` }}
          >
            <Image src={d.canImage} alt={`${d.name} — ${d.flavor}`} width={200} height={340} className="h-32 w-auto md:h-48" />
            <p
              className="cyber-brush-fix mt-4 font-wild text-xl md:text-2xl"
              style={{ color: d.colorLight }}
            >
              {d.name}
            </p>
            <p className="mt-1 font-condensed text-xs font-bold uppercase tracking-widest text-untamed-white md:text-sm">
              {d.flavor}
            </p>
            <p className="mt-2 hidden text-xs leading-relaxed text-untamed-white-muted md:block">{d.tagline}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-untamed-white-muted md:text-base">
        Each flavor is built around a unique big-cat personality and lifestyle identity — branding people remember,
        wear, and share.
      </p>
    </SlideShell>
  )
}

function PositioningSlide() {
  const rows: { label: string; rtd: 'yes' | 'no' | 'limited' | 'rarely'; untamed: 'yes' | 'no'; spirits: 'yes' | 'no' }[] = [
    { label: 'Convenient', rtd: 'yes', untamed: 'yes', spirits: 'no' },
    { label: 'Premium taste', rtd: 'limited', untamed: 'yes', spirits: 'yes' },
    { label: 'Served in glassware', rtd: 'rarely', untamed: 'yes', spirits: 'yes' },
    { label: 'No mixing or bartender', rtd: 'yes', untamed: 'yes', spirits: 'no' },
    { label: 'Built for entertaining', rtd: 'no', untamed: 'yes', spirits: 'yes' },
  ]
  return (
    <SlideShell kicker="The Product" title="Positioned between spirits and convenience">
      <div className="overflow-x-auto rounded-2xl border border-card-border">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-card-border bg-untamed-black-card">
              <th className="p-4 font-condensed text-xs font-bold uppercase tracking-widest text-untamed-white-muted md:text-sm" />
              <th className="p-4 text-center font-condensed text-xs font-bold uppercase tracking-widest text-untamed-white-muted md:text-sm">
                Traditional RTD
              </th>
              <th className="bg-[#FFD700]/5 p-4 text-center font-condensed text-xs font-bold uppercase tracking-widest text-gradient-wild md:text-sm">
                Untamed RTS
              </th>
              <th className="p-4 text-center font-condensed text-xs font-bold uppercase tracking-widest text-untamed-white-muted md:text-sm">
                Premium Spirits
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-card-border last:border-0">
                <td className="p-4 font-condensed text-sm font-bold uppercase tracking-wide md:text-base">{r.label}</td>
                <td className="p-4 text-center">
                  <CompareMark value={r.rtd} />
                </td>
                <td className="bg-[#FFD700]/5 p-4 text-center">
                  <CompareMark value={r.untamed} />
                </td>
                <td className="p-4 text-center">
                  <CompareMark value={r.spirits} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-8 font-condensed text-xl font-bold uppercase tracking-tight md:text-3xl">
        We sit between premium spirits and convenience beverages —{' '}
        <span className="text-gradient-wild">and deliver the best of both.</span>
      </p>
    </SlideShell>
  )
}

/* ============================================
   Section: The Business
   ============================================ */

function BusinessModelSlide() {
  const channels = [
    { icon: <Store className="h-5 w-5" />, title: 'Retail chains' },
    { icon: <Wine className="h-5 w-5" />, title: 'Independent liquor stores' },
    { icon: <Hotel className="h-5 w-5" />, title: 'Resorts & hospitality' },
    { icon: <Flag className="h-5 w-5" />, title: 'Golf clubs' },
    { icon: <Anchor className="h-5 w-5" />, title: 'Marina retailers' },
    { icon: <ShoppingCart className="h-5 w-5" />, title: 'Direct-to-consumer where permitted' },
  ]
  return (
    <SlideShell
      kicker="The Business"
      title="A scalable premium beverage platform"
      intro="Multiple revenue channels, designed for repeat purchase and strong customer loyalty."
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {channels.map((c) => (
          <StatCard key={c.title} icon={c.icon} title={c.title} />
        ))}
      </div>
      <p className="mt-8 font-condensed text-xl font-bold uppercase tracking-tight md:text-3xl">
        The goal: <span className="text-gradient-wild">America&apos;s leading Ready-to-Serve martini brand.</span>
      </p>
    </SlideShell>
  )
}

function RoadmapSlide() {
  return (
    <SlideShell
      kicker="The Business"
      title="Five years to category leadership"
      intro="Distribution-led growth: win Florida, expand across the Southeast, then scale nationally as the defining RTS brand."
    >
      <div className="grid gap-3 md:grid-cols-5 md:gap-4">
        {ROADMAP.map((step, i) => (
          <div
            key={step.year}
            className={`relative rounded-2xl border p-5 md:p-5 ${
              i === ROADMAP.length - 1
                ? 'border-[#FFD700]/40 bg-[#FFD700]/5'
                : 'border-card-border bg-untamed-black-card'
            }`}
          >
            <p className="font-condensed text-[11px] font-bold uppercase tracking-[0.25em] text-untamed-white-muted">
              {step.year}
            </p>
            <p className="mt-2 font-condensed text-base font-bold uppercase leading-tight tracking-wide md:text-lg">
              {step.milestone}
            </p>
            <p className={`mt-3 text-lg font-bold md:text-xl ${i === ROADMAP.length - 1 ? 'text-gradient-wild' : 'text-untamed-silver'}`}>
              {step.revenue}
            </p>
            {i === ROADMAP.length - 1 && <Crown className="absolute right-4 top-4 h-4 w-4 text-[#FFD700]" />}
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-untamed-white-muted md:text-base">
        Revenue milestones reflect the base case: $500K to $25M over five years, driven by door growth, velocity per
        door, and brand pull.
      </p>
    </SlideShell>
  )
}

/* ============================================
   Section: The Financials
   ============================================ */

function ProjectionSlide() {
  return (
    <SlideShell
      kicker="The Financials"
      title="Five-year base case"
      intro="Profitability in Year 3 while continuing aggressive geographic expansion."
      footnote={DISCLAIMER}
    >
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl border border-card-border">
          <table className="w-full min-w-[420px] text-left">
            <thead>
              <tr className="border-b border-card-border bg-untamed-black-card">
                {['Year', 'Doors', 'Revenue', 'GM', 'EBITDA'].map((h) => (
                  <th
                    key={h}
                    className="p-3 font-condensed text-[11px] font-bold uppercase tracking-widest text-untamed-white-muted md:p-4 md:text-xs"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIVE_YEAR_BASE.map((r) => (
                <tr key={r.year} className="border-b border-card-border last:border-0">
                  <td className="p-3 font-condensed text-sm font-bold uppercase md:p-4">{r.year}</td>
                  <td className="p-3 text-sm text-untamed-white-muted md:p-4">{r.doors.toLocaleString()}</td>
                  <td className="p-3 text-sm font-semibold md:p-4">{r.revenueLabel}</td>
                  <td className="p-3 text-sm text-untamed-white-muted md:p-4">{r.grossMargin}</td>
                  <td className={`p-3 text-sm font-semibold md:p-4 ${r.ebitda >= 0 ? 'text-[#FFD700]' : 'text-untamed-white-muted'}`}>
                    {r.ebitdaLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <RevenueBarChart data={FIVE_YEAR_BASE} />
        </div>
      </div>
    </SlideShell>
  )
}

function ScenarioDashboardSlide() {
  return (
    <SlideShell
      kicker="The Financials"
      title="Multiple paths to value creation"
      intro="Year 5 outcomes under conservative, base, and upside execution cases."
      footnote={DISCLAIMER}
    >
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {YEAR5_SCENARIOS.map((s) => (
          <div
            key={s.name}
            className={`rounded-2xl border p-6 md:p-8 ${
              s.name === 'Base' ? 'border-[#FFD700]/40 bg-[#FFD700]/5' : 'border-card-border bg-untamed-black-card'
            }`}
          >
            <p
              className="font-condensed text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: s.color }}
            >
              {s.name} case
            </p>
            <p className="mt-4 font-condensed text-4xl font-bold tracking-tight md:text-5xl">{s.revenue}</p>
            <p className="mt-1 font-condensed text-sm uppercase tracking-widest text-untamed-white-muted">Revenue</p>
            <div className="mt-5 space-y-1.5 border-t border-card-border pt-5 text-sm text-untamed-white-muted md:text-base">
              <p>
                <span className="font-semibold text-untamed-white">{s.ebitda}</span> EBITDA
              </p>
              <p>{s.doors}</p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-untamed-white-muted md:text-sm">{s.summary}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-untamed-white-muted md:text-base">
        <span className="font-semibold text-untamed-white">Investor takeaway:</span> the model is designed to show
        downside resilience and upside operating leverage as distribution scales.
      </p>
    </SlideShell>
  )
}

function RevenueSensitivitySlide() {
  return (
    <SlideShell
      kicker="The Financials"
      title="Revenue growth by scenario"
      intro="Distribution expansion, velocity per door, and RTS brand pull drive the revenue curve."
      footnote={DISCLAIMER}
    >
      <ScenarioLineChart
        series={REVENUE_SCENARIOS}
        categories={YEARS}
        yMin={0}
        yMax={48}
        yTicks={[0, 10, 20, 30, 40]}
      />
      <p className="mt-6 text-sm text-untamed-white-muted md:text-base">
        The base case scales from <span className="font-semibold text-untamed-white">$0.5M in Year 1</span> to{' '}
        <span className="font-semibold text-untamed-white">$25M in Year 5</span>.
      </p>
    </SlideShell>
  )
}

function EbitdaSlide() {
  return (
    <SlideShell
      kicker="The Financials"
      title="EBITDA path to break-even"
      intro="The base case reaches EBITDA profitability in Year 3; the upside case gets there earlier."
      footnote={DISCLAIMER}
    >
      <ScenarioLineChart
        series={EBITDA_SCENARIOS}
        categories={YEARS}
        yMin={-1}
        yMax={13}
        yTicks={[0, 3, 6, 9, 12]}
        zeroLineLabel="Break-even"
      />
      <p className="mt-6 text-sm text-untamed-white-muted md:text-base">
        Even the conservative case becomes EBITDA-positive by Year 4 in this illustrative model.
      </p>
    </SlideShell>
  )
}

function DoorsVelocitySlide() {
  const m = DOORS_VELOCITY_MATRIX
  return (
    <SlideShell
      kicker="The Financials"
      title="Year 5 revenue: doors x velocity"
      intro="Revenue upside comes from both more doors and stronger annual revenue per retail door."
      footnote={`${DISCLAIMER} Velocity assumptions are annual revenue per retail location.`}
    >
      <div className="overflow-x-auto rounded-2xl border border-card-border">
        <table className="w-full min-w-[560px] text-center">
          <thead>
            <tr className="border-b border-card-border bg-untamed-black-card">
              <th className="p-4" />
              {m.velocityLabels.map((label, i) => (
                <th key={label} className="p-4">
                  <p className="font-condensed text-xs font-bold uppercase tracking-widest text-untamed-white-muted md:text-sm">
                    {label}
                  </p>
                  <p className="mt-1 text-xs text-muted">{m.velocities[i]}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.rows.map((row, ri) => (
              <tr key={row.doors} className="border-b border-card-border last:border-0">
                <td className="p-4 text-left font-condensed text-sm font-bold uppercase tracking-wide md:text-base">
                  {row.doors}
                </td>
                {row.values.map((v, ci) => {
                  const isBase = ri === m.baseCell[0] && ci === m.baseCell[1]
                  return (
                    <td key={ci} className={`p-4 ${isBase ? 'bg-[#FFD700]/10' : ''}`}>
                      <span
                        className={`font-condensed text-xl font-bold md:text-2xl ${
                          isBase ? 'text-gradient-wild' : 'text-untamed-white'
                        }`}
                      >
                        {v}
                      </span>
                      {isBase && (
                        <p className="mt-0.5 font-condensed text-[10px] uppercase tracking-[0.25em] text-untamed-white-muted">
                          Base case
                        </p>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-8 text-sm text-untamed-white-muted md:text-base">
        <span className="font-semibold text-untamed-white">Investor takeaway:</span> Untamed can create value through
        door growth, velocity improvement, or both. Retail activation and repeat purchase rates are the core levers.
      </p>
    </SlideShell>
  )
}

function BreakEvenSlide() {
  return (
    <SlideShell
      kicker="The Financials"
      title="Break-even analysis"
      intro="Break-even revenue declines as gross margin improves."
      footnote={`${DISCLAIMER} Break-even doors assume ${BREAK_EVEN.velocityAssumption}.`}
    >
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-gradient-wild">
            Base case break-even
          </p>
          <dl className="mt-5 space-y-4">
            {[
              { label: 'Fixed OpEx assumption', value: BREAK_EVEN.fixedOpex },
              { label: 'Gross margin', value: BREAK_EVEN.baseGrossMargin },
              { label: 'Break-even revenue', value: BREAK_EVEN.baseRevenue, highlight: true },
              { label: 'Doors at $3,125 / door', value: BREAK_EVEN.doorsAtBase },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-card-border pb-4 last:border-0 last:pb-0">
                <dt className="text-sm text-untamed-white-muted md:text-base">{row.label}</dt>
                <dd className={`font-condensed text-2xl font-bold md:text-3xl ${row.highlight ? 'text-gradient-wild' : ''}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-muted md:text-sm">
            Break-even revenue = fixed operating expenses / gross margin
          </p>
        </div>
        <div>
          <BreakEvenChart data={BREAK_EVEN.byMargin} />
        </div>
      </div>
    </SlideShell>
  )
}

/* ============================================
   Section: The Ask
   ============================================ */

function RaiseSlide() {
  return (
    <SlideShell
      kicker="The Ask"
      title={
        <>
          Seeking <span className="text-gradient-wild">{RAISE.amount}</span> via {RAISE.instrument}
        </>
      }
      intro="Capital deployed against the levers that drive the model: inventory, distribution, activation, and brand."
    >
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-untamed-white-muted">
            Use of proceeds
          </p>
          <div className="mt-4 space-y-3">
            {RAISE.useOfFunds.map((u) => (
              <div key={u.label} className="flex items-center gap-4">
                <span className="w-44 shrink-0 text-xs text-untamed-white-muted sm:text-sm md:w-52">{u.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-untamed-black-card">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${u.pct}%`, backgroundColor: u.color, opacity: 0.9 }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-condensed text-sm font-bold md:text-base">{u.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-untamed-white-muted">
            Expected outcomes
          </p>
          <ul className="mt-4 space-y-3">
            {RAISE.outcomes.map((o) => (
              <CheckItem key={o}>{o}</CheckItem>
            ))}
          </ul>
        </div>
      </div>
    </SlideShell>
  )
}

function ReturnScenarioSlide() {
  return (
    <SlideShell
      kicker="The Ask"
      title="The scale opportunity"
      intro="Illustrative example only — if Untamed reaches the base case and is acquired by a strategic beverage company."
      footnote="This is not a guarantee. It demonstrates the scale opportunity created by establishing a new RTS category."
    >
      <div className="grid items-start gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-untamed-white-muted">
            Scenario assumptions
          </p>
          <ul className="mt-4 space-y-3">
            {RETURN_SCENARIO.assumptions.map((a) => (
              <CheckItem key={a}>{a}</CheckItem>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-untamed-white-muted md:text-base">
            Category creators command premium multiples. RTS positioning supports a potentially higher valuation
            multiple than a typical RTD brand.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
          {RETURN_SCENARIO.multiples.map((m, i) => (
            <div
              key={m.multiple}
              className={`rounded-2xl border p-6 text-center ${
                i === RETURN_SCENARIO.multiples.length - 1
                  ? 'border-[#FFD700]/40 bg-[#FFD700]/5'
                  : 'border-card-border bg-untamed-black-card'
              }`}
            >
              <p className="font-condensed text-xs font-bold uppercase tracking-[0.25em] text-untamed-white-muted">
                {m.multiple}
              </p>
              <p
                className={`mt-3 font-condensed text-4xl font-bold tracking-tight md:text-5xl ${
                  i === RETURN_SCENARIO.multiples.length - 1 ? 'text-gradient-wild' : ''
                }`}
              >
                {m.value}
              </p>
              <p className="mt-2 font-condensed text-[11px] uppercase tracking-widest text-muted">Enterprise value</p>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  )
}

function ThesisSlide() {
  const points = [
    'Creating the RTS (Ready-to-Serve) martini category',
    'Strong premium positioning',
    'Distinctive lifestyle branding',
    'Attractive unit economics',
    'Scalable distribution model',
    'Significant acquisition potential',
  ]
  return (
    <SlideShell kicker="The Ask" title="Why Untamed?">
      <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
        {points.map((p) => (
          <CheckItem key={p}>{p}</CheckItem>
        ))}
      </ul>
      <blockquote className="mt-10 max-w-4xl border-l-2 border-[#FFD700] pl-6">
        <p className="text-base leading-relaxed text-untamed-white md:text-xl">
          &ldquo;RTD was built for convenience. RTS is built for occasions. Untamed delivers a premium martini
          experience wherever people gather.&rdquo;
        </p>
      </blockquote>
    </SlideShell>
  )
}

function VisionSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
      <p className="font-condensed text-xs font-bold uppercase tracking-[0.35em] text-gradient-wild md:text-sm">
        The Vision
      </p>
      <h2 className="mt-6 font-condensed text-3xl font-bold uppercase leading-tight tracking-tight sm:text-5xl md:text-6xl">
        RTD is convenience.
        <br />
        <span className="text-gradient-wild">RTS is an experience.</span>
      </h2>
      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-untamed-white-muted md:text-lg">
        Consumers do not want another canned cocktail. They want a premium cocktail experience that is ready to serve,
        ready to share, and ready to impress. Untamed Beverages is building America&apos;s first defining
        Ready-to-Serve martini brand.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {['Ready to Serve', 'Ready to Share', 'Ready to Impress'].map((t) => (
          <span
            key={t}
            className="rounded-full border border-card-border bg-untamed-black-card px-5 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-untamed-silver md:text-sm"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="cyber-brush-fix mt-12 font-wild text-4xl text-gradient-wild md:text-6xl">Live Life Untamed</p>
      <p className="mt-8 font-condensed text-[11px] uppercase tracking-[0.3em] text-muted md:text-xs">
        Untamed Beverages, LLC — untamedbevs.com — Please drink responsibly. 21+
      </p>
    </div>
  )
}

/* ============================================
   Slide registry
   ============================================ */

export interface SlideDef {
  id: string
  section: string
  title: string
  render: () => ReactNode
}

export const SLIDES: SlideDef[] = [
  { id: 'cover', section: 'Untamed', title: 'Cover', render: () => <CoverSlide /> },
  { id: 'opportunity', section: 'The Category', title: 'The Opportunity', render: () => <OpportunitySlide /> },
  { id: 'problem', section: 'The Category', title: 'The Problem', render: () => <ProblemSlide /> },
  { id: 'solution', section: 'The Category', title: 'The Solution', render: () => <SolutionSlide /> },
  { id: 'rts-vs-rtd', section: 'The Category', title: 'RTS vs RTD', render: () => <RtsVsRtdSlide /> },
  { id: 'trends', section: 'The Category', title: 'Market Trends', render: () => <TrendsSlide /> },
  { id: 'why-untamed', section: 'The Product', title: 'Why Untamed Wins', render: () => <WhyUntamedWinsSlide /> },
  { id: 'lineup', section: 'The Product', title: 'Product Line', render: () => <ProductLineSlide /> },
  { id: 'positioning', section: 'The Product', title: 'Market Positioning', render: () => <PositioningSlide /> },
  { id: 'model', section: 'The Business', title: 'Business Model', render: () => <BusinessModelSlide /> },
  { id: 'roadmap', section: 'The Business', title: 'Growth Roadmap', render: () => <RoadmapSlide /> },
  { id: 'projection', section: 'The Financials', title: 'Five-Year Base Case', render: () => <ProjectionSlide /> },
  { id: 'scenarios', section: 'The Financials', title: 'Scenario Dashboard', render: () => <ScenarioDashboardSlide /> },
  { id: 'revenue-sensitivity', section: 'The Financials', title: 'Revenue Sensitivity', render: () => <RevenueSensitivitySlide /> },
  { id: 'ebitda', section: 'The Financials', title: 'EBITDA Path', render: () => <EbitdaSlide /> },
  { id: 'doors-velocity', section: 'The Financials', title: 'Doors x Velocity', render: () => <DoorsVelocitySlide /> },
  { id: 'break-even', section: 'The Financials', title: 'Break-Even', render: () => <BreakEvenSlide /> },
  { id: 'raise', section: 'The Ask', title: 'The Raise', render: () => <RaiseSlide /> },
  { id: 'returns', section: 'The Ask', title: 'Scale Opportunity', render: () => <ReturnScenarioSlide /> },
  { id: 'thesis', section: 'The Ask', title: 'Investment Thesis', render: () => <ThesisSlide /> },
  { id: 'vision', section: 'The Ask', title: 'Vision', render: () => <VisionSlide /> },
]
