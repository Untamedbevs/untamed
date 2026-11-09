'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Monitor,
  Smartphone,
  Send,
  Tag,
} from 'lucide-react'
import {
  BLOCK_TYPES,
  FLOW_MERGE_TAGS,
  MERGE_TAGS,
  type EmailBlock,
} from '@/lib/email/blocks'
import { cn } from '@/lib/utils'

export interface EmailContent {
  subject: string
  preheader: string
  blocks: EmailBlock[]
}

export interface ContentChecks {
  errors: string[]
  warnings: string[]
}

const input =
  'w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60'

function newBlock(type: EmailBlock['type']): EmailBlock {
  switch (type) {
    case 'heading': return { type, text: '' }
    case 'text': return { type, text: '' }
    case 'button': return { type, label: '', url: 'https://untamedbeverages.com/shop' }
    case 'image': return { type, url: '', alt: '' }
    case 'spacer': return { type, height: 16 }
    default: return { type } as EmailBlock
  }
}

export function ContentEditor({
  value,
  onChange,
  kind = 'marketing',
  listName,
  flowTags = false,
  onChecks,
}: {
  value: EmailContent
  onChange: (next: EmailContent) => void
  kind?: 'marketing' | 'transactional'
  listName?: string
  /** Show the merge tags that only flows fill (points, reward, order items). */
  flowTags?: boolean
  onChecks?: (checks: ContentChecks) => void
}) {
  const [preview, setPreview] = useState<{ html: string; checks: ContentChecks } | null>(null)
  const [loading, setLoading] = useState(false)
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')
  const [testState, setTestState] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const focused = useRef<{ index: number; field: string; el: HTMLInputElement | HTMLTextAreaElement } | null>(null)
  const onChecksRef = useRef(onChecks)
  onChecksRef.current = onChecks

  // Re-render only when the content itself changes, not on every parent render.
  const renderKey = JSON.stringify({ ...value, kind, listName })
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/crm/email/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: renderKey,
        })
        const json = await res.json()
        if (cancelled) return
        if (res.ok) {
          setPreview({ html: json.html, checks: json.checks })
          onChecksRef.current?.(json.checks)
        } else {
          setPreview({ html: '', checks: { errors: [json.error || 'Preview failed'], warnings: [] } })
        }
      } catch {
        if (!cancelled) setPreview({ html: '', checks: { errors: ['Preview failed'], warnings: [] } })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [renderKey])

  const setBlocks = (blocks: EmailBlock[]) => onChange({ ...value, blocks })
  const updateBlock = (i: number, patch: Partial<EmailBlock>) =>
    setBlocks(value.blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as EmailBlock) : b)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.blocks.length) return
    const next = [...value.blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
  }

  const tags = flowTags ? [...MERGE_TAGS, ...FLOW_MERGE_TAGS] : MERGE_TAGS
  function insertTag(tag: string) {
    const f = focused.current
    if (!f) return
    const el = f.el
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const nextValue = el.value.slice(0, start) + tag + el.value.slice(end)
    if (f.index === -1) onChange({ ...value, [f.field]: nextValue })
    else updateBlock(f.index, { [f.field]: nextValue } as Partial<EmailBlock>)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    })
  }
  const track = (index: number, field: string) => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      focused.current = { index, field, el: e.currentTarget }
    },
  })

  async function testSend() {
    setTestState('sending')
    try {
      const res = await fetch('/api/admin/crm/email/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...value, listName }),
      })
      const json = await res.json()
      setTestState(res.ok ? `Test sent to ${json.sentTo}` : json.error || 'Test send failed')
    } catch {
      setTestState('Test send failed')
    }
  }

  const checks = preview?.checks

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="space-y-3 min-w-0">
        <div>
          <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">Subject</label>
          <input className={input} value={value.subject} onChange={(e) => onChange({ ...value, subject: e.target.value })} {...track(-1, 'subject')} placeholder="Subject line" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">Preheader (inbox preview text)</label>
          <input className={input} value={value.preheader} onChange={(e) => onChange({ ...value, preheader: e.target.value })} {...track(-1, 'preheader')} placeholder="One line shown after the subject" />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Tag className="w-3 h-3 text-[#666]" />
          {tags.map((t) => (
            <button
              key={t.tag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertTag(t.tag)}
              title={t.label}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#A0A0A0] hover:bg-[#9B30FF]/10 hover:text-[#9B30FF] font-mono"
            >
              {t.tag}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {value.blocks.map((block, i) => (
            <div key={i} className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-[#666]">
                  {BLOCK_TYPES.find((t) => t.type === block.type)?.label || block.type}
                </span>
                <div className="flex items-center gap-1">
                  <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-3.5 h-3.5" /></IconButton>
                  <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === value.blocks.length - 1}><ArrowDown className="w-3.5 h-3.5" /></IconButton>
                  <IconButton label="Remove block" onClick={() => setBlocks(value.blocks.filter((_, j) => j !== i))} danger><Trash2 className="w-3.5 h-3.5" /></IconButton>
                </div>
              </div>
              {block.type === 'heading' && (
                <input className={input} value={block.text} onChange={(e) => updateBlock(i, { text: e.target.value })} {...track(i, 'text')} placeholder="Heading" />
              )}
              {block.type === 'text' && (
                <>
                  <textarea className={cn(input, 'font-mono')} rows={5} value={block.text} onChange={(e) => updateBlock(i, { text: e.target.value })} {...track(i, 'text')} placeholder="Text. Blank line = new paragraph. **bold**, [link](https://...)" />
                </>
              )}
              {block.type === 'button' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={input} value={block.label} onChange={(e) => updateBlock(i, { label: e.target.value })} {...track(i, 'label')} placeholder="Button label" />
                  <input className={input} value={block.url} onChange={(e) => updateBlock(i, { url: e.target.value })} {...track(i, 'url')} placeholder="https://..." />
                </div>
              )}
              {block.type === 'image' && (
                <div className="grid grid-cols-1 gap-2">
                  <input className={input} value={block.url} onChange={(e) => updateBlock(i, { url: e.target.value })} placeholder="Image URL (https://, e.g. from the Media library CDN)" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className={input} value={block.alt} onChange={(e) => updateBlock(i, { alt: e.target.value })} placeholder="Alt text (describe the image)" />
                    <input className={input} value={block.href || ''} onChange={(e) => updateBlock(i, { href: e.target.value })} placeholder="Link when clicked (optional)" />
                  </div>
                </div>
              )}
              {block.type === 'spacer' && (
                <input type="number" min={4} max={80} className={input} value={block.height ?? 16} onChange={(e) => updateBlock(i, { height: Number(e.target.value) })} />
              )}
              {block.type === 'rewards' && <p className="text-xs text-[#A0A0A0]">Lists the rewards catalog with point costs; marks the ones the reader can afford.</p>}
              {block.type === 'order_items' && <p className="text-xs text-[#A0A0A0]">Lists the items from the order that started the flow.</p>}
              {block.type === 'divider' && <p className="text-xs text-[#A0A0A0]">A thin line.</p>}
            </div>
          ))}

          {adding ? (
            <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-[#2A2A2A] p-3">
              {BLOCK_TYPES.filter((t) => flowTags || (t.type !== 'order_items')).map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    setBlocks([...value.blocks, newBlock(t.type)])
                    setAdding(false)
                  }}
                  className="text-xs px-2.5 py-1 rounded-full border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#9B30FF] hover:text-white"
                >
                  {t.label}
                </button>
              ))}
              <button type="button" onClick={() => setAdding(false)} className="text-xs px-2.5 py-1 text-[#666]">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2 text-xs text-[#9B30FF] hover:text-[#B560FF]">
              <Plus className="w-3.5 h-3.5" /> Add block
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-[#111] border border-[#2A2A2A] rounded-full p-1">
            {(['desktop', 'mobile'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                className={cn('flex items-center gap-1 px-2.5 py-1 text-xs rounded-full', width === w ? 'bg-[#9B30FF]/20 text-[#9B30FF]' : 'text-[#A0A0A0]')}
              >
                {w === 'desktop' ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />} {w}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={testSend}
            disabled={testState === 'sending' || value.blocks.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white disabled:opacity-40"
          >
            {testState === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send me a test
          </button>
        </div>
        {testState && testState !== 'sending' && <p className="text-xs text-[#A0A0A0]">{testState}</p>}

        <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] overflow-hidden flex justify-center">
          {preview?.html ? (
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={preview.html}
              className="bg-[#0A0A0A]"
              style={{ width: width === 'desktop' ? '100%' : 375, height: 560, border: 0 }}
            />
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-[#666]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Preview appears here'}
            </div>
          )}
        </div>

        {checks && (
          <div className="space-y-1.5">
            {checks.errors.map((e) => (
              <div key={e} className="text-xs text-red-400 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{e}</div>
            ))}
            {checks.warnings.map((w) => (
              <div key={w} className="text-xs text-amber-300 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}</div>
            ))}
            {checks.errors.length === 0 && checks.warnings.length === 0 && (
              <div className="text-xs text-[#9B30FF] flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Content checks passed</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn('p-1 rounded-md text-[#A0A0A0] disabled:opacity-30', danger ? 'hover:text-red-400 hover:bg-red-400/10' : 'hover:text-white hover:bg-[#1A1A1A]')}
    >
      {children}
    </button>
  )
}
