'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Loader2,
  Calendar,
  User,
  Tag,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface IdeaMedia {
  id: string
  sort_order: number
  media: { id: string; filename: string; url: string; file_type: string }
}

interface Idea {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  priority: string
  tags: string[]
  notes: string | null
  created_by: string | null
  assigned_to: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  created_by_staff: { full_name: string } | null
  assigned_to_staff: { full_name: string } | null
  idea_media: IdeaMedia[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'social', label: 'Social' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'product', label: 'Product' },
  { value: 'event', label: 'Event' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: 'idea', label: 'Idea' },
  { value: 'developing', label: 'Developing' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const CATEGORY_COLORS: Record<string, string> = {
  social: '#9B30FF',
  marketing: '#E87511',
  strategy: '#4A7C0F',
  product: '#D4D700',
  event: '#FF0040',
  partnership: '#00BFFF',
  other: '#666',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#666',
  medium: '#D4D700',
  high: '#E87511',
  urgent: '#FF0040',
}

const STATUS_COLORS: Record<string, string> = {
  idea: '#9B30FF',
  developing: '#E87511',
  ready: '#D4D700',
  in_progress: '#00BFFF',
  completed: '#4A7C0F',
  archived: '#666',
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function IdeaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [idea, setIdea] = useState<Idea | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'social',
    status: 'idea',
    priority: 'medium',
    tags: '',
    notes: '',
    due_date: '',
  })
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<{ id: string; url: string; filename: string }[]>([])

  const fetchIdea = useCallback(async () => {
    const res = await fetch(`/api/admin/ideas/${id}`)
    if (!res.ok) {
      router.push('/admin/ideas')
      return
    }
    const data: Idea = await res.json()
    setIdea(data)
    populateForm(data)
    setLoading(false)
  }, [id, router])

  function populateForm(data: Idea) {
    setForm({
      title: data.title,
      description: data.description ?? '',
      category: data.category,
      status: data.status,
      priority: data.priority,
      tags: data.tags?.join(', ') ?? '',
      notes: data.notes ?? '',
      due_date: data.due_date ?? '',
    })
    const sorted = [...(data.idea_media || [])].sort((a, b) => a.sort_order - b.sort_order)
    setMediaIds(sorted.map((im) => im.media.id))
    setMediaPreviews(sorted.map((im) => ({ id: im.media.id, url: im.media.url, filename: im.media.filename })))
  }

  useEffect(() => {
    fetchIdea()
  }, [fetchIdea])

  async function handleImageUpload(files: FileList) {
    setUploadingImages(true)
    const folder = `/ideas/${id}`

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)

      const res = await fetch('/api/admin/media', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setMediaIds((prev) => [...prev, data.id])
        setMediaPreviews((prev) => [...prev, { id: data.id, url: data.url, filename: data.filename }])
      }
    }
    setUploadingImages(false)
  }

  function removeMedia(mediaId: string) {
    setMediaIds((prev) => prev.filter((mid) => mid !== mediaId))
    setMediaPreviews((prev) => prev.filter((m) => m.id !== mediaId))
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      description: form.description || null,
      notes: form.notes || null,
      due_date: form.due_date || null,
      media_ids: mediaIds,
    }

    const res = await fetch(`/api/admin/ideas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setEditing(false)
      fetchIdea()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this idea permanently?')) return
    await fetch(`/api/admin/ideas/${id}`, { method: 'DELETE' })
    router.push('/admin/ideas')
  }

  function cancelEdit() {
    if (idea) populateForm(idea)
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#9B30FF] animate-spin" />
      </div>
    )
  }

  if (!idea) return null

  const images = mediaPreviews.filter(() => true)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/ideas')}
          className="flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Ideas
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A] rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingImages}
                className="px-4 py-2 text-sm bg-white text-black font-semibold rounded-full hover:bg-[#9B30FF] hover:text-white transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A] rounded-full transition-colors flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-full transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title & Status Bar */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        {editing ? (
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-lg font-semibold text-white focus:outline-none focus:border-[#9B30FF] transition-colors mb-4"
          />
        ) : (
          <h1 className="text-2xl font-bold text-white mb-4">{idea.title}</h1>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {editing ? (
            <>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9B30FF]"
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9B30FF]"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9B30FF]"
              >
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </>
          ) : (
            <>
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ backgroundColor: `${STATUS_COLORS[idea.status]}20`, color: STATUS_COLORS[idea.status] }}
              >
                {STATUSES.find((s) => s.value === idea.status)?.label}
              </span>
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ backgroundColor: `${CATEGORY_COLORS[idea.category]}20`, color: CATEGORY_COLORS[idea.category] }}
              >
                {idea.category}
              </span>
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ backgroundColor: `${PRIORITY_COLORS[idea.priority]}20`, color: PRIORITY_COLORS[idea.priority] }}
              >
                {idea.priority}
              </span>
            </>
          )}

          {idea.due_date && !editing && (
            <span className="text-xs text-[#A0A0A0] flex items-center gap-1 ml-auto">
              <Calendar className="w-3.5 h-3.5" />
              Due {new Date(idea.due_date).toLocaleDateString()}
            </span>
          )}
          {editing && (
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="ml-auto bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9B30FF]"
            />
          )}
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-[#666]">
          {idea.created_by_staff && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> Created by {idea.created_by_staff.full_name}
            </span>
          )}
          {idea.assigned_to_staff && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> Assigned to {idea.assigned_to_staff.full_name}
            </span>
          )}
          <span>Created {new Date(idea.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Description & Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Description</h3>
          {editing ? (
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none"
              placeholder="Describe the idea..."
            />
          ) : (
            <p className="text-sm text-[#A0A0A0] whitespace-pre-wrap">
              {idea.description || 'No description yet.'}
            </p>
          )}
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Notes</h3>
          {editing ? (
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={5}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none"
              placeholder="Additional notes..."
            />
          ) : (
            <p className="text-sm text-[#A0A0A0] whitespace-pre-wrap">
              {idea.notes || 'No notes yet.'}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Tags
        </h3>
        {editing ? (
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
            placeholder="launch, summer, promo"
          />
        ) : idea.tags?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {idea.tags.map((tag) => (
              <span key={tag} className="text-xs px-3 py-1 rounded-full bg-[#9B30FF]/10 text-[#9B30FF]">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#666]">No tags</p>
        )}
      </div>

      {/* Images */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Images ({images.length})</h3>
          {editing && (
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-white border border-[#2A2A2A] rounded-full cursor-pointer hover:border-[#9B30FF] transition-colors">
              {uploadingImages ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B30FF]" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Upload
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                disabled={uploadingImages}
              />
            </label>
          )}
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div key={img.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="w-full aspect-square rounded-xl overflow-hidden border border-[#2A2A2A] hover:border-[#9B30FF] transition-colors"
                >
                  <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => removeMedia(img.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#666] text-center py-8">No images attached</p>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({
  images,
  currentIndex,
  onChange,
  onClose,
}: {
  images: { id: string; url: string; filename: string }[]
  currentIndex: number
  onChange: (i: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && currentIndex > 0) onChange(currentIndex - 1)
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) onChange(currentIndex + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, images.length, onChange, onClose])

  const current = images[currentIndex]

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <span className="text-sm text-white/60">{currentIndex + 1} / {images.length}</span>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange(currentIndex - 1) }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange(currentIndex + 1) }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div className="max-w-5xl max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={current.url}
          alt={current.filename}
          className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
        />
        <p className="text-center text-sm text-white/50 mt-3">{current.filename}</p>
      </div>
    </div>
  )
}
