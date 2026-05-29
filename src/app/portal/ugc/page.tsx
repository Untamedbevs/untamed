'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, Loader2, Plus } from 'lucide-react'
import type { UgcSubmissionWithAssets } from '@/lib/ugc/types'
import { UgcSubmissionCard } from '@/components/portal/UgcSubmissionCard'

export default function PortalUgcListPage() {
  const [submissions, setSubmissions] = useState<UgcSubmissionWithAssets[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/portal/ugc')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (!cancelled) setSubmissions(data.submissions || [])
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load submissions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl text-white">My UGC</h1>
          <p className="text-sm text-[#A0A0A0]">
            Photos and videos you&apos;ve shared with Untamed.
          </p>
        </div>
        <Link
          href="/portal/ugc/new"
          className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-4 py-2 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New submission
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
      ) : submissions.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#9B30FF]/15 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-6 h-6 text-[#9B30FF]" />
          </div>
          <h3 className="text-white font-semibold mb-1">No submissions yet</h3>
          <p className="text-sm text-[#A0A0A0] mb-6 max-w-md mx-auto">
            Share a photo or video with us. Approved submissions earn 50 loyalty
            points and may be featured on our site.
          </p>
          <Link
            href="/portal/ugc/new"
            className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2.5 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit your first photo or video
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {submissions.map((s) => (
            <UgcSubmissionCard key={s.id} submission={s} />
          ))}
        </div>
      )}
    </div>
  )
}
