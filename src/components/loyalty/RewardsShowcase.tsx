'use client'

import { motion } from 'framer-motion'
import { Gift, Lock, Check } from 'lucide-react'
import { REWARDS } from '@/lib/loyalty/constants'

interface RewardsShowcaseProps {
  accentColor?: string
  currentPoints?: number
}

export function RewardsShowcase({ accentColor = '#FFD700', currentPoints = 0 }: RewardsShowcaseProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {REWARDS.map((reward, idx) => {
        const canRedeem = currentPoints >= reward.pointsCost
        return (
          <motion.div
            key={reward.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="relative p-6 rounded-2xl border bg-untamed-black-card transition-all duration-300 hover:-translate-y-1"
            style={{
              borderColor: canRedeem ? `${accentColor}60` : 'var(--card-border)',
            }}
          >
            {canRedeem && (
              <div
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: accentColor }}
              >
                <Check className="w-4 h-4 text-black" />
              </div>
            )}

            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              {canRedeem ? (
                <Gift className="w-6 h-6" style={{ color: accentColor }} />
              ) : (
                <Lock className="w-6 h-6 text-muted" />
              )}
            </div>

            <h4 className="text-untamed-white font-semibold text-base mb-1">{reward.name}</h4>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{reward.description}</p>

            <div className="flex items-center justify-between">
              <span
                className="text-sm font-bold uppercase tracking-wider"
                style={{ color: canRedeem ? accentColor : 'var(--muted)' }}
              >
                {reward.pointsCost} pts
              </span>
              {currentPoints > 0 && !canRedeem && (
                <span className="text-muted text-xs">
                  {reward.pointsCost - currentPoints} more
                </span>
              )}
            </div>

            {currentPoints > 0 && (
              <div className="mt-4 h-1.5 rounded-full bg-untamed-black-light overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (currentPoints / reward.pointsCost) * 100)}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
