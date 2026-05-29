'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Trophy, Clock, Receipt, ArrowUpRight, ArrowDownRight, Camera, Sparkles, ArrowRight } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import type { LoyaltyMember, LoyaltyTransaction, LoyaltyReceipt } from '@/lib/loyalty/types'
import { RewardsShowcase } from './RewardsShowcase'
import { ReceiptUpload } from './ReceiptUpload'
import { POINTS } from '@/lib/loyalty/constants'

interface MemberDashboardProps {
  drink: Drink
  member: LoyaltyMember
  transactions: LoyaltyTransaction[]
  receipts: LoyaltyReceipt[]
  onRefresh: () => void
  accentColor?: string
  accentGlow?: string
}

export function MemberDashboard({
  drink,
  member,
  transactions,
  receipts,
  onRefresh,
  accentColor,
  accentGlow,
}: MemberDashboardProps) {
  const color = accentColor || drink.color
  const glow = accentGlow || drink.colorGlow
  const [tab, setTab] = useState<'rewards' | 'history' | 'upload'>('rewards')

  const handleUploaded = useCallback(() => {
    onRefresh()
  }, [onRefresh])

  const pendingCount = receipts.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-8">
      {/* Points Banner */}
      <div
        className="relative p-8 rounded-2xl border overflow-hidden"
        style={{ borderColor: `${color}40` }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(circle at 30% 50%, ${color}, transparent 70%)` }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            {member.first_name && (
              <p className="text-untamed-white-muted text-sm mb-1">
                Welcome back, <span className="text-untamed-white font-medium">{member.first_name}</span>
              </p>
            )}
            <p className="text-untamed-white-muted text-sm uppercase tracking-wider mb-1">Your Points</p>
            <p
              className="font-condensed text-6xl md:text-7xl font-bold"
              style={{ color }}
            >
              {member.points_balance}
            </p>
          </div>
          <Trophy className="w-16 h-16 opacity-20" style={{ color }} />
        </div>
        {pendingCount > 0 && (
          <p className="relative text-sm mt-3" style={{ color }}>
            {pendingCount} receipt{pendingCount > 1 ? 's' : ''} pending review
          </p>
        )}
      </div>

      {/* UGC CTA -- photo & video submissions earn loyalty points */}
      <Link
        href={`/portal/login?email=${encodeURIComponent(member.email)}&returnTo=${encodeURIComponent('/portal/ugc/new')}`}
        className="group relative block p-6 rounded-2xl border-2 border-[#9B30FF]/30 bg-gradient-to-br from-[#9B30FF]/10 via-[#9B30FF]/5 to-transparent hover:border-[#9B30FF] transition-colors overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#9B30FF]/20 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
        <div className="relative flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-[#9B30FF]/20 border border-[#9B30FF]/40 flex items-center justify-center">
            <Camera className="w-6 h-6 text-[#9B30FF]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-condensed text-xl font-bold text-white uppercase tracking-wider">
                Earn more points
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#9B30FF] text-white text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                New
              </span>
            </div>
            <p className="text-sm text-untamed-white-muted mb-3">
              Submit photos & videos of your Untamed moments. Approved posts earn{' '}
              <span className="text-[#9B30FF] font-semibold">{POINTS.PER_UGC_APPROVED} pts</span>
              {' '}— featured posts earn{' '}
              <span className="text-[#9B30FF] font-semibold">{POINTS.PER_UGC_FEATURED} pts</span>.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#9B30FF] group-hover:gap-2 transition-all">
              Sign in to submit
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 p-1.5 bg-untamed-black-light rounded-xl">
        {([
          { key: 'rewards' as const, label: 'Rewards', icon: Trophy },
          { key: 'upload' as const, label: 'Upload Receipt', icon: Receipt },
          { key: 'history' as const, label: 'History', icon: Clock },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: tab === key ? `${color}20` : 'transparent',
              color: tab === key ? color : 'var(--muted-foreground)',
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'rewards' && (
        <RewardsShowcase accentColor={color} currentPoints={member.points_balance} />
      )}

      {tab === 'upload' && (
        <ReceiptUpload drink={drink} memberId={member.id} onUploaded={handleUploaded} accentColor={color} accentGlow={glow} />
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <h3
            className="font-condensed text-2xl font-bold uppercase tracking-wider"
            style={{ color }}
          >
            Point History
          </h3>

          {transactions.length === 0 ? (
            <p className="text-muted text-sm py-12 text-center">No transactions yet. Upload a receipt to earn your first points!</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-untamed-black-card border border-card-border rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    {tx.points > 0 ? (
                      <ArrowUpRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <p className="text-untamed-white text-sm">{tx.description || tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-muted text-xs">
                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className="font-bold text-sm"
                    style={{ color: tx.points > 0 ? '#4ade80' : '#f87171' }}
                  >
                    {tx.points > 0 ? '+' : ''}{tx.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
