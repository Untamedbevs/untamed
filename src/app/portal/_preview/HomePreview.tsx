import Image from 'next/image'
import Link from 'next/link'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildShareLinks } from '@/lib/referral/helpers'
import {
  ArrowRight,
  Camera,
  CheckCircle,
  Clock,
  Share2,
  Sparkles,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { CopyLinkButton } from '../CopyLinkButton'
import { ProgramStatusNotice, isProgramActive } from '@/components/rewards/ProgramStatusNotice'
import { Onboarding } from '@/components/rewards/Onboarding'
import { PackPass } from '@/components/rewards/PackPass'
import { MilestoneTrail } from '@/components/rewards/MilestoneTrail'
import { ActivityFeed } from '@/components/referral-hq/ActivityFeed'
import { TrophyCase } from '@/components/referral-hq/TrophyCase'
import { enrollmentStatus } from '@/lib/rewards/eligibility'
import { loadMemberHq } from '@/lib/referral-hq/progress'
import { formatPoints } from '@/lib/referral-hq/program'
import { artSrc } from '@/lib/rewards/art'
import { loadLivePromotions, loadMilestones, promotionWindow } from '@/lib/rewards/catalog'
import { loadMemberTrail } from '@/lib/rewards/member-rewards'
import { SPIRIT_ANIMALS, spiritAnimalFor } from '@/lib/rewards/spirit-animals'

export const dynamic = 'force-dynamic'

interface UgcRow {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'featured'
  caption: string | null
  created_at: string
}

export async function PortalHomePreview() {
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
  const onboarding = !!status && !status.ok && status.reason === 'not_enrolled'

  const [{ data: ugcRows }, hq, trail, hunts, milestones] = await Promise.all([
    admin
      .from('ugc_submissions')
      .select('id, status, caption, created_at')
      .eq('auth_user_id', member.authUserId)
      .order('created_at', { ascending: false })
      .limit(4),
    loyalty && programActive ? loadMemberHq(admin, loyalty, member.referralParticipant?.id ?? null) : null,
    loyalty && programActive ? loadMemberTrail(admin, loyalty.id) : null,
    programActive ? loadLivePromotions(admin) : [],
    onboarding ? loadMilestones(admin) : [],
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
  // Onboarding teases the first stop, a middle reward and the summit.
  const teaser = milestones.length
    ? [milestones[0], milestones[Math.floor(milestones.length / 2)], milestones[milestones.length - 1]]
    : []

  return (
    <div className="space-y-6">
      {!trail && !onboarding && (
        <div>
          <h1 className="font-headline text-3xl text-white mb-1">
            {loyalty?.first_name ? `Welcome back, ${loyalty.first_name}` : 'Welcome to the pack'}
          </h1>
          <p className="text-[#A0A0A0]">You&apos;re one of the first in. Here&apos;s how to leave your mark.</p>
        </div>
      )}
      {isDistributor && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FF8C2A]/15 text-[#FF8C2A] border border-[#FF8C2A]/30">
          <Share2 className="w-3 h-3" />
          Distributor
        </span>
      )}

      {loyalty && onboarding && (
        <Onboarding
          firstName={loyalty.first_name}
          defaultState={loyalty.residence_state}
          spirits={SPIRIT_ANIMALS}
          preview={teaser}
          readOnly={!!member.viewAs}
        />
      )}
      {loyalty && !programActive && !onboarding && <ProgramStatusNotice member={loyalty} />}

      {loyalty && trail && (
        <>
          <PackPass
            firstName={loyalty.first_name}
            memberSince={loyalty.created_at}
            points={trail.points}
            spirit={spirit}
            nextMilestone={trail.next}
            previousThreshold={trail.previousThreshold}
            claimable={trail.claimable}
          />
          <MilestoneTrail
            points={trail.points}
            stops={trail.stops}
            accent={spirit?.color}
            avatar={spirit?.art}
            canClaim={!member.viewAs}
            blockedMessage={member.viewAs ? 'View As is read-only, so claiming is turned off.' : undefined}
          />
          {openHunts.length > 0 && (
            <section className="rounded-[28px] border border-[#2A2A2A] bg-[#111] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-headline text-2xl uppercase tracking-wide text-white">Live Hunts</h2>
                <Link href="/portal/hunts" className="inline-flex items-center gap-1 text-sm text-[#E87511] hover:text-white">
                  All Hunts <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {openHunts.map((h) => (
                  <Link
                    key={h.id}
                    href="/portal/hunts"
                    className="group flex items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-black/30 p-3 transition-colors hover:border-[#E87511]/50"
                  >
                    <Image src={artSrc(h.icon, 'bullseye')} alt="" width={52} height={52} className="shrink-0 transition-transform group-hover:rotate-6" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{h.title}</div>
                      <div className="text-xs font-bold text-[#FFD700]">+{formatPoints(h.points)} pts</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

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

      {/* The two community actions, front and center */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Share a moment */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <h3 className="font-headline text-xl text-white">Share a moment</h3>
          </div>
          <p className="text-sm text-[#A0A0A0] mb-4">
            Post a photo or video of your Untamed moment. The best ones get
            featured on the site for the whole pack to see.
          </p>

          {submissions.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {submissions.map((s) => (
                <SubmissionRow key={s.id} submission={s} />
              ))}
              <Link
                href="/portal/ugc"
                className="inline-flex items-center gap-1 text-xs text-[#9B30FF] hover:text-white transition-colors pt-1"
              >
                All my submissions
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          <Link
            href="/portal/ugc/new"
            className="mt-auto inline-flex items-center justify-center gap-2 bg-[#9B30FF] text-white font-semibold rounded-full px-5 py-2.5 hover:bg-[#7E22CE] transition-colors text-sm"
          >
            <Camera className="w-4 h-4" />
            Share a moment
          </Link>
        </div>

        {/* Spread the wild */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <h3 className="font-headline text-xl text-white">Spread the wild</h3>
          </div>
          <p className="text-sm text-[#A0A0A0] mb-4">
            Your personal link for friends who are 21+. Every friend who
            joins shows up here, and you earn points when they confirm
            they&apos;re 21+.
          </p>

          {referralLink ? (
            <div className="space-y-3 mb-4">
              <CopyLinkButton link={referralLink} />
              <div className="flex items-center gap-2 text-sm text-[#A0A0A0]">
                <Users className="w-4 h-4 text-[#9B30FF]" />
                {friendsJoined === 0
                  ? 'No friends in the pack yet — be the first to bring one.'
                  : `${friendsJoined} friend${friendsJoined === 1 ? '' : 's'} in the pack so far`}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#666] mb-4">
              Join Pack Rewards above to activate your personal link.
            </p>
          )}

          <Link
            href="/portal/referrals"
            className="mt-auto inline-flex items-center justify-center gap-2 border border-[#9B30FF]/60 text-[#9B30FF] font-semibold rounded-full px-5 py-2.5 hover:bg-[#9B30FF]/10 transition-colors text-sm"
          >
            <Share2 className="w-4 h-4" />
            Sharing tools
          </Link>
        </div>
      </div>

      {hq && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ActivityFeed entries={hq.feed} />
          </div>
          <div className="lg:col-span-5">
            <TrophyCase progress={hq.progress} earnedDates={hq.earnedDates} />
          </div>
        </div>
      )}

      {/* Points: quiet row for members who haven't enrolled (the pass shows it otherwise) */}
      {isLoyalty && !trail && !onboarding && (
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

      {/* Secondary: receipts */}
      {isLoyalty && (
        <p className="text-xs text-[#666]">
          Bought Untamed in a store?{' '}
          <Link
            href="/portal/receipts/new"
            className="text-[#A0A0A0] underline underline-offset-2 hover:text-white transition-colors"
          >
            Upload your receipt
          </Link>
        </p>
      )}
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
