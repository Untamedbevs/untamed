'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Archive } from 'lucide-react'
import { ContentEditor, type EmailContent } from '@/components/admin/email/ContentEditor'
import type { EmailBlock } from '@/lib/email/blocks'

interface Template {
  id: string
  name: string
  description: string | null
  category: 'campaign' | 'flow' | 'outreach'
  subject: string
  preheader: string | null
  blocks: EmailBlock[]
  is_archived: boolean
}

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [template, setTemplate] = useState<Template | null>(null)
  const [content, setContent] = useState<EmailContent>({ subject: '', preheader: '', blocks: [] })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/crm/email/templates/${id}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) return setError(json.error || 'Could not load template')
        setTemplate(json.template)
        setContent({ subject: json.template.subject || '', preheader: json.template.preheader || '', blocks: json.template.blocks || [] })
      })
      .catch(() => setError('Could not load template'))
  }, [id])

  async function save(patch: Partial<Template> = {}) {
    if (!template) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/crm/email/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description || '',
          subject: content.subject,
          preheader: content.preheader,
          blocks: content.blocks,
          ...patch,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Save failed')
      else {
        setTemplate(json.template)
        setSavedAt(new Date().toLocaleTimeString())
      }
    } finally {
      setSaving(false)
    }
  }

  if (!template) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center text-[#A0A0A0]">
        {error ? <p className="text-red-400">{error}</p> : <Loader2 className="w-5 h-5 animate-spin inline" />}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin/crm/email/templates" className="text-[#A0A0A0] hover:text-white" aria-label="Back to templates">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <input
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            className="bg-transparent text-2xl font-bold text-white focus:outline-none border-b border-transparent focus:border-[#2A2A2A] min-w-0"
          />
          <span className="text-[10px] uppercase tracking-wider text-[#666]">{template.category}</span>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-[#666]">Saved {savedAt}</span>}
          <button
            onClick={() => save({ is_archived: !template.is_archived })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
          >
            <Archive className="w-3.5 h-3.5" /> {template.is_archived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => save()} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#B560FF] disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <input
        value={template.description || ''}
        onChange={(e) => setTemplate({ ...template, description: e.target.value })}
        placeholder="Description (what this template is for)"
        className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm"
      />
      <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
        <ContentEditor value={content} onChange={setContent} flowTags={template.category === 'flow'} />
      </section>
    </div>
  )
}
