'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { RETAIL_LANDING_PAGES } from '@/lib/retail/landing-pages'

const ORIGIN = 'https://untamedbevs.com'

export default function UtmBuilderPage() {
  const [path, setPath] = useState('/lp/retail/bars')
  const [source, setSource] = useState('meta')
  const [medium, setMedium] = useState('cpc')
  const [campaign, setCampaign] = useState('fl_bars_q3')
  const [content, setContent] = useState('')
  const [term, setTerm] = useState('')
  const [copied, setCopied] = useState(false)

  const url = useMemo(() => {
    const u = new URL(path.startsWith('http') ? path : `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`)
    if (source) u.searchParams.set('utm_source', source)
    if (medium) u.searchParams.set('utm_medium', medium)
    if (campaign) u.searchParams.set('utm_campaign', campaign)
    if (content) u.searchParams.set('utm_content', content)
    if (term) u.searchParams.set('utm_term', term)
    return u.toString()
  }, [path, source, medium, campaign, content, term])

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const inputClass =
    'w-full rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2.5 text-sm text-white placeholder:text-[#666] focus:outline-none'

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link2 className="h-5 w-5 text-[#FFD700]" />
        <h1 className="text-2xl font-bold text-white">UTM Builder</h1>
      </div>
      <p className="mb-6 text-sm text-[#999]">
        Build tracked links for paid retail campaigns. First-touch attribution reads these params on landing.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {RETAIL_LANDING_PAGES.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setPath(`/lp/retail/${p.slug}`)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              path === `/lp/retail/${p.slug}`
                ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                : 'border-[#2A2A2A] text-[#999] hover:text-white'
            }`}
          >
            /lp/retail/{p.slug}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPath('/retail')}
          className={`rounded-full border px-3 py-1.5 text-xs ${
            path === '/retail'
              ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
              : 'border-[#2A2A2A] text-[#999] hover:text-white'
          }`}
        >
          /retail
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-[#999]">
          Path
          <input className={`${inputClass} mt-1`} value={path} onChange={(e) => setPath(e.target.value)} />
        </label>
        <label className="text-xs text-[#999]">
          utm_source
          <input className={`${inputClass} mt-1`} value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <label className="text-xs text-[#999]">
          utm_medium
          <input className={`${inputClass} mt-1`} value={medium} onChange={(e) => setMedium(e.target.value)} />
        </label>
        <label className="text-xs text-[#999]">
          utm_campaign
          <input className={`${inputClass} mt-1`} value={campaign} onChange={(e) => setCampaign(e.target.value)} />
        </label>
        <label className="text-xs text-[#999]">
          utm_content
          <input className={`${inputClass} mt-1`} value={content} onChange={(e) => setContent(e.target.value)} placeholder="ad variant" />
        </label>
        <label className="text-xs text-[#999]">
          utm_term
          <input className={`${inputClass} mt-1`} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="keyword" />
        </label>
      </div>

      <div className="mt-6 rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
        <p className="break-all font-mono text-sm text-white">{url}</p>
        <button
          type="button"
          onClick={copy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A]"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
