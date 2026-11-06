import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildShareLinks } from '@/lib/referral/helpers'
import {
  ArrowRight,
  Camera,
  CheckCircle,
  Clock,
  Package,
  Share2,
  Sparkles,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { CopyLinkButton } from '../CopyLinkButton'
import { ProgramStatusNotice, isProgramActive } from '@/components/rewards/ProgramStatusNotice'
import { MilestoneTrail } from '@/components/rewards/MilestoneTrail'
import { DashboardIntro, DenHero } from '@/components/rewards/Den'
import { OrderStrip } from '@/components/rewards/OrderGallery'
import { ActivityFeed } from '@/components/referral-hq/ActivityFeed'
import { TrophyCase } from '@/components/referral-hq/TrophyCase'
import { enrollmentStatus } from '@/lib/rewards/eligibility'
import { loadMemberHq } from '@/lib/referral-hq/progress'
import { formatPoints, rankArt, rankFor } from '@/lib/referral-hq/program'
import { artSrc } from '@/lib/rewards/art'
import { loadLivePromotions, promotionWindow } from '@/lib/rewards/catalog'
import { loadMemberTrail } from '@/lib/rewards/member-rewards'
import { loadMemberOrders } from '@/lib/rewards/orders'
import { spiritAnimalFor } from '@/lib/rewards/spirit-animals'
import { WELCOMED_COOKIE } from '@/lib/rewards/welcome'
import '@/components/rewards/portal.css'

export const dynamic = 'force-dynamic'

interface UgcRow {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'featured'
  caption: string | null
  created_at: string
}

/** Tiles under the hero: where to go next, each with its own art and colors. */
const QUICK_TILES = [
  { href: '/portal/hunts', title: 'Hunts', body: 'Missions with big point drops', art: '/images/referral-hq/hunts/bullseye.webp', from: '#E87511', to: '#3A1200' },
  { href: '/portal/referrals', title: 'Grow your pack', body: 'Friends 21+ who join with your link', art: '/images/referral-hq/trophies/pack-builder.webp', from: '#9B30FF', to: '#1E0838' },
  { href: '/portal/ugc/new', title: 'Share a moment', body: 'Get featured on the site', art: '/images/referral-hq/hunts/snapshot.webp', from: '#00B3A4', to: '#04211F' },
  { href: '/shop', title: 'Restock', body: 'Four flavors, delivered', art: '/images/referral-hq/rewards/four-pack.webp', from: '#D4D700', to: '#272800', external: true },
]

/**
 * The Pack Rewards home. Members who haven't enrolled go through the
 * full-screen journey first; everyone else gets the dashboard, opened by an
 * intro on their first visit of a session (or the gate, right after joining).
 */
export async function PortalHomePreview({ opened = false }: { opened?: boolean }) {
  const member = await resolveMember()

  if (!member) {
    return (
      <div className="text-[#A0A0A0]">
        Please <Link href="/portal/login" className="text-[#9B30FF] underline">sign in</Link>.
      </div>
    )
  }

  const admin = createAdminClient()
  const loyalty = member.loyaltyMember
  const programActive = !!loyalty && isProgramActive(loyalty)
  const status = loyalty ? enrollmentStatus(loyalty) : null
  if (loyalty && status && !status.ok && status.reason === 'not_enrolled') redirect('/portal/welcome')

  const [{ data: ugcRows }, hq, trail, hunts, orders] = await Promise.all([
    admin
      .from('ugc_submissions')
      .select('id, status, caption, created_at')
      .eq('auth_user_id', member.authUserId)
      .order('created_at', { ascending: false })
      .limit(4),
    loyalty && programActive ? loadMemberHq(admin, loyalty, member.referralParticipant?.id ?? null) : null,
    loyalty && programActive ? loadMemberTrail(admin, loyalty.id) : null,
    programActive ? loadLivePromotions(admin) : [],
    loyalty ? loadMemberOrders(admin, { id: loyalty.id, email: loyalty.email }) : [],
  ])

  const submissions = (ugcRows || []) as UgcRow[]

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbeverages.com'
  // The link appears after enrollment, where members agree to share only
  // with adults 21+ and to disclose that they earn rewards.
  const referralLink = member.referralParticipant && programActive
    ? buildShareLinks(siteUrl, member.referralParticipant.referral_code)
        .consumerLink
    : null
  const friendsJoined = member.referralParticipant?.consumer_signups || 0

  const isLoyalty = !!loyalty
  const isDistributor = member.distributorLeads.length > 0
  const spirit = spiritAnimalFor(loyalty?.favorite_drink_slug)
  const openHunts = hunts.filter((h) => promotionWindow(h) === 'open').slice(0, 3)

  if (loyalty && trail) {
    const welcomed = (await cookies()).has(WELCOMED_COOKIE)
    const intro = opened ? 'opened' : welcomed ? null : 'welcome'
    const den = spirit
      ? { name: spirit.name, color: spirit.color, habitat: spirit.habitat, portrait: spirit.portrait, can: spirit.can }
      : null
    const rank = rankFor(trail.points)
    // Sections rise in once the intro has cleared.
    const introDelay = intro === 'welcome' ? 3600 : intro === 'opened' ? 1200 : 0

    return (
      <div className="pk-skin space-y-10" style={{ ['--pk-delay' as string]: `${introDelay}ms` }}>
        {intro && (
          <DashboardIntro
            variant={intro}
            firstName={loyalty.first_name}
            spirit={den}
            points={trail.points}
            nextTitle={trail.next?.title ?? null}
          />
        )}

        <DenHero
          firstName={loyalty.first_name}
          spirit={den}
          points={trail.points}
          rank={rank ? { name: rank.name, art: rankArt(rank.id), tagline: rank.tagline } : null}
          next={trail.next ? { title: trail.next.title, points: trail.next.points, icon: trail.next.icon } : null}
          previousThreshold={trail.previousThreshold}
          claimable={trail.claimable}
          memberSince={loyalty.created_at}
          delayMs={introDelay}
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {QUICK_TILES.map((t, i) => {
            const body = (
              <>
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(120% 90% at 100% 0%, ${t.from}cc, transparent 62%), linear-gradient(160deg, ${t.to}, #08080b 85%)` }}
                />
                <Image
                  src={t.art}
                  alt=""
                  width={120}
                  height={120}
                  className="absolute -right-3 -top-3 h-24 w-24 object-contain transition-transform duration-700 group-hover:-rotate-12 group-hover:scale-110 sm:h-28 sm:w-28"
                />
                <div className="relative mt-auto">
                  <div className="font-headline text-xl uppercase leading-none sm:text-2xl">{t.title}</div>
                  <div className="mt-1.5 text-xs leading-snug text-white/70">{t.body}</div>
                </div>
              </>
            )
            const cls = 'pk-enter pk-tile group relative flex h-40 flex-col overflow-hidden rounded-[24px] border border-white/10 p-4 sm:h-44 sm:p-5'
            const style = { ['--i' as string]: i + 1, boxShadow: `0 24px 50px -30px ${t.from}` }
            return t.external ? (
              <a key={t.href} href={t.href} className={cls} style={style}>
                {body}
              </a>
            ) : (
              <Link key={t.href} href={t.href} className={cls} style={style}>
                {body}
              </Link>
            )
          })}
        </div>

        <div className="pk-enter" style={{ ['--i' as string]: 5 }}>
          <MilestoneTrail
            points={trail.points}
            stops={trail.stops}
            accent={spirit?.color}
            avatar={spirit?.art}
            canClaim={!member.viewAs}
            blockedMessage={member.viewAs ? 'View As is read-only, so claiming is turned off.' : undefined}
          />
        </div>

        {openHunts.length > 0 && (
          <div className="pk-enter" style={{ ['--i' as string]: 6 }}>
            <SectionTitle kicker="Live now" title="Hunts" href="/portal/hunts" cta="All Hunts" />
            <div className="grid gap-3 sm:grid-cols-3">
              {openHunts.map((h) => (
                <Link
                  key={h.id}
                  href="/portal/hunts"
                  className="pk-tile group relative flex items-center gap-4 overflow-hidden rounded-[24px] border border-white/10 p-4"
                  style={{ background: 'radial-gradient(100% 120% at 0% 50%, #E8751166, transparent 62%), linear-gradient(160deg, #1a0d05, #08080b)' }}
                >
                  <Image
                    src={artSrc(h.icon, 'bullseye')}
                    alt=""
                    width={72}
                    height={72}
                    className="shrink-0 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{h.title}</div>
                    <div className="mt-0.5 font-headline text-xl text-[#FFD700]">+{formatPoints(h.points)} pts</div>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {orders.length > 0 ? (
          <div className="pk-enter" style={{ ['--i' as string]: 7 }}>
            <SectionTitle kicker="Your haul" title="Recently poured" href="/portal/orders" cta="All orders" />
            <OrderStrip orders={orders} />
          </div>
        ) : (
          <a href="/shop" className="pk-enter pk-glass flex items-center gap-4 p-5" style={{ ['--i' as string]: 7 }}>
            <Package className="h-8 w-8 shrink-0 text-[#FFD700]" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Your haul shows up here</div>
              <div className="text-sm text-white/60">Order online and every flavor you buy lands on this shelf.</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </a>
        )}

        <div className="pk-enter grid gap-4 lg:grid-cols-2" style={{ ['--i' as string]: 8 }}>
          <div className="pk-glass p-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5" style={{ color: 'var(--pk-accent)' }} />
              <h3 className="font-headline text-2xl uppercase">Your pack link</h3>
            </div>
            <p className="mt-2 text-sm text-white/65">
              For friends who are 21+. You earn points when they join and confirm their age.
            </p>
            {referralLink && (
              <div className="mt-4">
                <CopyLinkButton link={referralLink} />
              </div>
            )}
            <div className="mt-3 text-sm text-white/60">
              {friendsJoined === 0
                ? 'No one in your pack yet. Be the first to bring a friend.'
                : `${friendsJoined} friend${friendsJoined === 1 ? '' : 's'} in your pack`}
            </div>
          </div>
          <div className="pk-glass p-6">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5" style={{ color: 'var(--pk-accent)' }} />
              <h3 className="font-headline text-2xl uppercase">Your moments</h3>
            </div>
            {submissions.length > 0 ? (
              <div className="mt-4 space-y-1.5">
                {submissions.map((s) => (
                  <SubmissionRow key={s.id} submission={s} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/65">
                Post a photo or video with your Untamed. The best ones get featured for the whole pack.
              </p>
            )}
            <Link
              href="/portal/ugc/new"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
            >
              <Camera className="h-4 w-4" /> Share a moment
            </Link>
          </div>
        </div>

        {hq && (
          <div className="pk-enter grid grid-cols-1 gap-6 lg:grid-cols-12" style={{ ['--i' as string]: 9 }}>
            <div className="lg:col-span-7">
              <ActivityFeed entries={hq.feed} />
            </div>
            <div className="lg:col-span-5">
              <TrophyCase progress={hq.progress} earnedDates={hq.earnedDates} />
            </div>
          </div>
        )}

        <p className="text-center text-xs text-white/40">
          Bought Untamed in a store?{' '}
          <Link href="/portal/receipts/new" className="underline underline-offset-2 hover:text-white">
            Upload your receipt
          </Link>
        </p>
      </div>
    )
  }

  // Accounts that can't use the program right now (closed, on hold, or not a loyalty member).
  return (
    <div className="pk-skin space-y-6">
      <div>
        <h1 className="font-headline text-3xl text-white mb-1">
          {loyalty?.first_name ? `Welcome back, ${loyalty.first_name}` : 'Welcome to the pack'}
        </h1>
        <p className="text-[#A0A0A0]">You&apos;re one of the first in. Here&apos;s how to leave your mark.</p>
      </div>
      {isDistributor && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FF8C2A]/15 text-[#FF8C2A] border border-[#FF8C2A]/30">
          <Share2 className="w-3 h-3" />
          Distributor
        </span>
      )}
      {loyalty && !programActive && <ProgramStatusNotice member={loyalty} />}

      {!isLoyalty && (
        <div className="bg-[#141414] border border-[#9B30FF]/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Join the Pack</h3>
              <p className="text-sm text-[#A0A0A0] mb-4">
                Membership takes a moment and unlocks everything here — sharing
                moments, your personal link, and member perks.
              </p>
              <Link
                href="/rewards"
                className="inline-flex items-center gap-2 bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-4 py-2 hover:bg-[#7E22CE] transition-colors"
              >
                Join now
              </Link>
            </div>
          </div>
        </div>
      )}

      {isLoyalty && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141414] border border-[#2A2A2A] rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-[#A0A0A0]">
            <Sparkles className="w-4 h-4 text-[#9B30FF]" />
            Your points:{' '}
            <span className="text-white font-semibold">
              {(loyalty?.points_balance ?? 0).toLocaleString()}
            </span>
          </div>
          <Link
            href="/portal/rewards"
            className="inline-flex items-center gap-1 text-sm text-[#9B30FF] hover:text-white transition-colors"
          >
            See rewards
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ kicker, title, href, cta }: { kicker: string; title: string; href: string; cta: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={{ color: 'var(--pk-accent)' }}>
          {kicker}
        </div>
        <h2 className="mt-1 font-headline text-3xl uppercase leading-none sm:text-4xl">{title}</h2>
      </div>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm text-white/60 transition-colors hover:text-white">
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function SubmissionRow({ submission }: { submission: UgcRow }) {
  const STATUS: Record<
    UgcRow['status'],
    { Icon: React.ComponentType<{ className?: string }>; cls: string; label: string }
  > = {
    pending: { Icon: Clock, cls: 'text-[#FFFF00]', label: 'In review' },
    approved: { Icon: CheckCircle, cls: 'text-[#39FF14]', label: 'Approved' },
    featured: { Icon: Sparkles, cls: 'text-[#9B30FF]', label: 'Featured' },
    rejected: { Icon: XCircle, cls: 'text-red-400', label: 'Not used' },
  }
  const s = STATUS[submission.status]
  const Icon = s.Icon

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A]">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${s.cls}`} />
      <span className="text-xs text-white truncate flex-1">
        {submission.caption || 'Untitled moment'}
      </span>
      <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${s.cls}`}>
        {s.label}
      </span>
    </div>
  )
}
