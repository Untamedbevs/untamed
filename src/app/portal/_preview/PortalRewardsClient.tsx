'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  AlertCircle,
  Check,
  Clock,
  Gift,
  History,
  Lock,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { REWARDS } from '@/lib/loyalty/constants'
import type { CashBackStatus } from '@/lib/rewards/state-rules'
import {
  ANNUAL_REWARD_CAP_CENTS,
  ASSET_BASE,
  formatRetailValue,
} from '@/lib/referral-hq/program'
import { CatalogArt } from '@/components/referral-hq/CatalogArt'
import '@/components/referral-hq/hq.css'
import { CashBackPreview } from '../rewards/CashBackPreview'
import type {
  PortalLoyaltyRedemption,
  PortalLoyaltyTransaction,
} from './RewardsPreview'

interface Props {
  /** False until the member has enrolled (21+, state, Program Rules). */
  canRedeem: boolean
  memberFirstName: string | null
  pointsBalance: number
  initialTransactions: PortalLoyaltyTransaction[]
  initialRedemptions: PortalLoyaltyRedemption[]
  /** Retail value redeemed this calendar year (counts toward the yearly cap). */
  rewardValueThisYearCents: number
  /** Cash-back preview for the member's state (visual only); null hides it. */
  cashBack: { status: CashBackStatus | null; stateName: string | null } | null
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
  canRedeem,
  memberFirstName,
  pointsBalance: initialBalance,
  initialTransactions,
  initialRedemptions,
  rewardValueThisYearCents,
  cashBack,
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
    // A redemption's points debit is shown on its redemption row (with its
    // status), so skip the matching ledger entry instead of listing it twice.
    const shownAsRedemption = new Set(redemptions.map((r) => r.redeem_transaction_id))
    const txnRows: ActivityRow[] = transactions
      .filter((t) => !shownAsRedemption.has(t.id))
      .map((t) => ({
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
      const res = await fetch('/api/portal/rewards/redeem', {
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
          {memberFirstName ? `Hey ${memberFirstName}, ` : ''}your points
        </h1>
        <p className="text-sm text-[#A0A0A0]">
          A thank-you for being here early. Points land here as you join in,
          share, and (where your state allows) shop. Trade them in for merch
          whenever you&apos;re ready.
        </p>
      </div>

      {/* Balance hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#FFD700]/25 bg-gradient-to-br from-[#1d1608] via-[#141414] to-[#141414] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#9B30FF]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 h-56 w-56 rounded-full bg-[#FFD700]/10 blur-3xl"
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFD700]">
              <Sparkles className="w-3.5 h-3.5" />
              Points balance
            </div>
            <div className="mt-2 font-display text-6xl font-bold text-white tabular-nums leading-none">
              {balance.toLocaleString()}
            </div>
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <BalanceStat label="Lifetime earned" value={lifetimeEarned.toLocaleString()} />
              <BalanceStat label="Lifetime redeemed" value={lifetimeRedeemed.toLocaleString()} />
              <BalanceStat label="Redemptions" value={String(redemptions.length)} />
              <BalanceStat
                label="Rewards this year"
                value={formatRetailValue(rewardValueThisYearCents)}
                hint={`Retail value · limit ${formatRetailValue(ANNUAL_REWARD_CAP_CENTS)}`}
              />
            </div>
          </div>
          <Image
            src={`${ASSET_BASE}/rewards/key.webp`}
            alt=""
            width={160}
            height={160}
            className="hidden sm:block h-36 w-36 lg:h-40 lg:w-40 shrink-0 object-contain drop-shadow-[0_8px_24px_rgba(255,215,0,0.25)] hq-pop"
            priority
          />
        </div>
      </section>

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
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
            <Gift className="w-3.5 h-3.5" /> Reward catalog
          </h2>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Merch only, never alcohol. Redemptions count toward the{' '}
            {formatRetailValue(ANNUAL_REWARD_CAP_CENTS)} yearly reward limit.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REWARDS.map((reward) => {
            const affordable = canRedeem && balance >= reward.pointsCost
            const redeeming = redeemingSlug === reward.id
            return (
              <div
                key={reward.id}
                className={`group border rounded-3xl p-5 flex flex-col transition-colors ${
                  affordable
                    ? 'border-[#FFD700]/25 bg-gradient-to-b from-[#FFD700]/[0.07] to-[#141414] hover:border-[#FFD700]/60'
                    : 'border-[#2A2A2A] bg-[#141414] opacity-60'
                }`}
              >
                <div className="aspect-[3/2] bg-[#0A0A0A]/70 rounded-2xl mb-4 flex items-center justify-center border border-[#222]">
                  <CatalogArt
                    rewardId={reward.id}
                    size={128}
                    className={`h-24 w-24 transition-transform duration-300 group-hover:scale-105 ${
                      affordable ? 'drop-shadow-[0_6px_18px_rgba(255,215,0,0.3)]' : ''
                    }`}
                  />
                </div>
                <h3 className="font-semibold text-white mb-1">{reward.name}</h3>
                <p className="text-xs text-[#A0A0A0] mb-4 flex-1">
                  {reward.description}
                </p>
                <p className="text-[11px] text-[#707070] mb-3">
                  Approx. retail value ${(reward.retailValueCents / 100).toFixed(2)}
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

      {cashBack && <CashBackPreview status={cashBack.status} stateName={cashBack.stateName} />}

      {/* Activity */}
      <section>
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0] mb-4">
          <History className="w-3.5 h-3.5" /> Recent activity
        </h2>
        {activity.length === 0 ? (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl p-8 text-center text-sm text-[#A0A0A0]">
            Nothing here yet. Points show up here as you take part.
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl divide-y divide-[#222]">
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
                    className={`font-display text-base font-bold tabular-nums ${
                      row.pointsDelta >= 0 ? 'text-[#FFD700]' : 'text-[#A0A0A0]'
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

function BalanceStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A]/60 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A0]">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-white tabular-nums">
        {value}
      </div>
      {hint && <div className="text-[11px] text-[#777] truncate">{hint}</div>}
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
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl max-w-md w-full p-6 space-y-4">
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
          fulfilling. Rewards ship within your state of residence, apparel in
          adult sizes. Redemptions count toward the yearly reward limit in the
          Program Rules and can be cancelled by the team with points refunded.
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
    case 'ugc_approved':
      return 'Content approved'
    case 'online_order':
      return 'Online order'
    case 'referral_signup':
      return 'Friend joined the pack'
    case 'referral_purchase':
      return "Friend's first purchase"
    case 'reversal':
      return 'Reversed'
    case 'expiration':
      return 'Points expired'
    default:
      return 'Activity'
  }
}
