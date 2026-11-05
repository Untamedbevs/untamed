'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Loader2, Plus, Archive, Save } from 'lucide-react'
import { CRM_SENDERS } from '@/lib/crm/senders'
import { MERGE_TAGS, applyVariables, renderEmailHtml } from '@/lib/email/render'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  slug: string
  name: string
  kind: 'campaign' | 'transactional'
  subject: string
  body: string
  preheader: string | null
  sender_id: string | null
  default_audience: string | null
  updated_at: string
}

type Draft = Omit<Template, 'id' | 'updated_at'> & { id?: string }

const EMPTY: Draft = {
  slug: '',
  name: '',
  kind: 'campaign',
  subject: '',
  body: '',
  preheader: '',
  sender_id: 'support',
  default_audience: 'loyalty',
}

const SAMPLE_VARS: Record<string, string> = {
  first_name: 'Alex',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  portal_login_url: 'https://untamedbevs.com/portal/login',
  community_url: 'https://untamedbevs.com/community',
  order_number: 'UB-1042',
  message: 'Your order is packed and on its way.',
}

const input =
  'w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/crm/templates')
    const data = await res.json().catch(() => ({}))
    setTemplates(data.templates || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const preview = useMemo(() => {
    if (!draft) return ''
    return renderEmailHtml({
      body: applyVariables(draft.body || ' ', SAMPLE_VARS),
      preheader: draft.preheader ? applyVariables(draft.preheader, SAMPLE_VARS) : undefined,
      unsubscribeUrl: draft.kind === 'campaign' ? '#' : undefined,
      recipientEmail: SAMPLE_VARS.email,
    })
  }, [draft])

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
    setSaved(false)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)
    const { id, ...body } = draft
    const res = await fetch(id ? `/api/admin/crm/templates/${id}` : '/api/admin/crm/templates', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, slug: body.slug || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error || 'Save failed')
      return
    }
    setDraft({ ...data.template })
    setSaved(true)
    load()
  }

  async function archive() {
    if (!draft?.id) return
    if (!confirm(`Archive "${draft.name}"? It will disappear from the composer.`)) return
    await fetch(`/api/admin/crm/templates/${draft.id}`, { method: 'DELETE' })
    setDraft(null)
    load()
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm" className="text-[#A0A0A0] hover:text-white" aria-label="Back to CRM">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Email Templates</h1>
        </div>
        <button
          onClick={() => {
            setDraft({ ...EMPTY })
            setError(null)
            setSaved(false)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#B560FF]"
        >
          <Plus className="w-4 h-4" /> New template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-6">
        <aside className="rounded-xl border border-[#2A2A2A] bg-[#111] p-3 h-fit">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#A0A0A0] m-3" />
          ) : templates.length === 0 ? (
            <p className="text-xs text-[#A0A0A0] p-2">No templates yet.</p>
          ) : (
            (['campaign', 'transactional'] as const).map((kind) => {
              const list = templates.filter((t) => t.kind === kind)
              if (list.length === 0) return null
              return (
                <div key={kind} className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-[#666] px-2 mb-1">
                    {kind === 'campaign' ? 'Campaign' : 'Transactional'}
                  </div>
                  {list.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setDraft({ ...t })
                        setError(null)
                        setSaved(false)
                      }}
                      className={cn(
                        'w-full text-left px-2 py-2 rounded-lg text-sm flex items-start gap-2',
                        draft?.id === t.id ? 'bg-[#9B30FF]/10 text-white' : 'text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white'
                      )}
                    >
                      <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate">{t.name}</span>
                        <span className="block text-[10px] font-mono text-[#666] truncate">{t.slug}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )
            })
          )}
        </aside>

        {draft ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <input className={input} value={draft.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="Slug (used in code)">
                  <input
                    className={cn(input, 'font-mono')}
                    value={draft.slug}
                    placeholder="auto from name"
                    onChange={(e) => set('slug', e.target.value.toLowerCase())}
                  />
                </Field>
                <Field label="Type">
                  <select className={input} value={draft.kind} onChange={(e) => set('kind', e.target.value as Draft['kind'])}>
                    <option value="campaign">Campaign (blasts)</option>
                    <option value="transactional">Transactional (sent from code)</option>
                  </select>
                </Field>
                <Field label="Sender">
                  <select className={input} value={draft.sender_id || ''} onChange={(e) => set('sender_id', e.target.value || null)}>
                    {CRM_SENDERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email}
                      </option>
                    ))}
                  </select>
                </Field>
                {draft.kind === 'campaign' && (
                  <Field label="Default audience">
                    <select
                      className={input}
                      value={draft.default_audience || ''}
                      onChange={(e) => set('default_audience', e.target.value || null)}
                    >
                      <option value="">None</option>
                      <option value="loyalty">Loyalty members</option>
                      <option value="referrers">Referrers</option>
                      <option value="distributors">Distributor leads</option>
                      <option value="all">All contacts</option>
                      <option value="staff">Team (internal test)</option>
                    </select>
                  </Field>
                )}
              </div>
              <Field label="Subject">
                <input className={input} value={draft.subject} onChange={(e) => set('subject', e.target.value)} />
              </Field>
              <Field label="Preview text (optional)">
                <input className={input} value={draft.preheader || ''} onChange={(e) => set('preheader', e.target.value)} />
              </Field>
              <Field label="Body (blank line = new paragraph, **bold**, links auto-detected)">
                <textarea
                  className={cn(input, 'font-mono')}
                  rows={16}
                  value={draft.body}
                  onChange={(e) => set('body', e.target.value)}
                />
              </Field>
              <div className="text-[11px] text-[#666]">
                Merge tags: {MERGE_TAGS.map((m) => m.tag).join(' ')}
                {draft.kind === 'transactional' && ' — plus any custom {{tag}} you pass from code.'}
              </div>

              {error && <div className="text-sm text-red-400">{error}</div>}

              <div className="flex items-center justify-between pt-2">
                {draft.id ? (
                  <button onClick={archive} className="flex items-center gap-1.5 text-xs text-[#A0A0A0] hover:text-red-400">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-3">
                  {saved && <span className="text-xs text-green-400">Saved</span>}
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#B560FF] disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </div>

              {draft.kind === 'transactional' && draft.slug && (
                <pre className="text-[11px] text-[#A0A0A0] bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-3 overflow-x-auto">{`import { sendTemplateEmail } from '@/lib/email/templates'

await sendTemplateEmail('${draft.slug}', {
  to: customer.email,
  vars: { first_name: customer.firstName /* , ... */ },
})`}</pre>
              )}
            </section>

            <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
              <div className="text-xs text-[#A0A0A0] mb-2">
                Subject: <span className="text-white">{applyVariables(draft.subject, SAMPLE_VARS)}</span>
              </div>
              <iframe
                title="Template preview"
                srcDoc={preview}
                sandbox=""
                className="w-full h-[640px] rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]"
              />
            </section>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#2A2A2A] p-10 text-center text-sm text-[#A0A0A0]">
            Pick a template on the left or create a new one.
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#A0A0A0] mb-1.5">{label}</span>
      {children}
    </label>
  )
}
