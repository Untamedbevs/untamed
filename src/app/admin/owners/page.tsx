'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Link2,
  Map,
  Megaphone,
  MessageSquare,
  Presentation,
  Radio,
  Share2,
  Store,
  Target,
  Timer,
  Trophy,
  Wand2,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const FUNNEL: { step: string; detail: string; href: string; label: string }[] = [
  {
    step: '1. Make the ad',
    detail: 'Ideas, studio, and campaigns feed Meta and Google without an agency.',
    href: '/admin/studio',
    label: 'Studio',
  },
  {
    step: '2. Send a tracked link',
    detail: 'Every paid click carries UTMs so we know which ad created the lead.',
    href: '/admin/retail/utm-builder',
    label: 'UTM Builder',
  },
  {
    step: '3. Land on a retail page',
    detail: 'Campaign pages for bars, liquor, and distributors. One form. 48-hour promise.',
    href: '/lp/retail/bars',
    label: 'Bar landing page',
  },
  {
    step: '4. Joe works the inbound',
    detail: 'Kanban, SLA clock, attribution card, call/email log, next action.',
    href: '/admin/retail',
    label: 'Workbench',
  },
  {
    step: '5. Watch spend become doors',
    detail: 'Impressions, clicks, leads, contact rate, qualified, converted. Cost per door.',
    href: '/admin/retail/performance',
    label: 'Performance',
  },
]

const AREAS: {
  href: string
  title: string
  body: string
  icon: LucideIcon
  accent: string
}[] = [
  {
    href: '/briefing',
    title: 'Owner briefing',
    body: 'The $3,500 comparison versus the sales team. Present this in the room. Print to PDF.',
    icon: Presentation,
    accent: '#FFD700',
  },
  {
    href: '/admin/retail',
    title: 'Retail workbench',
    body: 'Where Joe lives. New leads, 48-hour SLA, status, notes, and which ad created each account.',
    icon: Building2,
    accent: '#FF8C2A',
  },
  {
    href: '/admin/retail/performance',
    title: 'Performance',
    body: 'The scoreboard. Spend through doors. Log ad spend here until Google and Meta sync automatically.',
    icon: BarChart3,
    accent: '#FFD700',
  },
  {
    href: '/admin/retail/utm-builder',
    title: 'UTM builder',
    body: 'Build the exact link you paste into an ad. Source, campaign, and landing page stay attached to the lead.',
    icon: Link2,
    accent: '#9B30FF',
  },
  {
    href: '/admin/campaigns',
    title: 'Campaigns',
    body: 'Plan and schedule the creative that fills the top of the funnel.',
    icon: Megaphone,
    accent: '#6B8E23',
  },
  {
    href: '/admin/studio',
    title: 'Studio',
    body: 'Generate and refine assets. This is how we feed paid media without a retainer.',
    icon: Wand2,
    accent: '#9B30FF',
  },
  {
    href: '/admin/crm/blast',
    title: 'Email blast',
    body: 'Reach retailer leads by status or type. Follow-up sequences live here.',
    icon: MessageSquare,
    accent: '#3b82f6',
  },
  {
    href: '/admin/referrals',
    title: 'Referrals',
    body: 'Every converted retailer can send the next one. Credits already fire on distributor leads.',
    icon: Share2,
    accent: '#FF8C2A',
  },
  {
    href: '/admin/loyalty',
    title: 'Loyalty',
    body: 'Consumer side of the same attribution stack. Receipts, members, UTM on shoppers.',
    icon: Trophy,
    accent: '#FFD700',
  },
  {
    href: '/admin/handbook',
    title: 'Program handbook',
    body: 'How loyalty, referrals, receipts, and UGC work — the other half of Untamed.',
    icon: Map,
    accent: '#8E8E8E',
  },
]

const PUBLIC_PAGES: { href: string; title: string; body: string }[] = [
  { href: '/retail', title: '/retail', body: 'Brand wholesale page. Organic and referral traffic.' },
  { href: '/distribute', title: '/distribute', body: 'Referral-tracked B2B variant of the same pitch.' },
  { href: '/lp/retail/bars', title: '/lp/retail/bars', body: 'Paid landing page for bar and restaurant buyers.' },
  { href: '/lp/retail/liquor', title: '/lp/retail/liquor', body: 'Paid landing page for liquor stores.' },
  { href: '/lp/retail/distributors', title: '/lp/retail/distributors', body: 'Paid landing page for distributors.' },
  { href: '/briefing', title: '/briefing', body: 'Owner briefing. Not public. Do not index.' },
]

export default function OwnerGuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-20">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm text-[#FFD700]">
          <Map className="h-4 w-4" />
          Owner Guide
        </div>
        <h1 className="font-headline text-3xl text-white md:text-4xl">
          How the retail lead engine works
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#A0A0A0]">
          Ads create inbound demand. Landing pages capture the buyer. Joe works
          the lead in 48 hours. You see which spend became which door. This page
          is the map — every box links to the place you actually do the work.
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-5 w-5 text-[#9B30FF]" />
          <h2 className="font-headline text-2xl text-white">The path</h2>
        </div>
        <ol className="space-y-3">
          {FUNNEL.map((s, i) => (
            <li
              key={s.step}
              className="flex flex-col gap-3 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9B30FF] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-white">{s.step.replace(/^\d+\.\s/, '')}</p>
                  <p className="mt-0.5 text-sm text-[#A0A0A0]">{s.detail}</p>
                </div>
              </div>
              <Link
                href={s.href}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-sm text-white hover:bg-[#1A1A1A] sm:self-center"
              >
                {s.label}
                <ArrowRight className="h-3.5 w-3.5 text-[#FFD700]" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-[#FF8C2A]" />
          <h2 className="font-headline text-2xl text-white">Admin areas</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {AREAS.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5 transition-colors hover:border-[#444]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${a.accent}1A` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: a.accent }} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#666] transition-colors group-hover:text-white" />
                </div>
                <h3 className="font-condensed text-lg font-bold uppercase text-white">{a.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#A0A0A0]">{a.body}</p>
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-[#6B8E23]" />
          <h2 className="font-headline text-2xl text-white">Public and campaign pages</h2>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#2A2A2A]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1A1A1A] text-[#A0A0A0]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Page</th>
                <th className="px-4 py-2.5 font-medium">What it is</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {PUBLIC_PAGES.map((p) => (
                <tr key={p.href}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={p.href} className="font-mono text-[#39FF14] hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[#C8C8C8]">{p.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
          <div className="mb-2 flex items-center gap-2 text-[#FFD700]">
            <Timer className="h-4 w-4" />
            <h3 className="font-condensed text-sm font-bold uppercase tracking-wider">Joe&apos;s job</h3>
          </div>
          <p className="text-sm leading-relaxed text-[#C8C8C8]">
            Work inbound in the{' '}
            <Link href="/admin/retail" className="text-white underline underline-offset-2">
              workbench
            </Link>
            . Hit the 48-hour clock. Log the call or email. Move status. Converted
            is the door. The machine does not replace him — it feeds him named
            buyers who asked to talk.
          </p>
        </div>
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
          <div className="mb-2 flex items-center gap-2 text-[#9B30FF]">
            <Radio className="h-4 w-4" />
            <h3 className="font-condensed text-sm font-bold uppercase tracking-wider">Your job</h3>
          </div>
          <p className="text-sm leading-relaxed text-[#C8C8C8]">
            Watch{' '}
            <Link href="/admin/retail/performance" className="text-white underline underline-offset-2">
              performance
            </Link>
            . If a dollar cannot be followed from impression to door, do not spend
            it twice. The{' '}
            <Link href="/briefing" className="text-white underline underline-offset-2">
              briefing
            </Link>{' '}
            is the argument for reallocating the $7,000 sales team. 90 days, then
            kill or scale.
          </p>
        </div>
      </section>

      <p className="text-sm text-[#666]">
        Consumer programs (loyalty, receipts, UGC) are in the{' '}
        <Link href="/admin/handbook" className="text-[#A0A0A0] underline underline-offset-2 hover:text-white">
          handbook
        </Link>
        . This page is the retail engine only.
      </p>
    </div>
  )
}
