'use client'

import { Trophy, Lock, CheckCircle } from 'lucide-react'
import type { ReferralRewardTier, ReferralRewardEarned } from '@/lib/referral/types'

interface TierProgressProps {
  tiers: ReferralRewardTier[]
  rewards: ReferralRewardEarned[]
  consumerSignups: number
  distributorLeads: number
}

export function TierProgress({ tiers, rewards, consumerSignups, distributorLeads }: TierProgressProps) {
  const earnedTierIds = new Set(rewards.map((r) => r.tier_id))

  return (
    <div className="space-y-4">
      {tiers.map((tier) => {
        const earned = earnedTierIds.has(tier.id)
        const reward = rewards.find((r) => r.tier_id === tier.id)
        const signupProgress = tier.min_consumer_signups > 0
          ? Math.min(consumerSignups / tier.min_consumer_signups, 1)
          : 1
        const leadProgress = tier.min_distributor_leads > 0
          ? Math.min(distributorLeads / tier.min_distributor_leads, 1)
          : 1

        return (
          <div
            key={tier.id}
            className="rounded-2xl border-2 p-6 transition-all duration-300"
            style={{
              borderColor: earned ? '#FFD70066' : '#2A2A2A',
              backgroundColor: earned ? '#FFD70008' : '#141414',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: earned ? '#FFD7001A' : '#1A1A1A',
                }}
              >
                {earned ? (
                  <CheckCircle className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Trophy className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white">{tier.tier_name}</h4>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
              </div>
              {earned && reward && (
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: reward.is_claimed ? '#22c55e1A' : '#FFD7001A',
                    color: reward.is_claimed ? '#22c55e' : '#FFD700',
                  }}
                >
                  {reward.is_claimed ? 'Claimed' : 'Earned'}
                </span>
              )}
              {!earned && (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            {!earned && (
              <div className="space-y-3">
                {tier.min_consumer_signups > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Consumer Signups</span>
                      <span className="text-white">
                        {Math.min(consumerSignups, tier.min_consumer_signups)} / {tier.min_consumer_signups}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-untamed-black-light overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${signupProgress * 100}%`,
                          backgroundColor: '#FFD700',
                        }}
                      />
                    </div>
                  </div>
                )}
                {tier.min_distributor_leads > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Distributor Leads</span>
                      <span className="text-white">
                        {Math.min(distributorLeads, tier.min_distributor_leads)} / {tier.min_distributor_leads}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-untamed-black-light overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${leadProgress * 100}%`,
                          backgroundColor: '#FF8C2A',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
