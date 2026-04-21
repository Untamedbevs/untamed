'use client'

import { useState } from 'react'
import { Copy, Check, Link as LinkIcon, Users, Building2 } from 'lucide-react'

interface ReferralLinkCardProps {
  type: 'consumer' | 'distributor'
  link: string
  clicks?: number
  conversions?: number
}

export function ReferralLinkCard({ type, link, clicks = 0, conversions = 0 }: ReferralLinkCardProps) {
  const [copied, setCopied] = useState(false)

  const isConsumer = type === 'consumer'
  const Icon = isConsumer ? Users : Building2
  const color = isConsumer ? '#FFD700' : '#FF8C2A'
  const glow = isConsumer ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 140, 42, 0.2)'
  const label = isConsumer ? 'Consumer Link' : 'Distributor Link'
  const description = isConsumer
    ? 'Share with friends who want to try Untamed'
    : 'Share with businesses interested in selling Untamed'
  const conversionLabel = isConsumer ? 'Signups' : 'Leads'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div
      className="rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1"
      style={{ borderColor: `${color}33`, backgroundColor: '#141414' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}1A` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <h3 className="font-bold text-white">{label}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-untamed-black rounded-xl px-4 py-3 border border-card-border overflow-hidden">
          <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-untamed-white-muted truncate font-mono">{link}</span>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 16px ${glow}`,
          }}
        >
          {copied ? (
            <Check className="w-5 h-5 text-black" />
          ) : (
            <Copy className="w-5 h-5 text-black" />
          )}
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 rounded-xl bg-untamed-black px-4 py-3 border border-card-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Clicks</p>
          <p className="text-xl font-bold text-white">{clicks.toLocaleString()}</p>
        </div>
        <div className="flex-1 rounded-xl bg-untamed-black px-4 py-3 border border-card-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{conversionLabel}</p>
          <p className="text-xl font-bold" style={{ color }}>{conversions.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
