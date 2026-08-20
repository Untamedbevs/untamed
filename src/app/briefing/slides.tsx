'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  Car,
  Check,
  Clapperboard,
  Clock,
  ExternalLink,
  Gauge,
  Images,
  Megaphone,
  Radio,
  Repeat,
  Target,
  Timer,
  Unplug,
  User,
  Workflow,
  X,
} from 'lucide-react'
import {
  ALREADY_BUILT,
  ASSUMPTIONS,
  BASE_UNIT,
  CASES_PER_ORDER,
  COLORS,
  CONSERVATIVE_UNIT,
  CONTENT_PLAN,
  DISCLAIMER,
  PLATFORM_MIX,
  SCALE_FUNNELS,
  SCALE_ROWS,
  SHELF_VELOCITY,
  TEAM_COST,
  THROUGHPUT,
  TURN_ON,
  UNIT_COST,
  UNIT_FUNNELS,
  UPSIDE_UNIT,
  compact,
  money,
  type FunnelScenario,
} from './deck-data'
import {
  CanHero,
  DeckCover,
  SlideFrame,
  SpiritCard,
  spiritAt,
  type SlideTheme,
} from '@/components/deck/brand'
import { drinks } from '@/lib/drinks'

const SECTION_THEMES: Record<string, SlideTheme> = {
  TheQuestion: {
    accent: '#FFD700',
    animal: '/images/animal-lioness.png',
    scratch: '/images/scratch-lioness.png',
  },
  TheUnit: {
    accent: '#FF8C2A',
    animal: '/images/animal-lioness.png',
  },
  TheMachine: {
    accent: '#9B30FF',
    animal: '/images/animal-black-panther.png',
  },
  TheScale: {
    accent: '#E6D800',
    animal: '/images/animal-cheetah.png',
  },
  TheAsk: {
    accent: '#6B8E23',
    animal: '/images/animal-cougar.png',
  },
}

function themeFor(section: string): SlideTheme {
  return SECTION_THEMES[section] ?? SECTION_THEMES.TheAsk
}

function SlideShell({
  section,
  title,
  intro,
  children,
  footnote,
  hideAnimal,
}: {
  section: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  footnote?: string
  hideAnimal?: boolean
}) {
  return (
    <SlideFrame
      section={section}
      title={title}
      intro={intro}
      footnote={footnote}
      hideAnimal={hideAnimal}
      theme={themeFor(section)}
    >
      {children}
    </SlideFrame>
  )
}

function CoverSlide() {
  return (
    <DeckCover
      scratch="/images/scratch-panther.png"
      eyebrow="Retail Lead Engine"
      sub="What $3,500 of inbound demand does versus $3,500 of one salesperson."
      footer="Owner Briefing — Confidential"
    />
  )
}

function QuestionSlide() {
  return (
    <SlideShell
      section="TheQuestion"
      title={<>The $7,000 question</>}
      intro="Two people are being paid $3,500 each to walk into retailers one by one. Documented output is effectively zero. That is $84,000 a year with no funnel, no attribution, and no compounding."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Monthly burn', value: money(TEAM_COST), sub: 'two people × $3,500' },
          { label: 'Documented shelves', value: '0', sub: 'accounts actually carrying us' },
          { label: 'Cost per shelf', value: '∞', sub: 'undefined when output is zero' },
        ].map((c, i) => (
          <SpiritCard key={c.label} drink={spiritAt(i)} className="p-6">
            <p className="font-condensed text-xs uppercase tracking-[0.25em] text-muted">{c.label}</p>
            <p className="mt-2 font-condensed text-4xl font-bold text-[#FFD700] md:text-5xl">{c.value}</p>
            <p className="mt-2 text-sm text-untamed-white-muted">{c.sub}</p>
          </SpiritCard>
        ))}
      </div>
      <p className="mt-8 font-condensed text-xl font-bold uppercase md:text-2xl">
        We already built the other machine.{' '}
        <span className="text-gradient-wild">We have not turned it on.</span>
      </p>
    </SlideShell>
  )
}

function SalespersonSlide() {
  return (
    <SlideShell
      section="TheUnit"
      title={<>What $3,500 buys today</>}
      intro="One salesperson. Hours in a car. Unmeasured conversations. No after-hours coverage. No lookalike from a win. When they leave, the pipeline leaves with them."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-card-border bg-untamed-black-card/80 p-6">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8C2A]/15 text-[#FF8C2A]">
            <Car className="h-5 w-5" />
          </div>
          <h3 className="font-condensed text-lg font-bold uppercase">You buy time</h3>
          <ul className="mt-4 space-y-3 text-sm text-untamed-white-muted">
            {[
              'Capacity is linear — 8 hours, one geography',
              'No first-touch record of how the account found us',
              'No creative learning. Every account is cold again.',
              'Referral program cannot attach to a walk-in',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-[#ef4444]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/5 p-6">
          <p className="font-condensed text-xs uppercase tracking-[0.25em] text-[#FFD700]">Unit price</p>
          <p className="mt-2 font-condensed text-5xl font-bold">{money(UNIT_COST)}</p>
          <p className="mt-3 text-sm text-untamed-white-muted">
            Same dollars we will put into inbound demand, landing pages, and a CMO workbench that Joe already uses.
          </p>
          <p className="mt-6 font-condensed text-sm uppercase tracking-widest text-muted">
            Two of these = {money(TEAM_COST)} / month
          </p>
        </div>
      </div>
    </SlideShell>
  )
}

function MachineSlide() {
  const openingCases = BASE_UNIT.shelves * CASES_PER_ORDER
  const steps = [
    { label: 'Impressions', value: compact(BASE_UNIT.impressions) },
    { label: 'Clicks', value: BASE_UNIT.clicks.toLocaleString() },
    { label: 'Leads', value: String(BASE_UNIT.leads) },
    { label: 'Contacted', value: String(BASE_UNIT.contacted) },
    { label: 'Qualified', value: String(BASE_UNIT.qualified) },
    { label: 'Shelves', value: String(BASE_UNIT.shelves) },
    { label: 'Cases', value: String(openingCases) },
  ]
  return (
    <SlideShell
      section="TheMachine"
      title={<>What $3,500 buys as a machine</>}
      intro={`Base-case at the same unit cost as one salesperson. Each new shelf opens at ${CASES_PER_ORDER} cases. Every lead has a source. Joe works inbound within 48 hours.`}
      footnote={DISCLAIMER}
      hideAnimal
    >
      <div className="flex flex-wrap items-stretch gap-2 md:gap-3">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 md:gap-3">
            <SpiritCard drink={spiritAt(i)} className="min-w-[5.25rem] px-3 py-4 text-center md:min-w-[6.25rem] md:px-4">
              <p className="font-condensed text-2xl font-bold text-[#FFD700] md:text-3xl">{s.value}</p>
              <p className="mt-1 font-condensed text-[10px] uppercase tracking-widest text-muted">{s.label}</p>
            </SpiritCard>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted sm:block" />
            )}
          </div>
        ))}
        <div className="hidden items-end pl-1 md:flex">
          <CanHero drink={drinks[0]} size="sm" />
        </div>
      </div>
      <p className="mt-3 font-condensed text-xs uppercase tracking-widest text-untamed-white-muted">
        Average opening order · {CASES_PER_ORDER} cases per shelf
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SpiritCard drink={spiritAt(0)}>
          <p className="font-condensed text-xs uppercase tracking-widest text-muted">Cost per lead</p>
          <p className="mt-1 font-condensed text-3xl font-bold">{money(BASE_UNIT.cpl)}</p>
        </SpiritCard>
        <SpiritCard drink={spiritAt(1)}>
          <p className="font-condensed text-xs uppercase tracking-widest text-muted">Cost per shelf</p>
          <p className="mt-1 font-condensed text-3xl font-bold">{money(BASE_UNIT.costPerShelf)}</p>
        </SpiritCard>
        <SpiritCard drink={spiritAt(2)}>
          <p className="font-condensed text-xs uppercase tracking-widest text-muted">Opening cases</p>
          <p className="mt-1 font-condensed text-3xl font-bold">{openingCases}</p>
          <p className="mt-1 text-xs text-untamed-white-muted">
            {BASE_UNIT.shelves} shelves × {CASES_PER_ORDER} cases
          </p>
        </SpiritCard>
      </div>
      <div
        className="mt-4 rounded-2xl border p-5"
        style={{
          borderColor: 'rgba(255, 215, 0, 0.55)',
          boxShadow: '0 0 60px -16px rgba(255, 215, 0, 0.45)',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,140,42,0.06))',
        }}
      >
        <p className="font-condensed text-xs uppercase tracking-widest text-[#FFD700]">
          Annual velocity from this month
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-condensed text-3xl font-bold text-[#FFD700] md:text-4xl">
            {money(BASE_UNIT.annualVelocity)}
          </p>
          <p className="font-condensed text-lg uppercase tracking-wide text-untamed-white">
            {BASE_UNIT.shelves} shelves × {money(SHELF_VELOCITY)}
          </p>
        </div>
        <p className="mt-2 text-sm text-untamed-white-muted">
          {money(BASE_UNIT.annualVelocity)} / {BASE_UNIT.shelves} = {money(SHELF_VELOCITY)} per shelf per year
          — existing financial model, not a new assumption.
        </p>
      </div>
    </SlideShell>
  )
}

function HeadToHeadSlide() {
  const rows = [
    { label: 'Monthly cost', sales: money(UNIT_COST), machine: money(UNIT_COST) },
    { label: 'What you buy', sales: 'Hours in a car', machine: 'Inbound demand + attribution' },
    { label: 'Leads / month', sales: 'Unmeasured', machine: String(BASE_UNIT.leads) },
    { label: 'Shelves / month', sales: '~0', machine: String(BASE_UNIT.shelves) },
    { label: 'Cost per shelf', sales: '∞', machine: money(BASE_UNIT.costPerShelf) },
    { label: 'Compounds?', sales: 'No', machine: 'Yes — lookalikes, referrals, creative' },
    { label: 'After hours', sales: 'Off', machine: 'Ads still run' },
  ]
  return (
    <SlideShell
      section="TheUnit"
      title={<>$3,500 vs $3,500</>}
      intro="Same dollars. Different machine. Base-case digital versus one salesperson at the unit you are already paying."
      footnote={DISCLAIMER}
    >
      <div className="overflow-hidden rounded-2xl border border-card-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-card-border bg-untamed-black-card">
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted"> </th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-untamed-white-muted">
                1 salesperson
              </th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-[#FFD700]">
                The machine
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-card-border last:border-0">
                <td className="px-4 py-3 font-condensed text-xs uppercase tracking-wider text-muted">{r.label}</td>
                <td className="px-4 py-3 text-untamed-white-muted">{r.sales}</td>
                <td className="px-4 py-3 font-medium text-white">{r.machine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SlideShell>
  )
}

function InstrumentedFunnelSlide() {
  const steps = [
    { icon: Megaphone, title: 'Spend', body: 'Meta + Google, synced daily. You see the dollars.' },
    { icon: Radio, title: 'Impressions & clicks', body: 'UTM, gclid, fbclid on every session.' },
    { icon: Target, title: 'Landing page', body: 'Campaign LPs. Form start and form complete as events.' },
    { icon: Workflow, title: 'Lead', body: 'First-touch waterfall onto the retailer record.' },
    { icon: Timer, title: 'CMO contact', body: '48-hour SLA clock. Activity log. Next action.' },
    { icon: Check, title: 'Shelf', body: 'Converted means we are carried. Cost per shelf. Annual velocity.' },
  ]
  return (
    <SlideShell
      section="TheMachine"
      title={<>Every step gets a number</>}
      intro="This is the funnel we instrument. If a dollar cannot be followed from impression to a shelf we sit on, it does not get spent twice."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="rounded-2xl border border-card-border bg-untamed-black-card/80 p-5">
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#9B30FF]/15 text-[#9B30FF]">
              <s.icon className="h-4 w-4" />
            </div>
            <h3 className="font-condensed text-base font-bold uppercase">{s.title}</h3>
            <p className="mt-1.5 text-sm text-untamed-white-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  )
}

function scenarioCells(s: FunnelScenario) {
  return [
    compact(s.impressions),
    s.clicks.toLocaleString(),
    String(s.leads),
    money(s.cpl),
    String(s.qualified),
    String(s.shelves),
    money(s.costPerShelf),
    money(s.annualVelocity),
  ]
}

function ScenariosSlide() {
  const headers = ['Impr.', 'Clicks', 'Leads', 'CPL', 'Qualified', 'Shelves', '$ / shelf', 'Velocity']
  return (
    <SlideShell
      section="TheMachine"
      title={<>Conservative / base / upside</>}
      intro={`All three at ${money(UNIT_COST)} / month. Attack the assumptions, not the vibe. The appendix lists every input.`}
      footnote={DISCLAIMER}
    >
      <div className="overflow-x-auto rounded-2xl border border-card-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-card-border bg-untamed-black-card">
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Case</th>
              {headers.map((h) => (
                <th key={h} className="px-3 py-3 font-condensed text-xs uppercase tracking-widest text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UNIT_FUNNELS.map((s) => (
              <tr
                key={s.name}
                className="border-b border-card-border last:border-0"
                style={s.name === 'Base' ? { backgroundColor: '#FFD7000D' } : undefined}
              >
                <td className="px-4 py-3 font-condensed font-bold uppercase" style={{ color: s.color }}>
                  {s.name}
                </td>
                {scenarioCells(s).map((cell, i) => (
                  <td key={i} className="px-3 py-3 text-white">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-untamed-white-muted">
        Conservative still produces {CONSERVATIVE_UNIT.shelves} shelves / month. Upside produces {UPSIDE_UNIT.shelves}.
        The salesperson produces ~0 in every case.
      </p>
    </SlideShell>
  )
}

function ScaleSlide() {
  return (
    <SlideShell
      section="TheScale"
      title={<>Then we scale the unit</>}
      intro="Two salespeople are $7,000 of the same zero. The machine at $7,000 and $15,000 still reports shelves. At $7k+ the constraint is the closer, not the ads."
      footnote={DISCLAIMER}
    >
      <div className="overflow-hidden rounded-2xl border border-card-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-card-border bg-untamed-black-card">
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Option</th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Spend</th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Shelves / mo</th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">$ / shelf</th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Annual velocity</th>
            </tr>
          </thead>
          <tbody>
            {SCALE_ROWS.map((r) => (
              <tr
                key={r.label}
                className="border-b border-card-border last:border-0"
                style={r.kind === 'machine' ? { backgroundColor: '#FFD70008' } : undefined}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{r.label}</p>
                  <p className="text-xs text-muted">{r.note}</p>
                </td>
                <td className="px-4 py-3">{money(r.spend)}</td>
                <td className="px-4 py-3 font-condensed text-lg font-bold" style={{ color: r.kind === 'machine' ? COLORS.gold : COLORS.muted }}>
                  {r.shelves}
                </td>
                <td className="px-4 py-3">{r.costPerShelf == null ? '∞' : money(r.costPerShelf)}</td>
                <td className="px-4 py-3">{r.annualVelocity ? money(r.annualVelocity) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SlideShell>
  )
}

function VelocitySlide() {
  return (
    <SlideShell
      section="TheScale"
      title={<>Shelves pay for the machine</>}
      intro={`Existing financial model: ${money(SHELF_VELOCITY)} average annual revenue per retail location. One month of base-case shelves is more annual velocity than a year of the sales team at zero.`}
      footnote={DISCLAIMER}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-card-border p-6">
          <p className="font-condensed text-xs uppercase tracking-widest text-muted">Sales team, 12 months</p>
          <p className="mt-2 font-condensed text-4xl font-bold text-untamed-white-muted">{money(TEAM_COST * 12)}</p>
          <p className="mt-2 text-sm text-untamed-white-muted">spent. {money(0)} of documented shelf velocity.</p>
        </div>
        <div className="rounded-2xl border border-[#FFD700]/40 bg-[#FFD700]/5 p-6">
          <p className="font-condensed text-xs uppercase tracking-widest text-[#FFD700]">Machine, one base month</p>
          <p className="mt-2 font-condensed text-4xl font-bold text-[#FFD700]">{money(BASE_UNIT.annualVelocity)}</p>
          <p className="mt-2 text-sm text-untamed-white-muted">
            annual velocity from {BASE_UNIT.shelves} new shelves. Cost {money(UNIT_COST)}.
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm text-untamed-white-muted">
        At $7k media (base, capacity-adjusted): {SCALE_FUNNELS.seven.shelves} shelves / month,{' '}
        {money(SCALE_FUNNELS.seven.annualVelocity)} annual velocity. Still cheaper per shelf than a walker who closes nothing.
      </p>
    </SlideShell>
  )
}

function CompoundingSlide() {
  const items = [
    { icon: Repeat, title: 'Referrals already live', body: 'Converted retailers become referrers. The form already credits distributor_lead events.' },
    { icon: Target, title: 'Lookalikes from wins', body: 'Every converted email is a seed audience. Walkers cannot do this.' },
    { icon: Megaphone, title: 'Creative studio already live', body: 'Ideas → flows → studio → schedule. We feed Meta without an agency retainer.' },
    { icon: Gauge, title: 'Learning loop', body: 'CTR, CPL, and cost-per-shelf get better. A salesperson does not get 20% more efficient each month.' },
  ]
  return (
    <SlideShell
      section="TheScale"
      title={<>This compounds. Walking does not.</>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((s) => (
          <div key={s.title} className="rounded-2xl border border-card-border bg-untamed-black-card/80 p-5">
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E6D800]/15 text-[#E6D800]">
              <s.icon className="h-4 w-4" />
            </div>
            <h3 className="font-condensed text-base font-bold uppercase">{s.title}</h3>
            <p className="mt-1.5 text-sm text-untamed-white-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  )
}

function ContentPlanSlide() {
  const icons = [User, Clapperboard, Images]
  return (
    <SlideShell
      section="TheScale"
      title={<>The content game plan</>}
      intro="Three engines, one studio. Founder-led social seeds the story. Video is what we buy. Statics hold the line and retarget. We already make this — we have not pointed it at retail buyers."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {CONTENT_PLAN.map((c, i) => {
          const Icon = icons[i]
          return (
            <div key={c.title} className="rounded-2xl border border-card-border bg-untamed-black-card/80 p-5">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E6D800]/15 text-[#E6D800]">
                <Icon className="h-4 w-4" />
              </div>
              <p className="font-condensed text-[11px] uppercase tracking-widest text-[#FFD700]">{c.role}</p>
              <h3 className="mt-1 font-condensed text-lg font-bold uppercase">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-untamed-white-muted">{c.body}</p>
              <p className="mt-4 text-xs leading-relaxed text-white">
                <span className="font-condensed uppercase tracking-widest text-muted">Best home · </span>
                {c.best}
              </p>
            </div>
          )
        })}
      </div>
    </SlideShell>
  )
}

function PlatformMixSlide() {
  return (
    <SlideShell
      section="TheScale"
      title={<>Where it runs</>}
      intro="At the $3,500 unit we do not spray. Meta is the brand home. Google Search catches people already looking. LinkedIn is a capped test for owners and distributors. TikTok is a cheap video test."
      footnote={DISCLAIMER}
    >
      <div className="overflow-hidden rounded-2xl border border-card-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-card-border bg-untamed-black-card">
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Platform</th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Share</th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Fit</th>
              <th className="px-4 py-3 font-condensed text-xs uppercase tracking-widest text-muted">Why</th>
            </tr>
          </thead>
          <tbody>
            {PLATFORM_MIX.map((p) => (
              <tr key={p.name} className="border-b border-card-border last:border-0">
                <td className="px-4 py-3 font-condensed font-bold uppercase text-white">{p.name}</td>
                <td className="px-4 py-3 whitespace-nowrap text-[#FFD700]">{p.share}</td>
                <td className="px-4 py-3 whitespace-nowrap text-untamed-white-muted">{p.fit}</td>
                <td className="px-4 py-3 text-sm text-untamed-white-muted">{p.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SlideShell>
  )
}

function ThroughputSlide() {
  return (
    <SlideShell
      section="TheAsk"
      title={<>Click through the machine</>}
      intro="Ads go to these landing pages. Leads show up here. Open any link — these are the live screens, not mockups. Admin pages ask you to sign in."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {THROUGHPUT.map((col, i) => (
          <SpiritCard key={col.step} drink={spiritAt(i)} className="flex flex-col p-4">
            <p className="font-condensed text-xs uppercase tracking-[0.3em]" style={{ color: spiritAt(i).colorLight }}>
              {col.step}
            </p>
            <h3 className="mt-1 font-condensed text-lg font-bold uppercase">{col.title}</h3>
            <p className="mt-1.5 text-sm text-untamed-white-muted">{col.body}</p>
            <ul className="mt-4 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start justify-between gap-3 rounded-xl border border-card-border px-3 py-2.5 transition-colors hover:border-[#FFD700]/50 hover:bg-[#FFD700]/5"
                  >
                    <span className="min-w-0">
                      <span className="block font-condensed text-sm font-bold uppercase text-white">
                        {link.label}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-[#FFD700]">
                        {link.href}
                      </span>
                      <span className="mt-0.5 block text-xs text-untamed-white-muted">{link.hint}</span>
                    </span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted group-hover:text-[#FFD700]" />
                  </Link>
                </li>
              ))}
            </ul>
          </SpiritCard>
        ))}
      </div>
    </SlideShell>
  )
}

function BuiltSlide() {
  return (
    <SlideShell
      section="TheAsk"
      title={<>Already built. Not turned on.</>}
      intro="The stack is live. Attribution, campaign pages, Joe’s workbench, the funnel dashboard, referrals, and the content engine are in the product today. What’s left is pointing paid media at it and putting Joe on inbound."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {ALREADY_BUILT.map((b, i) => (
          <SpiritCard key={b.label} drink={spiritAt(i)} className="flex items-start gap-3 p-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B8E23]/20">
              <Check className="h-3.5 w-3.5 text-[#6B8E23]" />
            </span>
            <div>
              <p className="font-condensed text-sm font-bold uppercase">{b.label}</p>
              <p className="mt-0.5 text-sm text-untamed-white-muted">{b.detail}</p>
            </div>
          </SpiritCard>
        ))}
      </div>
      <p className="mt-6 font-condensed text-xl font-bold uppercase md:text-2xl">
        Already built.{' '}
        <span className="text-gradient-wild">Not turned on.</span>
      </p>
    </SlideShell>
  )
}

function TimelineSlide() {
  return (
    <SlideShell
      section="TheAsk"
      title={<>30 / 60 / 90</>}
      intro="Turn the rest on. Then spend. Then decide."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {TURN_ON.map((t) => (
          <div key={t.day} className="rounded-2xl border border-card-border bg-untamed-black-card/80 p-6">
            <p className="font-condensed text-xs uppercase tracking-[0.3em] text-[#FFD700]">Day {t.day}</p>
            <h3 className="mt-1 font-condensed text-2xl font-bold uppercase">{t.title}</h3>
            <ul className="mt-4 space-y-2 text-sm text-untamed-white-muted">
              {t.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B8E23]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SlideShell>
  )
}

function CmoDaySlide() {
  return (
    <SlideShell
      section="TheAsk"
      title={<>Joe’s day changes</>}
      intro="The machine does not replace the closer. It feeds him. Walkers hope someone is in the back. Inbound is a named buyer who asked to talk."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-card-border p-6">
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
            <Unplug className="h-4 w-4 text-muted" />
          </div>
          <h3 className="font-condensed text-lg font-bold uppercase text-untamed-white-muted">Today</h3>
          <ul className="mt-4 space-y-2 text-sm text-untamed-white-muted">
            <li>Hope a walker emails a name</li>
            <li>No source, no campaign, no SLA</li>
            <li>Notes in someone’s head</li>
            <li>Cannot tell owners what $7k did</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[#FFD700]/40 bg-[#FFD700]/5 p-6">
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FFD700]/15 text-[#FFD700]">
            <Clock className="h-4 w-4" />
          </div>
          <h3 className="font-condensed text-lg font-bold uppercase">With the machine</h3>
          <ul className="mt-4 space-y-2 text-sm text-untamed-white">
            <li>Kanban of warm inbound, 48h clock</li>
            <li>Every card shows which ad created it</li>
            <li>Call, email, sample, meeting — logged</li>
            <li>Owners see spend → shelves on one page</li>
          </ul>
        </div>
      </div>
    </SlideShell>
  )
}

function AskSlide() {
  return (
    <SlideShell
      section="TheAsk"
      title={<>The ask</>}
      intro="Not the full $7,000. A reasonable test so we can see what happens."
    >
      <ol className="space-y-4">
        {[
          `Run 90 days at the ${money(UNIT_COST)} unit — one salesperson’s cost, not the whole team.`,
          'Keep Joe on inbound. Do not hire another walker while we learn.',
          'Read cost per shelf. Kill it, keep it, or scale toward $7k only if shelves show up.',
        ].map((t, i) => (
          <li key={t} className="flex items-start gap-4">
            <span className="font-condensed text-2xl font-bold text-[#FFD700]">{String(i + 1).padStart(2, '0')}</span>
            <p className="pt-1 text-base text-untamed-white md:text-lg">{t}</p>
          </li>
        ))}
      </ol>
      <p className="mt-10 font-condensed text-2xl font-bold uppercase md:text-3xl">
        A test.{' '}
        <span className="text-gradient-wild">Then decide.</span>
      </p>
    </SlideShell>
  )
}

function AppendixSlide({
  section = 'TheAsk',
  intro = 'Attack these. If an input is wrong, the funnel updates. That is the point of a model.',
}: {
  section?: string
  intro?: string
}) {
  return (
    <SlideShell
      section={section}
      title={<>Assumption sheet</>}
      intro={intro}
      footnote={DISCLAIMER}
    >
      <div className="overflow-hidden rounded-2xl border border-card-border">
        <table className="w-full text-left text-sm">
          <tbody>
            {ASSUMPTIONS.map((a) => (
              <tr key={a.item} className="border-b border-card-border last:border-0">
                <td className="w-[34%] px-4 py-2.5 font-condensed text-xs uppercase tracking-wider text-muted">
                  {a.item}
                </td>
                <td className="px-4 py-2.5 text-untamed-white">{a.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SlideShell>
  )
}

export interface SlideDef {
  id: string
  section: string
  title: string
  render: () => ReactNode
}

export const SLIDES: SlideDef[] = [
  { id: 'cover', section: 'TheQuestion', title: 'Cover', render: () => <CoverSlide /> },
  { id: 'assumptions-open', section: 'TheQuestion', title: 'Assumptions', render: () => (
    <AppendixSlide
      section="TheQuestion"
      intro="Skim this once so the inputs are clear. This will make sense later — we come back to the same sheet at the end."
    />
  ) },
  { id: 'question', section: 'TheQuestion', title: 'The $7,000 Question', render: () => <QuestionSlide /> },
  { id: 'salesperson', section: 'TheUnit', title: 'What $3,500 Buys Today', render: () => <SalespersonSlide /> },
  { id: 'machine', section: 'TheMachine', title: 'What $3,500 Buys as a Machine', render: () => <MachineSlide /> },
  { id: 'head-to-head', section: 'TheUnit', title: '$3,500 vs $3,500', render: () => <HeadToHeadSlide /> },
  { id: 'funnel', section: 'TheMachine', title: 'Instrumented Funnel', render: () => <InstrumentedFunnelSlide /> },
  { id: 'scenarios', section: 'TheMachine', title: 'Three Scenarios', render: () => <ScenariosSlide /> },
  { id: 'scale', section: 'TheScale', title: 'Scale the Unit', render: () => <ScaleSlide /> },
  { id: 'velocity', section: 'TheScale', title: 'Shelves × Velocity', render: () => <VelocitySlide /> },
  { id: 'compounding', section: 'TheScale', title: 'Compounding', render: () => <CompoundingSlide /> },
  { id: 'content', section: 'TheScale', title: 'Content Game Plan', render: () => <ContentPlanSlide /> },
  { id: 'platforms', section: 'TheScale', title: 'Where It Runs', render: () => <PlatformMixSlide /> },
  { id: 'built', section: 'TheAsk', title: 'Already Built', render: () => <BuiltSlide /> },
  { id: 'throughput', section: 'TheAsk', title: 'Click Through', render: () => <ThroughputSlide /> },
  { id: 'timeline', section: 'TheAsk', title: '30 / 60 / 90', render: () => <TimelineSlide /> },
  { id: 'cmo', section: 'TheAsk', title: 'The CMO Day', render: () => <CmoDaySlide /> },
  { id: 'ask', section: 'TheAsk', title: 'The Ask', render: () => <AskSlide /> },
  { id: 'appendix', section: 'TheAsk', title: 'Assumptions', render: () => <AppendixSlide /> },
]
