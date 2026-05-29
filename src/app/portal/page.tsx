import Link from 'next/link'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  Camera,
  CheckCircle,
  Clock,
  Receipt,
  Share2,
  Trophy,
  Upload,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PortalDashboardPage() {
  const member = await resolveMember()

  if (!member) {
    return (
      <div className="text-[#A0A0A0]">
        Please <Link href="/portal/login" className="text-[#9B30FF] underline">sign in</Link>.
      </div>
    )
  }

  const admin = createAdminClient()

  const [receiptStats, ugcStats] = await Promise.all([
    member.loyaltyMember
      ? admin
          .from('loyalty_receipts')
          .select('status', { count: 'exact' })
          .eq('member_id', member.loyaltyMember.id)
      : Promise.resolve({ data: [], count: 0 }),
    admin
      .from('ugc_submissions')
      .select('status', { count: 'exact' })
      .eq('auth_user_id', member.authUserId),
  ])

  const receiptsCount = receiptStats.count || 0
  const ugcCount = ugcStats.count || 0

  const ugcStatusCounts = (ugcStats.data || []).reduce(
    (acc: Record<string, number>, row: { status: string }) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      return acc
    },
    {}
  )

  const greeting =
    member.loyaltyMember?.first_name
      ? `Welcome back, ${member.loyaltyMember.first_name}`
      : 'Welcome to your Untamed portal'

  const isLoyalty = !!member.loyaltyMember
  const isDistributor = member.distributorLeads.length > 0

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-headline text-3xl text-white mb-1">{greeting}</h1>
        <p className="text-[#A0A0A0]">
          Manage your photos, points, and rewards from one place.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {isLoyalty && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30">
              <Trophy className="w-3 h-3" />
              Loyalty Member
            </span>
          )}
          {isDistributor && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FF8C2A]/15 text-[#FF8C2A] border border-[#FF8C2A]/30">
              <Share2 className="w-3 h-3" />
              Distributor
            </span>
          )}
          {!isLoyalty && !isDistributor && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#2A2A2A] text-[#A0A0A0]">
              Welcome guest
            </span>
          )}
        </div>
      </div>

      {!isLoyalty && (
        <div className="bg-[#141414] border border-[#9B30FF]/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Join the Loyalty Program
              </h3>
              <p className="text-sm text-[#A0A0A0] mb-4">
                Earn points for receipts and approved photos &amp; videos. Redeem
                for stickers, glassware, and free cans.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Trophy}
          label="Points balance"
          value={member.loyaltyMember?.points_balance ?? 0}
          tone="purple"
        />
        <StatCard
          icon={Receipt}
          label="Receipts uploaded"
          value={receiptsCount}
          tone="green"
        />
        <StatCard
          icon={Camera}
          label="UGC submissions"
          value={ugcCount}
          tone="orange"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved UGC"
          value={
            (ugcStatusCounts.approved || 0) + (ugcStatusCounts.featured || 0)
          }
          tone="lime"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link
          href="/portal/ugc/new"
          className="group bg-[#141414] border border-[#2A2A2A] hover:border-[#9B30FF] rounded-2xl p-6 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center mb-4 group-hover:bg-[#9B30FF]/25 transition-colors">
            <Upload className="w-5 h-5 text-[#9B30FF]" />
          </div>
          <h3 className="font-semibold text-white mb-1">Submit photo or video</h3>
          <p className="text-sm text-[#A0A0A0]">
            Share an Untamed moment. Approved submissions earn 50 loyalty points.
          </p>
        </Link>

        {ugcStatusCounts.pending ? (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-[#FFFF00]/15 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5 text-[#FFFF00]" />
            </div>
            <h3 className="font-semibold text-white mb-1">
              {ugcStatusCounts.pending} submission
              {ugcStatusCounts.pending === 1 ? '' : 's'} pending review
            </h3>
            <p className="text-sm text-[#A0A0A0]">
              Our team reviews submissions within 1&ndash;2 business days. We&apos;ll email you when it&apos;s approved.
            </p>
            <Link
              href="/portal/ugc"
              className="mt-3 inline-flex text-sm text-[#9B30FF] hover:text-white"
            >
              View my submissions &rarr;
            </Link>
          </div>
        ) : (
          <Link
            href="/rewards"
            className="group bg-[#141414] border border-[#2A2A2A] hover:border-[#9B30FF] rounded-2xl p-6 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center mb-4 group-hover:bg-[#9B30FF]/25 transition-colors">
              <Trophy className="w-5 h-5 text-[#9B30FF]" />
            </div>
            <h3 className="font-semibold text-white mb-1">Browse rewards</h3>
            <p className="text-sm text-[#A0A0A0]">
              Stickers, glassware, swag, and free 4-packs. Redeem your points.
            </p>
          </Link>
        )}
      </div>

      {member.referralParticipant && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#9B30FF]" />
            Your referral code
          </h3>
          <div className="flex items-center gap-3">
            <code className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2 text-[#9B30FF] font-mono">
              {member.referralParticipant.referral_code}
            </code>
            <span className="text-sm text-[#A0A0A0]">
              {member.referralParticipant.consumer_signups} sign-ups
              {' · '}
              {member.referralParticipant.distributor_leads} leads
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tone: 'purple' | 'green' | 'orange' | 'lime'
}) {
  const TONE_BG: Record<typeof tone, string> = {
    purple: 'bg-[#9B30FF]/15',
    green: 'bg-[#6B8E23]/15',
    orange: 'bg-[#FF8C2A]/15',
    lime: 'bg-[#39FF14]/15',
  }
  const TONE_FG: Record<typeof tone, string> = {
    purple: 'text-[#9B30FF]',
    green: 'text-[#6B8E23]',
    orange: 'text-[#FF8C2A]',
    lime: 'text-[#39FF14]',
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
      <div
        className={`w-9 h-9 rounded-xl ${TONE_BG[tone]} flex items-center justify-center mb-3`}
      >
        <Icon className={`w-4 h-4 ${TONE_FG[tone]}`} />
      </div>
      <div className="text-2xl font-semibold text-white">
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-[#A0A0A0] mt-0.5">{label}</div>
    </div>
  )
}
