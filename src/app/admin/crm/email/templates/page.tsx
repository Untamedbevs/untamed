'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Loader2, LayoutTemplate } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateRow {
  id: string
  name: string
  description: string | null
  category: string
  subject: string
  updated_at: string
  is_archived: boolean
}

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'campaign', label: 'Campaigns' },
  { value: 'flow', label: 'Flows' },
  { value: 'outreach', label: 'Outreach' },
]

export default function TemplatesPage() {
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [archived, setArchived] = useState(false)
  const [rows, setRows] = useState<TemplateRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setRows(null)
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (archived) params.set('archived', '1')
    fetch(`/api/admin/crm/email/templates?${params}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) setError(json.error || 'Could not load templates')
        else setRows(json.templates)
      })
      .catch(() => setError('Could not load templates'))
  }, [category, archived])

  async function create() {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/crm/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Untitled template',
          category: category || 'campaign',
          blocks: [{ type: 'heading', text: '' }, { type: 'text', text: 'Hey {{first_name|there}},\n\n' }],
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not create template')
      else router.push(`/admin/crm/email/templates/${json.template.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm/email" className="text-[#A0A0A0] hover:text-white" aria-label="Back to email dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Templates</h1>
        </div>
        <button onClick={create} disabled={creating} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#B560FF] disabled:opacity-50">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} New template
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={cn('px-3 py-1.5 rounded-full text-xs border', category === c.value ? 'border-[#9B30FF]/60 bg-[#9B30FF]/10 text-white' : 'border-[#2A2A2A] text-[#A0A0A0]')}
          >
            {c.label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs text-[#A0A0A0] ml-2">
          <input type="checkbox" className="accent-[#9B30FF]" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived
        </label>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!rows ? (
        <div className="py-16 text-center text-[#A0A0A0]"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] p-10 text-center text-sm text-[#A0A0A0]">
          <LayoutTemplate className="w-6 h-6 mx-auto mb-2 text-[#666]" />
          No templates yet. Templates are reusable starting points for campaigns, flow emails, and outreach.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((t) => (
            <Link key={t.id} href={`/admin/crm/email/templates/${t.id}`} className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 hover:border-[#9B30FF]/50">
              <div className="flex items-center justify-between gap-2">
                <div className="text-white font-medium truncate">{t.name}</div>
                <span className="text-[10px] uppercase tracking-wider text-[#666]">{t.category}{t.is_archived ? ' · archived' : ''}</span>
              </div>
              <div className="text-xs text-[#A0A0A0] mt-1 truncate">{t.subject || 'No subject yet'}</div>
              <div className="text-[10px] text-[#666] mt-2">Updated {new Date(t.updated_at).toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
