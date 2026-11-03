import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ActivityFeed } from '@/components/referral-hq/ActivityFeed'
import { RankCard } from '@/components/referral-hq/RankCard'
import { RankTrail } from '@/components/referral-hq/RankTrail'
import { TerritoryMap } from '@/components/referral-hq/TerritoryMap'
import { TrophyCase } from '@/components/referral-hq/TrophyCase'
import { UnlockTrack } from '@/components/referral-hq/UnlockTrack'
import { WeeklyChart } from '@/components/referral-hq/WeeklyChart'
import { CashBackPreview } from '@/app/portal/rewards/CashBackPreview'
import { DEMO_STAGES, demoMember, type DemoStageId } from '@/lib/referral-hq/mock-data'
import { cashBackStatus } from '@/lib/rewards/state-rules'
import { stateName } from '@/lib/rewards/states'

/**
 * Staff preview of the member-facing Referral HQ, on a demo member. Sections
 * follow the portal pages each piece will appear on once the program launches.
 */
export default async function ReferralHqPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const { stage: requested } = await searchParams
  const stage: DemoStageId = DEMO_STAGES.some((s) => s.id === requested)
    ? (requested as DemoStageId)
    : 'regular'
  const member = demoMember(stage)
  const { hq } = member

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl text-white mb-1">Referral HQ preview</h1>
          <p className="max-w-3xl text-sm text-[#A0A0A0]">
            What members will see in the portal once Untamed Pack Rewards launches. Ranks and badges
            count engagement only (joining, friends who confirm they&apos;re 21+, approved posts),
            never purchases. The member and every number here are made up.
          </p>
        </div>
        <nav aria-label="Demo member" className="flex flex-wrap gap-2">
          {DEMO_STAGES.map((s) => (
            <Link
              key={s.id}
              href={`/referral-hq?stage=${s.id}`}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                s.id === stage
                  ? 'border-[#9B30FF]/40 bg-[#9B30FF]/15 text-[#C89BFF]'
                  : 'border-[#2A2A2A] text-[#A0A0A0] hover:text-white'
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      <PreviewSection title="Portal home" path="/portal">
        {member.enrolled ? (
          <>
            <RankCard
              points={hq.engagementPoints}
              balance={member.balance}
              friendsJoined={hq.friendsJoined}
              postsApproved={hq.progress.postsApproved}
              postsFeatured={hq.progress.postsFeatured}
              rewardValueThisYearCents={hq.rewardValueThisYearCents}
            />
            <RankTrail points={hq.engagementPoints} earnedDates={hq.earnedDates} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <TrophyCase progress={hq.progress} earnedDates={hq.earnedDates} />
              </div>
              <div className="lg:col-span-5">
                <UnlockTrack balance={member.balance} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <ActivityFeed entries={hq.feed} />
              </div>
              <div className="lg:col-span-5">
                <TerritoryMap friendsByState={hq.friendsByState} homeState={member.homeState} />
              </div>
            </div>
          </>
        ) : (
          <RankTrail points={0} locked />
        )}
      </PreviewSection>

      <PreviewSection title="Referrals" path="/portal/referrals">
        {member.enrolled ? (
          <WeeklyChart weeks={hq.weekly} thisYear={member.friendsThisYear} />
        ) : (
          <TerritoryMap friendsByState={{}} homeState={null} locked />
        )}
      </PreviewSection>

      {member.enrolled && (
        <PreviewSection title="Rewards" path="/portal/rewards">
          <CashBackPreview
            status={cashBackStatus(member.homeState)}
            stateName={stateName(member.homeState)}
          />
        </PreviewSection>
      )}
    </div>
  )
}

function PreviewSection({
  title,
  path,
  children,
}: {
  title: string
  path: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-baseline gap-3 border-b border-[#2A2A2A] pb-2">
        <h2 className="font-headline text-xl uppercase tracking-wider text-white">{title}</h2>
        <span className="font-mono text-xs text-[#666]">{path}</span>
      </div>
      {children}
    </section>
  )
}
