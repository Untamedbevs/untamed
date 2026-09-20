'use client'

import { Send } from 'lucide-react'
import { CREATOR_PURPLE } from '@/lib/influencers/constants'

export function ApplyCTA({
  label = 'Apply to Partner',
}: {
  label?: string
}) {
  return (
    <a
      href="#apply"
      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3.5 rounded-full font-bold text-white uppercase tracking-wider text-sm sm:text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: CREATOR_PURPLE,
        boxShadow: '0 0 20px rgba(155, 48, 255, 0.35)',
      }}
    >
      <Send className="w-5 h-5 shrink-0" />
      {label}
    </a>
  )
}
