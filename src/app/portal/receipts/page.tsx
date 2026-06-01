'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Receipt } from 'lucide-react'
import type { LoyaltyReceiptWithAssets } from '@/lib/receipts/types'
import { ReceiptCard } from '@/components/portal/ReceiptCard'

export default function PortalReceiptsListPage() {
  const [receipts, setReceipts] = useState<LoyaltyReceiptWithAssets[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsLoyalty, setNeedsLoyalty] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/portal/receipts')
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}))
          if (data.error === 'NOT_A_LOYALTY_MEMBER') {
            if (!cancelled) setNeedsLoyalty(true)
            return
          }
        }
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (!cancelled) setReceipts(data.receipts || [])
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load receipts')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (needsLoyalty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-headline text-2xl text-white">My Receipts</h1>
          <p className="text-sm text-[#A0A0A0]">
            Earn points for every Untamed bottle you buy.
          </p>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#9B30FF]/15 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-6 h-6 text-[#9B30FF]" />
          </div>
          <h3 className="text-white font-semibold mb-1">
            Join the Loyalty Program
          </h3>
          <p className="text-sm text-[#A0A0A0] mb-6 max-w-md mx-auto">
            Become a loyalty member to upload receipts and start earning points.
          </p>
          <Link
            href="/loyalty"
            className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2.5 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors"
          >
            Join Loyalty
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl text-white">My Receipts</h1>
          <p className="text-sm text-[#A0A0A0]">
            Upload receipts to earn 25 points per bottle.
          </p>
        </div>
        <Link
          href="/portal/receipts/new"
          className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-4 py-2 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Upload receipt
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[#A0A0A0]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      ) : receipts.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#9B30FF]/15 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-6 h-6 text-[#9B30FF]" />
          </div>
          <h3 className="text-white font-semibold mb-1">No receipts yet</h3>
          <p className="text-sm text-[#A0A0A0] mb-6 max-w-md mx-auto">
            Snap a photo of your Untamed receipt and we&apos;ll add 25 points to
            your balance once it&apos;s reviewed.
          </p>
          <Link
            href="/portal/receipts/new"
            className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2.5 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Upload your first receipt
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} />
          ))}
        </div>
      )}
    </div>
  )
}
