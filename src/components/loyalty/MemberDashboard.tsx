'use client'

import { useState, useCallback } from 'react'
import { Trophy, Clock, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import type { LoyaltyMember, LoyaltyTransaction, LoyaltyReceipt } from '@/lib/loyalty/types'
import { RewardsShowcase } from './RewardsShowcase'
import { ReceiptUpload } from './ReceiptUpload'

interface MemberDashboardProps {
  drink: Drink
  member: LoyaltyMember
  transactions: LoyaltyTransaction[]
  receipts: LoyaltyReceipt[]
  onRefresh: () => void
}

export function MemberDashboard({
  drink,
  member,
  transactions,
  receipts,
  onRefresh,
}: MemberDashboardProps) {
  const [tab, setTab] = useState<'rewards' | 'history' | 'upload'>('rewards')

  const handleUploaded = useCallback(() => {
    onRefresh()
  }, [onRefresh])

  const pendingCount = receipts.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-8">
      {/* Points Banner */}
      <div
        className="relative p-6 rounded-2xl border overflow-hidden"
        style={{ borderColor: `${drink.color}40` }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(circle at 30% 50%, ${drink.color}, transparent 70%)` }}
        />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[#999] text-sm uppercase tracking-wider mb-1">Your Points</p>
            <p
              className="font-[var(--font-oswald)] text-5xl font-bold"
              style={{ color: drink.color }}
            >
              {member.points_balance}
            </p>
          </div>
          <Trophy className="w-12 h-12 opacity-30" style={{ color: drink.color }} />
        </div>
        {member.first_name && (
          <p className="relative text-[#999] text-sm mt-2">
            Welcome back, <span className="text-white">{member.first_name}</span>
          </p>
        )}
        {pendingCount > 0 && (
          <p className="relative text-sm mt-2" style={{ color: drink.color }}>
            {pendingCount} receipt{pendingCount > 1 ? 's' : ''} pending review
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#1A1A1A] rounded-xl">
        {([
          { key: 'rewards' as const, label: 'Rewards', icon: Trophy },
          { key: 'upload' as const, label: 'Upload', icon: Receipt },
          { key: 'history' as const, label: 'History', icon: Clock },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: tab === key ? `${drink.color}20` : 'transparent',
              color: tab === key ? drink.color : '#999',
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'rewards' && (
        <RewardsShowcase drink={drink} currentPoints={member.points_balance} />
      )}

      {tab === 'upload' && (
        <ReceiptUpload drink={drink} memberId={member.id} onUploaded={handleUploaded} />
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <h3
            className="font-[var(--font-oswald)] text-2xl font-bold uppercase tracking-wider"
            style={{ color: drink.color }}
          >
            Point History
          </h3>

          {transactions.length === 0 ? (
            <p className="text-[#666] text-sm py-8 text-center">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-[#141414] border border-[#2A2A2A] rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    {tx.points > 0 ? (
                      <ArrowUpRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <p className="text-white text-sm">{tx.description || tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-[#666] text-xs">
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
