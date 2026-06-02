'use client'

import { useState } from 'react'
import {
  BookOpen,
  Share2,
  Building2,
  Trophy,
  Receipt,
  Camera,
  Gift,
  LogIn,
  Link2,
  Mail,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { POINTS, REWARDS } from '@/lib/loyalty/constants'
import { WARM_INTRO_DAILY_LIMIT } from '@/lib/referral/constants'

interface Section {
  id: string
  label: string
  icon: typeof BookOpen
}

const SECTIONS: Section[] = [
  { id: 'overview', label: 'How it all connects', icon: BookOpen },
  { id: 'referrals', label: 'Become a referral agent', icon: Share2 },
  { id: 'distributor', label: 'Distributor / retail leads', icon: Building2 },
  { id: 'loyalty', label: 'Sign up for loyalty', icon: Trophy },
  { id: 'receipts', label: 'Upload a purchase (receipts)', icon: Receipt },
  { id: 'ugc', label: 'Submit UGC', icon: Camera },
  { id: 'login', label: 'Log in to the portal', icon: LogIn },
  { id: 'rewards', label: 'View & redeem rewards', icon: Gift },
  { id: 'linking', label: 'How accounts get linked', icon: Link2 },
  { id: 'admin', label: 'What you do as the owner', icon: ShieldCheck },
]

export default function HandbookPage() {
  const [active, setActive] = useState('overview')

  function scrollTo(id: string) {
    setActive(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex gap-8">
      {/* Sticky table of contents */}
      <aside className="hidden xl:block w-64 shrink-0">
        <div className="sticky top-20 space-y-1">
          <div className="text-xs uppercase tracking-wider text-[#666] px-3 mb-2">
            On this page
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  'flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  active === s.id
                    ? 'bg-[#9B30FF]/15 text-[#9B30FF]'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 max-w-3xl space-y-12 pb-24">
        <header>
          <div className="flex items-center gap-2 text-[#9B30FF] text-sm mb-2">
            <BookOpen className="w-4 h-4" />
            Owner&apos;s Handbook
          </div>
          <h1 className="font-headline text-3xl text-white mb-3">
            How the Untamed customer programs work
          </h1>
          <p className="text-[#A0A0A0] leading-relaxed">
            This is the plain-English walkthrough of everything connected to the
            member portal: how someone becomes a referral agent, signs up for
            loyalty, logs a purchase, logs in, and redeems rewards &mdash; plus
            exactly what you do on the admin side at each step. Hand this to
            anyone who needs to understand the system.
          </p>
        </header>

        <Overview />
        <Referrals />
        <Distributor />
        <Loyalty />
        <Receipts />
        <Ugc />
        <Login />
        <Rewards />
        <Linking />
        <AdminDuties />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reusable building blocks
// ---------------------------------------------------------------------------

function SectionShell({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string
  icon: typeof BookOpen
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#9B30FF]" />
        </div>
        <h2 className="font-headline text-2xl text-white">{title}</h2>
      </div>
      <div className="space-y-4 text-[#C8C8C8] leading-relaxed text-[15px]">
        {children}
      </div>
    </section>
  )
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#9B30FF] text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div className="flex-1">{item}</div>
        </li>
      ))}
    </ol>
  )
}

function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'tip'
  title: string
  children: React.ReactNode
}) {
  const styles = {
    info: 'bg-[#00BFFF]/10 border-[#00BFFF]/30 text-[#00BFFF]',
    warn: 'bg-[#FF0040]/10 border-[#FF0040]/30 text-[#FF6B8A]',
    tip: 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]',
  }[tone]
  return (
    <div className={cn('rounded-xl border p-4', styles)}>
      <div className="font-semibold text-sm mb-1">{title}</div>
      <div className="text-[#C8C8C8] text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function Path({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[#39FF14] bg-[#0A0A0A] border border-[#2A2A2A] rounded px-1.5 py-0.5 text-[13px]">
      {children}
    </code>
  )
}

function AdminBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
      <div className="flex items-center gap-2 text-[#9B30FF] text-xs font-semibold uppercase tracking-wider mb-2">
        <ShieldCheck className="w-4 h-4" />
        What you do as the owner
      </div>
      <div className="text-[#C8C8C8] text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Overview() {
  return (
    <SectionShell id="overview" icon={BookOpen} title="How it all connects">
      <p>
        Everything revolves around a single <strong>member portal</strong>{' '}
        (<Path>/portal</Path>). A person can interact with Untamed in four ways,
        and they all feed the same account:
      </p>
      <ul className="space-y-2 list-none">
        <li className="flex gap-2">
          <Share2 className="w-4 h-4 text-[#9B30FF] mt-1 shrink-0" />
          <span>
            <strong>Referral agent</strong> &mdash; they get a personal link and
            earn rewards when friends sign up or buy.
          </span>
        </li>
        <li className="flex gap-2">
          <Trophy className="w-4 h-4 text-[#9B30FF] mt-1 shrink-0" />
          <span>
            <strong>Loyalty member</strong> &mdash; they earn points for
            purchases and content, then redeem for swag.
          </span>
        </li>
        <li className="flex gap-2">
          <Building2 className="w-4 h-4 text-[#9B30FF] mt-1 shrink-0" />
          <span>
            <strong>Distributor / retail lead</strong> &mdash; a business that
            wants to carry Untamed.
          </span>
        </li>
        <li className="flex gap-2">
          <Camera className="w-4 h-4 text-[#9B30FF] mt-1 shrink-0" />
          <span>
            <strong>Content creator (UGC)</strong> &mdash; they upload photos
            and videos for bonus points.
          </span>
        </li>
      </ul>
      <p>
        The key idea: <strong>email is the glue.</strong> Whether someone buys a
        drink, gets credited from a referral link, or logs into the portal, the
        system matches them by email and links all their activity to one login.
        The &ldquo;How accounts get linked&rdquo; section at the bottom explains
        the one gotcha to watch for.
      </p>
      <Callout tone="tip" title="The 30-second mental model">
        Anonymous actions on the marketing site (buying a drink, clicking a{' '}
        <Path>?ref=</Path> link) are captured by email. The portal (
        <Path>/portal</Path>) is where members log in to manage everything. The
        system automatically connects the two by matching email addresses.
      </Callout>
    </SectionShell>
  )
}

function Referrals() {
  return (
    <SectionShell
      id="referrals"
      icon={Share2}
      title="Become a referral agent"
    >
      <p>
        A referral agent is anyone who shares their personal referral link.
        Here&apos;s how a friend of yours becomes one:
      </p>
      <Steps
        items={[
          <>
            Every loyalty member <strong>already has a referral link</strong>
            &mdash; a personal code (e.g. <Path>jordanbuckingham</Path>) is
            created automatically at signup. The public <Path>/referral</Path>{' '}
            page explains the program and lets someone{' '}
            <strong>sign up right there</strong> (the same inline name/email
            &rarr; link-or-code flow as the rewards page), or sign in if they
            already have an account.
          </>,
          <>
            On <Path>/portal/referrals</Path> they see their shareable link
            (e.g. <Path>untamedbeverages.com/?ref=their-code</Path>), can
            customize their code, and watch a live dashboard of clicks, signups,
            and conversions.
          </>,
          <>
            They share it three ways: a one-tap <strong>quick share</strong>, a{' '}
            <strong>custom message</strong>, or a <strong>warm intro</strong>{' '}
            email sent straight from the platform (limited to{' '}
            {WARM_INTRO_DAILY_LIMIT} per day to protect sending reputation).
          </>,
          <>
            When someone clicks their link, a 30-day cookie is dropped. If that
            visitor signs up for loyalty or submits a retail lead within 30
            days, the referrer gets credit automatically &mdash; no login
            required for the person being referred.
          </>,
          <>
            As they hit milestones, they unlock <strong>reward tiers</strong>{' '}
            (see below) &mdash; on top of any normal loyalty points.
          </>,
        ]}
      />
      <Callout tone="info" title="Referrals live in the portal">
        Managing a referral link &mdash; your code, share tools, and dashboard
        &mdash; happens only at <Path>/portal/referrals</Path> behind login. The
        public <Path>/referral</Path> page is a marketing explainer with an
        inline signup that creates the portal account and drops the new member
        straight onto their referral dashboard. The <Path>?ref=</Path> tracking
        that credits a referrer still works for anonymous visitors.
      </Callout>

      <h3 className="text-white font-semibold text-lg pt-2">
        Referral reward tiers
      </h3>
      <p>These are the milestone rewards a referral agent unlocks automatically:</p>
      <div className="rounded-xl border border-[#2A2A2A] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1A1A1A] text-[#A0A0A0]">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Tier</th>
              <th className="text-left px-4 py-2 font-medium">Requirement</th>
              <th className="text-left px-4 py-2 font-medium">Reward</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2A2A]">
            {[
              ['Pack Runner', '3 friend signups', '100 bonus points'],
              [
                'Territory Scout',
                '5 signups + 1 distributor lead',
                '500 bonus points',
              ],
              [
                'Alpha Predator',
                '10 signups + 3 distributor leads',
                'Untamed Merch Bundle',
              ],
              [
                'Pride Leader',
                '25 signups + 5 distributor leads',
                'VIP founding member status',
              ],
            ].map(([tier, req, reward]) => (
              <tr key={tier} className="text-[#C8C8C8]">
                <td className="px-4 py-2 font-medium text-white">{tier}</td>
                <td className="px-4 py-2">{req}</td>
                <td className="px-4 py-2 text-[#39FF14]">{reward}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#666]">
        Tiers are configured in the database and shown read-only on{' '}
        <Path>/admin/referrals</Path> under the &ldquo;Tiers &amp; Rewards&rdquo;
        tab.
      </p>

      <AdminBox>
        <p>
          Go to <Path>/admin/referrals</Path> to see every participant, their
          click/signup/conversion counts, the live activity event feed, and
          which tier rewards have been earned. Nothing is required from you for a
          referral to work &mdash; crediting is automatic. You step in only to
          fulfill an earned reward (e.g. ship the merch bundle).
        </p>
      </AdminBox>
    </SectionShell>
  )
}

function Distributor() {
  return (
    <SectionShell
      id="distributor"
      icon={Building2}
      title="Distributor / retail leads"
    >
      <p>
        Businesses that want to stock Untamed submit a lead at{' '}
        <Path>/retail</Path>. This is also how a referral agent earns
        &ldquo;distributor lead&rdquo; credit toward their higher tiers.
      </p>
      <Steps
        items={[
          <>
            The business fills out the retail form (business type, volume
            interest, contact info).
          </>,
          <>
            If they arrived via someone&apos;s referral link, that referrer is
            automatically credited with a distributor lead.
          </>,
          <>
            The lead lands in your pipeline with a status of{' '}
            <strong>New</strong>, ready for follow-up.
          </>,
        ]}
      />
      <AdminBox>
        <p>
          Manage these on <Path>/admin/retail</Path>. Move each lead through the
          pipeline: New &rarr; Contacted &rarr; Qualified &rarr; Negotiating
          &rarr; Converted (or Declined).
        </p>
      </AdminBox>
    </SectionShell>
  )
}

function Loyalty() {
  return (
    <SectionShell id="loyalty" icon={Trophy} title="Sign up for loyalty">
      <p>
        There is <strong>one signup path</strong>, and it always creates a real
        portal account &mdash; no password required. Signing up for loyalty{' '}
        <em>is</em> getting a portal. Every member can log in, and every member
        automatically gets a referral link.
      </p>
      <Steps
        items={[
          <>
            A customer enters their <strong>name and email</strong> on the
            rewards page (<Path>/rewards</Path> or a drink&apos;s rewards page,
            reached by the can QR code) &mdash; or on the public{' '}
            <Path>/referral</Path> page, which now has the same inline signup.
          </>,
          <>
            They get a <strong>branded Untamed email</strong> with a one-tap{' '}
            <strong>sign-in link</strong> (and a <strong>6-digit code</strong> as
            a backup). Clicking the link &mdash; or entering the code on the
            page &mdash; confirms them. <strong>No password required.</strong>
          </>,
          <>
            That instantly creates their <strong>portal account</strong> +{' '}
            <strong>loyalty member</strong> with a{' '}
            <strong>{POINTS.SIGNUP_BONUS}-point signup bonus</strong>, a referral
            link, and (if they arrived via a <Path>?ref=</Path> link) credit to
            their referrer.
          </>,
          <>
            The first time in, they&apos;re offered the option to{' '}
            <strong>set a password</strong> (<Path>/portal/setup-password</Path>)
            so future logins are one step &mdash; they can skip it and keep using
            the email link. Then they land in the portal.
          </>,
        ]}
      />
      <Callout tone="tip" title="One kind of member">
        Because signup always provisions a portal account, there are no
        &ldquo;email-only&rdquo; members anymore. Returning customers use{' '}
        <Path>/portal/login</Path> (password, magic link, or code); anyone who
        joined under an old email gets linked automatically the first time they
        sign in with that email.
      </Callout>
      <h3 className="text-white font-semibold text-lg pt-2">
        How points are earned
      </h3>
      <div className="rounded-xl border border-[#2A2A2A] overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[#2A2A2A]">
            {[
              ['Signup bonus', `${POINTS.SIGNUP_BONUS} pts`],
              ['Approved receipt', `${POINTS.PER_RECEIPT} pts (per item, you set the final amount)`],
              ['Approved UGC submission', `${POINTS.PER_UGC_APPROVED} pts`],
              ['Featured UGC', `${POINTS.PER_UGC_FEATURED} pts`],
            ].map(([label, val]) => (
              <tr key={label} className="text-[#C8C8C8]">
                <td className="px-4 py-2.5 font-medium text-white">{label}</td>
                <td className="px-4 py-2.5 text-[#39FF14]">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminBox>
        <p>
          <Path>/admin/loyalty</Path> is your command center: see all members
          and balances, approve receipts (with an editable point amount), manage
          redemptions, and use <strong>Adjust</strong> on any member to add or
          remove points manually (with a required note for the audit trail).
        </p>
      </AdminBox>
    </SectionShell>
  )
}

function Receipts() {
  return (
    <SectionShell id="receipts" icon={Receipt} title="Upload a purchase (receipts)">
      <p>
        Customers prove a purchase by uploading receipt photos. One submission
        can include multiple receipts (e.g. they bought from three different
        stores) and a declaration of what they bought.
      </p>
      <Steps
        items={[
          <>
            They go to <Path>/portal/receipts/new</Path> and add one or more
            receipt photos to the upload queue.
          </>,
          <>
            They declare the items claimed (e.g. &ldquo;8 packs of
            Cheetah&rdquo;) using a simple stepper. The page shows an estimated
            point total.
          </>,
          <>
            They submit. The receipt enters a <strong>pending</strong> state and
            shows up in your approval queue.
          </>,
          <>
            Once you approve, points post to their balance and appear in their
            activity timeline. They can delete a receipt only while it&apos;s
            still pending.
          </>,
        ]}
      />
      <AdminBox>
        <p>
          On <Path>/admin/loyalty</Path> &rarr; Receipts tab, each pending
          receipt shows the images and claimed items. The point field is
          pre-filled with a suggestion based on claimed quantity &mdash; edit it
          to whatever is fair, then Approve. Approval awards the points and
          records the transaction.
        </p>
      </AdminBox>
    </SectionShell>
  )
}

function Ugc() {
  return (
    <SectionShell id="ugc" icon={Camera} title="Submit UGC (photos & videos)">
      <p>
        User-generated content is the other way to earn. Members upload media
        of themselves with Untamed for points and potential features.
      </p>
      <Steps
        items={[
          <>They upload photos/videos at <Path>/portal/ugc</Path>.</>,
          <>
            The submission is <strong>pending</strong> until you review it.
          </>,
          <>
            Approving it awards {POINTS.PER_UGC_APPROVED} points; marking it{' '}
            <strong>featured</strong> awards {POINTS.PER_UGC_FEATURED}.
          </>,
        ]}
      />
      <AdminBox>
        <p>
          Review submissions on <Path>/admin/ugc</Path>. Approve, feature, or
          reject. Approved content can be reused in your marketing.
        </p>
      </AdminBox>
    </SectionShell>
  )
}

function Login() {
  return (
    <SectionShell id="login" icon={LogIn} title="Log in to the portal">
      <p>
        Returning members log in at <Path>/portal/login</Path> &mdash; the same
        account they created when they signed up. New customers don&apos;t come
        here first; they sign up on the rewards page, which creates this account
        for them.
      </p>
      <p>There are three ways to sign in, all on the same screen:</p>
      <ul className="space-y-2 list-disc pl-5">
        <li>
          <strong>Password</strong> &mdash; if they set one (offered on first
          sign-in). Fastest for return visits.
        </li>
        <li>
          <strong>Magic link</strong> &mdash; we email a one-tap sign-in link
          (the branded Untamed email).
        </li>
        <li>
          <strong>6-digit code</strong> &mdash; the same email includes a code
          they can type in if they can&apos;t click the link (e.g. a different
          device).
        </li>
      </ul>
      <Steps
        items={[
          <>
            They enter their email and pick a method (password, or
            &ldquo;email me a link&rdquo; for the magic link / code).
          </>,
          <>
            On successful login, the system <strong>links</strong> any existing
            loyalty member and distributor lead records that share their email
            (see next section).
          </>,
          <>
            If they haven&apos;t set a password yet (and didn&apos;t skip it),
            they&apos;re offered the one-time{' '}
            <Path>/portal/setup-password</Path> step. Otherwise they go straight
            in.
          </>,
          <>
            They land in the portal with the sidebar: Dashboard, My UGC,
            Receipts, Rewards, Referrals, Account.
          </>,
        ]}
      />
      <Callout tone="tip" title="Use one email everywhere">
        Tell members to use the <strong>same email</strong> for their portal
        login that they used at <Path>/referral</Path> or when they bought.
        That&apos;s what guarantees all their history shows up.
      </Callout>
    </SectionShell>
  )
}

function Rewards() {
  return (
    <SectionShell id="rewards" icon={Gift} title="View & redeem rewards">
      <p>
        Logged-in members see their balance and the reward catalog at{' '}
        <Path>/portal/rewards</Path>.
      </p>
      <Steps
        items={[
          <>
            The page shows their current points, lifetime earned/redeemed, and
            the catalog. Rewards they can&apos;t yet afford show as locked.
          </>,
          <>
            They tap <strong>Redeem</strong>, confirm in a modal, and the points
            are deducted immediately. A <strong>pending</strong> redemption is
            created.
          </>,
          <>
            Your team gets an email notification and you fulfill it (or cancel
            and auto-refund the points).
          </>,
        ]}
      />
      <h3 className="text-white font-semibold text-lg pt-2">Current catalog</h3>
      <div className="rounded-xl border border-[#2A2A2A] overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[#2A2A2A]">
            {REWARDS.map((r) => (
              <tr key={r.id} className="text-[#C8C8C8]">
                <td className="px-4 py-2.5 font-medium text-white">{r.name}</td>
                <td className="px-4 py-2.5 text-[#A0A0A0]">{r.description}</td>
                <td className="px-4 py-2.5 text-[#9B30FF] whitespace-nowrap">
                  {r.pointsCost.toLocaleString()} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#666]">
        Edit the catalog in <Path>src/lib/loyalty/constants.ts</Path>. Past
        redemptions keep the name and cost they were redeemed at, so changing the
        catalog never rewrites history.
      </p>
      <AdminBox>
        <p>
          On <Path>/admin/loyalty</Path> &rarr; Redemptions tab, mark each
          redemption <strong>Fulfilled</strong> once shipped, or{' '}
          <strong>Cancel</strong> it to refund the points automatically.
        </p>
      </AdminBox>
    </SectionShell>
  )
}

function Linking() {
  return (
    <SectionShell id="linking" icon={Link2} title="How accounts get linked">
      <p>
        This is the one piece worth understanding deeply, because it&apos;s the
        source of most &ldquo;why don&apos;t I see my points?&rdquo; confusion.
      </p>
      <p>There are two states a person can be in:</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
          <div className="text-white font-semibold mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#00BFFF]" />
            Email-only
          </div>
          <p className="text-sm text-[#A0A0A0]">
            Bought a drink or clicked a <Path>?ref=</Path> link, but
            hasn&apos;t signed up yet. Captured purely by email &mdash; no portal
            account.
          </p>
        </div>
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
          <div className="text-white font-semibold mb-1 flex items-center gap-2">
            <LogIn className="w-4 h-4 text-[#39FF14]" />
            Portal account
          </div>
          <p className="text-sm text-[#A0A0A0]">
            Signed in at <Path>/portal/login</Path>. A real authenticated user
            with a stable ID.
          </p>
        </div>
      </div>
      <p>
        The system connects the two by matching email. Linking runs
        automatically at three moments:
      </p>
      <ul className="space-y-2 list-disc pl-5">
        <li>Every time a portal page loads (it back-fills any missing link).</li>
        <li>Right after a magic-link login (in the auth callback).</li>
        <li>Right after a password or one-time-code login.</li>
      </ul>
      <Callout tone="warn" title="The one gotcha">
        If a person creates a portal account with one email but joined referrals
        or bought with a <strong>different</strong> email, the two will not
        link. The fix is simple: have them sign in with the same email they used
        elsewhere, or re-join at <Path>/referral</Path> using their portal email.
      </Callout>
    </SectionShell>
  )
}

function AdminDuties() {
  const rows: { page: string; what: string }[] = [
    {
      page: '/admin/loyalty',
      what: 'Approve receipts, manage redemptions, adjust member points, view balances.',
    },
    {
      page: '/admin/referrals',
      what: 'See participants, clicks, signups, conversions, and earned tier rewards.',
    },
    {
      page: '/admin/ugc',
      what: 'Review, approve, feature, or reject user content.',
    },
    {
      page: '/admin/retail',
      what: 'Work distributor / retail leads through the pipeline.',
    },
    {
      page: '/admin/crm',
      what: 'Reach members and leads with email blasts.',
    },
  ]
  return (
    <SectionShell id="admin" icon={ShieldCheck} title="What you do as the owner">
      <p>
        Most of the system runs itself &mdash; signups, point crediting, and
        referral attribution are all automatic. Your job is to{' '}
        <strong>review and fulfill</strong>. Here&apos;s the quick map of where
        each task lives:
      </p>
      <div className="rounded-xl border border-[#2A2A2A] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1A1A1A] text-[#A0A0A0]">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Page</th>
              <th className="text-left px-4 py-2 font-medium">What you do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2A2A]">
            {rows.map((r) => (
              <tr key={r.page} className="text-[#C8C8C8]">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Path>{r.page}</Path>
                </td>
                <td className="px-4 py-2.5">{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Callout tone="info" title="Daily rhythm">
        Check <Path>/admin/loyalty</Path> for pending receipts and redemptions,
        and <Path>/admin/ugc</Path> for new content. Everything else is
        reference and reporting.
      </Callout>
      <div className="flex items-center gap-2 text-[#666] text-sm pt-2">
        <ChevronRight className="w-4 h-4" />
        That&apos;s the whole system. Anyone who reads this page top to bottom
        can run it.
      </div>
    </SectionShell>
  )
}
