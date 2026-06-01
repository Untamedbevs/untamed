'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Check,
  Clock,
  Gift,
  Lock,
  Loader2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { REWARDS } from '@/lib/loyalty/constants'
import type {
  PortalLoyaltyRedemption,
  PortalLoyaltyTransaction,
  PortalReferralRewardEarned,
} from './page'

interface Props {
  memberFirstName: string | null
  pointsBalance: number
  initialTransactions: PortalLoyaltyTransaction[]
  initialRedemptions: PortalLoyaltyRedemption[]
  initialReferralRewards: PortalReferralRewardEarned[]
}

type CatalogReward = (typeof REWARDS)[number]

interface ActivityRow {
  id: string
  kind: 'transaction' | 'redemption'
  date: string
  label: string
  pointsDelta: number
  status?: PortalLoyaltyRedemption['status']
}

const REDEMPTION_STATUS_STYLES: Record<
  PortalLoyaltyRedemption['status'],
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: 'Pending',
    cls: 'bg-[#FFFF00]/15 text-[#FFFF00] border-[#FFFF00]/30',
    Icon: Clock,
  },
  fulfilled: {
    label: 'Fulfilled',
    cls: 'bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/30',
    Icon: Check,
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'bg-red-500/15 text-red-400 border-red-500/30',
    Icon: X,
  },
}

export function PortalRewardsClient({
  memberFirstName,
  pointsBalance: initialBalance,
  initialTransactions,
  initialRedemptions,
  initialReferralRewards,
}: Props) {
  const [balance, setBalance] = useState(initialBalance)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [redemptions, setRedemptions] = useState(initialRedemptions)
  const [pendingReward, setPendingReward] = useState<CatalogReward | null>(null)
  const [redeemingSlug, setRedeemingSlug] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const lifetimeEarned = useMemo(
    () =>
      transactions
        .filter((t) => t.points > 0)
        .reduce((sum, t) => sum + t.points, 0),
    [transactions]
  )
  const lifetimeRedeemed = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'redemption')
        .reduce((sum, t) => sum + Math.abs(t.points), 0),
    [transactions]
  )

  const activity: ActivityRow[] = useMemo(() => {
    const txnRows: ActivityRow[] = transactions.map((t) => ({
      id: `txn-${t.id}`,
      kind: 'transaction',
      date: t.created_at,
      label: t.description || labelForType(t.type),
      pointsDelta: t.points,
    }))
    const redemptionRows: ActivityRow[] = redemptions.map((r) => ({
      id: `red-${r.id}`,
      kind: 'redemption',
      date: r.created_at,
      label: r.reward_label,
      pointsDelta: -r.points_cost,
      status: r.status,
    }))
    return [...txnRows, ...redemptionRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30)
  }, [transactions, redemptions])

  async function confirmRedeem(reward: CatalogReward) {
    setError('')
    setSuccess('')
    setRedeemingSlug(reward.id)
    try {
      const res = await fetch('/api/portal/redemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardSlug: reward.id }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Redemption failed')
      }

      // Optimistically update local state with the server response.
      setBalance(data.newBalance ?? balance - reward.pointsCost)
      setRedemptions((prev) => [data.redemption, ...prev])
      setTransactions((prev) => [
        {
          id: data.redemption.redeem_transaction_id || `tmp-${data.redemption.id}`,
          member_id: data.redemption.member_id,
          points: -reward.pointsCost,
          type: 'redemption',
          description: `Redeemed: ${reward.name}`,
          created_at: data.redemption.created_at,
        },
        ...prev,
      ])
      setSuccess(`${reward.name} redeemed! We'll be in touch about delivery.`)
      setPendingReward(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redemption failed')
    } finally {
      setRedeemingSlug(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl text-white mb-1">
          {memberFirstName ? `Hey ${memberFirstName}, ` : ''}your rewards
        </h1>
        <p className="text-sm text-[#A0A0A0]">
          Earn points on every receipt and submission. Trade them in for swag
          when you&apos;re ready.
        </p>
      </div>

      {/* Balance hero */}
      <div className="bg-gradient-to-br from-[#9B30FF] to-[#7E22CE] border border-[#9B30FF]/40 rounded-2xl p-8">
        <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
          <Sparkles className="w-4 h-4" />
          Points balance
        </div>
        <div className="text-5xl font-headline text-white mb-4">
          {balance.toLocaleString()}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-white/80 text-sm">
          <div>
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">
              Lifetime earned
            </div>
            <div className="text-white font-semibold text-lg">
              {lifetimeEarned.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">
              Lifetime redeemed
            </div>
            <div className="text-white font-semibold text-lg">
              {lifetimeRedeemed.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">
              Redemptions
            </div>
            <div className="text-white font-semibold text-lg">
              {redemptions.length}
            </div>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm border ${
            error
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
          }`}
        >
          {error ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{error || success}</span>
        </div>
      )}

      {/* Catalog */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline text-xl text-white">Reward catalog</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REWARDS.map((reward) => {
            const affordable = balance >= reward.pointsCost
            const redeeming = redeemingSlug === reward.id
            return (
              <div
                key={reward.id}
                className={`bg-[#141414] border rounded-2xl p-5 flex flex-col transition-colors ${
                  affordable
                    ? 'border-[#2A2A2A] hover:border-[#9B30FF]'
                    : 'border-[#2A2A2A] opacity-60'
                }`}
              >
                <div className="aspect-[3/2] bg-gradient-to-br from-[#9B30FF]/20 to-[#0A0A0A] rounded-xl mb-4 flex items-center justify-center border border-[#9B30FF]/20">
                  <Gift className="w-10 h-10 text-[#9B30FF]" />
                </div>
                <h3 className="font-semibold text-white mb-1">{reward.name}</h3>
                <p className="text-xs text-[#A0A0A0] mb-4 flex-1">
                  {reward.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[#9B30FF] font-semibold">
                    {reward.pointsCost.toLocaleString()} pts
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingReward(reward)}
                    disabled={!affordable || redeeming}
                    className="bg-[#9B30FF] text-white text-xs font-semibold rounded-full px-3 py-1.5 hover:bg-[#7E22CE] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {redeeming ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : affordable ? (
                      <Gift className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    {affordable ? 'Redeem' : 'Locked'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Activity */}
      <section>
        <h2 className="font-headline text-xl text-white mb-4">Recent activity</h2>
        {activity.length === 0 ? (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 text-center text-sm text-[#A0A0A0]">
            No activity yet. Upload a receipt to start earning.
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">
            {activity.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-medium truncate">
                    {row.label}
                  </div>
                  <div className="text-xs text-[#A0A0A0] mt-0.5">
                    {new Date(row.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {row.kind === 'redemption' && row.status && (
                    <RedemptionStatusPill status={row.status} />
                  )}
                  <div
                    className={`text-sm font-semibold ${
                      row.pointsDelta >= 0 ? 'text-[#39FF14]' : 'text-[#FF3D5B]'
                    }`}
                  >
                    {row.pointsDelta >= 0 ? '+' : ''}
                    {row.pointsDelta.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Referral rewards link */}
      {initialReferralRewards.length > 0 ? (
        <section>
          <h2 className="font-headline text-xl text-white mb-4">
            Referral tier rewards
          </h2>
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">
            {initialReferralRewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <div className="text-white text-sm font-medium">
                    {r.tier?.label || 'Referral reward'}
                  </div>
                  {r.tier?.description && (
                    <div className="text-xs text-[#A0A0A0] mt-0.5">
                      {r.tier.description}
                    </div>
                  )}
                  <div className="text-[10px] text-[#666] mt-1">
                    Earned{' '}
                    {new Date(r.earned_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <RedemptionStatusPill status={r.status} />
              </div>
            ))}
          </div>
          <Link
            href="/portal/referrals"
            className="text-sm text-[#9B30FF] hover:text-[#B266FF] inline-flex items-center gap-1 mt-3"
          >
            <Trophy className="w-4 h-4" />
            View referral progress
          </Link>
        </section>
      ) : (
        <section>
          <Link
            href="/portal/referrals"
            className="block bg-[#141414] border border-[#2A2A2A] hover:border-[#9B30FF] rounded-2xl p-5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-[#9B30FF]" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">Earn more via referrals</div>
                <div className="text-xs text-[#A0A0A0]">
                  Share Untamed to unlock tier rewards on top of points.
                </div>
              </div>
              <span className="text-[#9B30FF] text-sm">→</span>
            </div>
          </Link>
        </section>
      )}

      {pendingReward && (
        <ConfirmRedeemModal
          reward={pendingReward}
          balance={balance}
          submitting={redeemingSlug === pendingReward.id}
          onCancel={() => setPendingReward(null)}
          onConfirm={() => confirmRedeem(pendingReward)}
        />
      )}
    </div>
  )
}

function RedemptionStatusPill({
  status,
}: {
  status: PortalLoyaltyRedemption['status']
}) {
  const style = REDEMPTION_STATUS_STYLES[status]
  const Icon = style.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${style.cls}`}
    >
      <Icon className="w-3 h-3" />
      {style.label}
    </span>
  )
}

function ConfirmRedeemModal({
  reward,
  balance,
  submitting,
  onCancel,
  onConfirm,
}: {
  reward: CatalogReward
  balance: number
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-headline text-xl text-white mb-1">
              Redeem {reward.name}?
            </h3>
            <p className="text-sm text-[#A0A0A0]">{reward.description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-[#A0A0A0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#A0A0A0]">Cost</span>
            <span className="text-white font-semibold">
              {reward.pointsCost.toLocaleString()} pts
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#A0A0A0]">Your balance</span>
            <span className="text-white">{balance.toLocaleString()} pts</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2A2A2A] pt-2">
            <span className="text-[#A0A0A0]">After redemption</span>
            <span className="text-[#39FF14] font-semibold">
              {(balance - reward.pointsCost).toLocaleString()} pts
            </span>
          </div>
        </div>
        <p className="text-xs text-[#666]">
          We&apos;ll reach out by email to confirm your shipping address before
          fulfilling. Redemptions can be cancelled by the team and points
          refunded.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-sm text-[#A0A0A0] hover:text-white px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Gift className="w-4 h-4" />
            )}
            Confirm redeem
          </button>
        </div>
      </div>
    </div>
  )
}

function labelForType(type: PortalLoyaltyTransaction['type']): string {
  switch (type) {
    case 'receipt_approved':
      return 'Receipt approved'
    case 'signup_bonus':
      return 'Signup bonus'
    case 'redemption':
      return 'Redemption'
    case 'adjustment':
      return 'Manual adjustment'
    default:
      return 'Activity'
  }
}
