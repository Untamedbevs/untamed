'use client'

import { Gift, Lock, Check } from 'lucide-react'
import { REWARDS } from '@/lib/loyalty/constants'
import type { Drink } from '@/lib/drinks'

interface RewardsShowcaseProps {
  drink: Drink
  currentPoints?: number
}

export function RewardsShowcase({ drink, currentPoints = 0 }: RewardsShowcaseProps) {
  return (
    <div className="space-y-4">
      <h3
        className="font-[var(--font-oswald)] text-2xl font-bold uppercase tracking-wider"
        style={{ color: drink.color }}
      >
        Rewards
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REWARDS.map((reward) => {
          const canRedeem = currentPoints >= reward.pointsCost
          return (
            <div
              key={reward.id}
              className="relative p-5 rounded-xl border bg-[#141414] transition-all duration-300"
              style={{
                borderColor: canRedeem ? `${drink.color}60` : '#2A2A2A',
              }}
            >
              {canRedeem && (
                <div
                  className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: drink.color }}
                >
                  <Check className="w-3.5 h-3.5 text-black" />
                </div>
              )}

              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${drink.color}15` }}
                >
                  {canRedeem ? (
                    <Gift className="w-5 h-5" style={{ color: drink.color }} />
                  ) : (
                    <Lock className="w-5 h-5 text-[#666]" />
                  )}
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">{reward.name}</h4>
                  <p className="text-[#999] text-xs mt-0.5">{reward.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: canRedeem ? drink.color : '#666' }}
                >
                  {reward.pointsCost} pts
                </span>
                {currentPoints > 0 && !canRedeem && (
                  <span className="text-[#666] text-xs">
                    {reward.pointsCost - currentPoints} more needed
                  </span>
                )}
              </div>

              {currentPoints > 0 && (
                <div className="mt-3 h-1 rounded-full bg-[#2A2A2A] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (currentPoints / reward.pointsCost) * 100)}%`,
                      backgroundColor: drink.color,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
