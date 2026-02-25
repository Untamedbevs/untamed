'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  X,
  ChevronDown,
  Calendar,
  Tag,
  User,
  Loader2,
  Trash2,
  Edit3,
  GripVertical,
  Upload,
  Image as ImageIcon,
  Wand2,
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

const KANBAN_STATUSES = STATUSES.filter((s) => s.value !== 'archived')

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

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)

  const fetchIdeas = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterCategory) params.set('category', filterCategory)
    if (filterPriority) params.set('priority', filterPriority)
    if (search) params.set('search', search)

    const res = await fetch(`/api/admin/ideas?${params}`)
    const data = await res.json()
    setIdeas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterCategory, filterPriority, search])

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  async function updateIdeaStatus(id: string, status: string) {
    await fetch(`/api/admin/ideas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setIdeas((prev) =>
      prev.map((idea) => (idea.id === id ? { ...idea, status } : idea))
    )
  }

  async function deleteIdea(id: string) {
    if (!confirm('Delete this idea?')) return
    await fetch(`/api/admin/ideas/${id}`, { method: 'DELETE' })
    setIdeas((prev) => prev.filter((idea) => idea.id !== id))
  }

  function handleSaved() {
    setShowCreateModal(false)
    setEditingIdea(null)
    fetchIdeas()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#9B30FF] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ideas..."
              className="bg-[#141414] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors w-48"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9B30FF] transition-colors"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9B30FF] transition-colors"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#141414] border border-[#2A2A2A] rounded-xl overflow-hidden">
            <button
              onClick={() => setView('board')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                view === 'board' ? 'bg-[#9B30FF]/15 text-[#9B30FF]' : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                view === 'list' ? 'bg-[#9B30FF]/15 text-[#9B30FF]' : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white text-black font-semibold rounded-full px-4 py-2 text-sm flex items-center gap-2 hover:bg-[#9B30FF] hover:text-white transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            New Idea
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'board' ? (
        <KanbanBoard
          ideas={ideas}
          onStatusChange={updateIdeaStatus}
          onEdit={setEditingIdea}
          onDelete={deleteIdea}
        />
      ) : (
        <ListView
          ideas={ideas}
          onEdit={setEditingIdea}
          onDelete={deleteIdea}
          onStatusChange={updateIdeaStatus}
        />
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingIdea) && (
        <IdeaModal
          idea={editingIdea}
          onClose={() => {
            setShowCreateModal(false)
            setEditingIdea(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ─── Kanban Board ────────────────────────────────────────────────────────────

function KanbanBoard({
  ideas,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  ideas: Idea[]
  onStatusChange: (id: string, status: string) => void
  onEdit: (idea: Idea) => void
  onDelete: (id: string) => void
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null)

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault()
    if (draggedId) {
      onStatusChange(draggedId, status)
      setDraggedId(null)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_STATUSES.map((col) => {
        const columnIdeas = ideas.filter((i) => i.status === col.value)
        return (
          <div
            key={col.value}
            className="min-w-[280px] flex-1"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.value)}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[col.value] }}
              />
              <h3 className="text-sm font-semibold text-white">{col.label}</h3>
              <span className="text-xs text-[#666] ml-auto">{columnIdeas.length}</span>
            </div>
            <div className="space-y-3 min-h-[200px] bg-[#0D0D0D] rounded-2xl p-3 border border-[#1A1A1A]">
              {columnIdeas.map((idea) => (
                <div
                  key={idea.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idea.id)}
                  className={cn(
                    'bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-[#444] transition-all duration-200 group',
                    draggedId === idea.id && 'opacity-50'
                  )}
                >
                    <div className="flex items-start justify-between gap-2 mb-2">
                    <a
                      href={`/admin/ideas/${idea.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium text-white leading-tight hover:text-[#9B30FF] transition-colors"
                    >
                      {idea.title}
                    </a>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <a
                        href={`/admin/studio?concept=${encodeURIComponent(idea.title + (idea.description ? ' — ' + idea.description : ''))}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-[#666] hover:text-[#9B30FF] transition-colors"
                        title="Generate content in Studio"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => onEdit(idea)}
                        className="p-1 text-[#666] hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(idea.id)}
                        className="p-1 text-[#666] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {idea.description && (
                    <p className="text-xs text-[#A0A0A0] mb-3 line-clamp-2">{idea.description}</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[idea.category]}20`,
                        color: CATEGORY_COLORS[idea.category],
                      }}
                    >
                      {idea.category}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${PRIORITY_COLORS[idea.priority]}20`,
                        color: PRIORITY_COLORS[idea.priority],
                      }}
                    >
                      {idea.priority}
                    </span>
                    {idea.due_date && (
                      <span className="text-[10px] text-[#666] flex items-center gap-1 ml-auto">
                        <Calendar className="w-3 h-3" />
                        {new Date(idea.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {idea.assigned_to_staff && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-[#666]">
                      <User className="w-3 h-3" />
                      {idea.assigned_to_staff.full_name}
                    </div>
                  )}

                  {idea.idea_media?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {idea.idea_media.slice(0, 3).map((im) => (
                        <div key={im.id} className="w-8 h-8 rounded overflow-hidden border border-[#2A2A2A]">
                          <img src={im.media.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {idea.idea_media.length > 3 && (
                        <div className="w-8 h-8 rounded bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[10px] text-[#666]">
                          +{idea.idea_media.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── List View ───────────────────────────────────────────────────────────────

function ListView({
  ideas,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  ideas: Idea[]
  onEdit: (idea: Idea) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}) {
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2A2A]">
              <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Title</th>
              <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Category</th>
              <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Priority</th>
              <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Due Date</th>
              <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Assigned</th>
              <th className="text-right text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ideas.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-sm text-[#666] py-12">
                  No ideas found. Create your first one!
                </td>
              </tr>
            ) : (
              ideas.map((idea) => (
                <tr
                  key={idea.id}
                  className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <a href={`/admin/ideas/${idea.id}`} className="text-sm text-white font-medium hover:text-[#9B30FF] transition-colors">
                      {idea.title}
                    </a>
                    {idea.description && (
                      <p className="text-xs text-[#666] mt-0.5 line-clamp-1">{idea.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[idea.category]}20`,
                        color: CATEGORY_COLORS[idea.category],
                      }}
                    >
                      {idea.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={idea.status}
                      onChange={(e) => onStatusChange(idea.id, e.target.value)}
                      className="bg-transparent text-xs border border-[#2A2A2A] rounded-lg px-2 py-1 focus:outline-none"
                      style={{ color: STATUS_COLORS[idea.status] }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: `${PRIORITY_COLORS[idea.priority]}20`,
                        color: PRIORITY_COLORS[idea.priority],
                      }}
                    >
                      {idea.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#A0A0A0]">
                    {idea.due_date
                      ? new Date(idea.due_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#A0A0A0]">
                    {idea.assigned_to_staff?.full_name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(idea)}
                        className="p-1.5 text-[#666] hover:text-white transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(idea.id)}
                        className="p-1.5 text-[#666] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Create/Edit Modal ───────────────────────────────────────────────────────

function IdeaModal({
  idea,
  onClose,
  onSaved,
}: {
  idea: Idea | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!idea
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [mediaIds, setMediaIds] = useState<string[]>(
    idea?.idea_media?.sort((a, b) => a.sort_order - b.sort_order).map((im) => im.media.id) ?? []
  )
  const [mediaPreviews, setMediaPreviews] = useState<{ id: string; url: string; filename: string }[]>(
    idea?.idea_media?.sort((a, b) => a.sort_order - b.sort_order).map((im) => ({
      id: im.media.id,
      url: im.media.url,
      filename: im.media.filename,
    })) ?? []
  )
  const [form, setForm] = useState({
    title: idea?.title ?? '',
    description: idea?.description ?? '',
    category: idea?.category ?? 'social',
    status: idea?.status ?? 'idea',
    priority: idea?.priority ?? 'medium',
    tags: idea?.tags?.join(', ') ?? '',
    notes: idea?.notes ?? '',
    due_date: idea?.due_date ?? '',
  })

  async function handleImageUpload(files: FileList) {
    setUploadingImages(true)
    const folder = isEditing ? `/ideas/${idea.id}` : '/ideas/drafts'

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

  function removeMedia(id: string) {
    setMediaIds((prev) => prev.filter((mid) => mid !== id))
    setMediaPreviews((prev) => prev.filter((m) => m.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      ...form,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      description: form.description || null,
      notes: form.notes || null,
      due_date: form.due_date || null,
      media_ids: mediaIds,
    }

    const url = isEditing ? `/api/admin/ideas/${idea.id}` : '/api/admin/ideas'
    const method = isEditing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#2A2A2A]">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Idea' : 'New Idea'}
          </h2>
          <button onClick={onClose} className="text-[#666] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
              placeholder="What's the idea?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none"
              placeholder="Describe the idea..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#9B30FF] transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#9B30FF] transition-colors"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#9B30FF] transition-colors"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#9B30FF] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">
              Tags <span className="text-[#666]">(comma separated)</span>
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
              placeholder="launch, summer, promo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none"
              placeholder="Additional notes..."
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-2">Images</label>
            {mediaPreviews.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {mediaPreviews.map((m) => (
                  <div key={m.id} className="relative group">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-[#2A2A2A]">
                      <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedia(m.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] border border-dashed border-[#2A2A2A] rounded-xl cursor-pointer hover:border-[#9B30FF] transition-colors">
              {uploadingImages ? (
                <Loader2 className="w-4 h-4 text-[#9B30FF] animate-spin" />
              ) : (
                <Upload className="w-4 h-4 text-[#666]" />
              )}
              <span className="text-sm text-[#A0A0A0]">
                {uploadingImages ? 'Uploading...' : 'Upload images'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                disabled={uploadingImages}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A] rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImages}
              className="px-6 py-2 text-sm bg-white text-black font-semibold rounded-full hover:bg-[#9B30FF] hover:text-white transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
