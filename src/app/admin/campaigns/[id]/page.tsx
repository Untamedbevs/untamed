'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Loader2,
  Clock,
  Hash,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLATFORMS, PLATFORMS_MAP } from '@/lib/constants/platforms'
import { format } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignMediaItem {
  id: string
  sort_order: number
  platform_variant: string | null
  media: { id: string; filename: string; url: string; file_type: string; mime_type: string | null }
}

interface Campaign {
  id: string
  title: string
  description: string | null
  status: string
  category: string | null
  platforms: string[]
  scheduled_date: string | null
  posted_date: string | null
  caption: string | null
  hashtags: string[]
  idea_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  created_by_staff: { full_name: string } | null
  idea: { id: string; title: string } | null
  campaign_media: CampaignMediaItem[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'posted', label: 'Posted' },
  { value: 'archived', label: 'Archived' },
]

const CATEGORY_OPTIONS = [
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'event', label: 'Event' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'other', label: 'Other' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: '#666',
  scheduled: '#D4D700',
  posted: '#4A7C0F',
  archived: '#A0A0A0',
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'draft',
    category: '',
    platforms: [] as string[],
    scheduled_date: '',
    caption: '',
    hashtags: '',
  })
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<{ id: string; url: string; filename: string }[]>([])

  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/admin/campaigns/${id}`)
    if (!res.ok) {
      router.push('/admin/campaigns')
      return
    }
    const data: Campaign = await res.json()
    setCampaign(data)
    populateForm(data)
    setLoading(false)
  }, [id, router])

  function populateForm(data: Campaign) {
    setForm({
      title: data.title,
      description: data.description ?? '',
      status: data.status,
      category: data.category ?? '',
      platforms: data.platforms ?? [],
      scheduled_date: data.scheduled_date
        ? format(new Date(data.scheduled_date), "yyyy-MM-dd'T'HH:mm")
        : '',
      caption: data.caption ?? '',
      hashtags: data.hashtags?.join(', ') ?? '',
    })
    const sorted = [...(data.campaign_media || [])].sort((a, b) => a.sort_order - b.sort_order)
    setMediaIds(sorted.map((cm) => cm.media.id))
    setMediaPreviews(sorted.map((cm) => ({ id: cm.media.id, url: cm.media.url, filename: cm.media.filename })))
  }

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  function togglePlatform(platformId: string) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter((p) => p !== platformId)
        : [...prev.platforms, platformId],
    }))
  }

  async function handleImageUpload(files: FileList) {
    setUploadingImages(true)
    const folder = `/campaigns/${id}`

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
      hashtags: form.hashtags
        ? form.hashtags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)
        : [],
      description: form.description || null,
      category: form.category || null,
      caption: form.caption || null,
      scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null,
      media_ids: mediaIds,
    }

    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setEditing(false)
      fetchCampaign()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this campaign permanently?')) return
    await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' })
    router.push('/admin/campaigns')
  }

  function cancelEdit() {
    if (campaign) populateForm(campaign)
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#4A7C0F] animate-spin" />
      </div>
    )
  }

  if (!campaign) return null

  const images = mediaPreviews

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/campaigns')}
          className="flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={cancelEdit} className="px-4 py-2 text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A] rounded-full transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingImages}
                className="px-4 py-2 text-sm bg-white text-black font-semibold rounded-full hover:bg-[#4A7C0F] hover:text-white transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
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

      {/* Title & Status */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        {editing ? (
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-lg font-semibold text-white focus:outline-none focus:border-[#4A7C0F] transition-colors mb-4"
          />
        ) : (
          <h1 className="text-2xl font-bold text-white mb-4">{campaign.title}</h1>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {editing ? (
            <>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#4A7C0F]"
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#4A7C0F]"
              >
                <option value="">No Category</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </>
          ) : (
            <>
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ backgroundColor: `${STATUS_COLORS[campaign.status]}20`, color: STATUS_COLORS[campaign.status] }}
              >
                {STATUS_OPTIONS.find((s) => s.value === campaign.status)?.label}
              </span>
              {campaign.category && (
                <span className="text-xs px-3 py-1 rounded-full bg-[#1A1A1A] text-[#A0A0A0]">
                  {CATEGORY_OPTIONS.find((c) => c.value === campaign.category)?.label}
                </span>
              )}
            </>
          )}

          {campaign.scheduled_date && !editing && (
            <span className="text-xs text-[#A0A0A0] flex items-center gap-1 ml-auto">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(campaign.scheduled_date), 'MMM d, yyyy h:mm a')}
            </span>
          )}
          {editing && (
            <input
              type="datetime-local"
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              className="ml-auto bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#4A7C0F]"
            />
          )}
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-[#666]">
          {campaign.created_by_staff && (
            <span>Created by {campaign.created_by_staff.full_name}</span>
          )}
          <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
          {campaign.idea && (
            <button
              onClick={() => router.push(`/admin/ideas/${campaign.idea!.id}`)}
              className="text-[#9B30FF] hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Linked Idea: {campaign.idea.title}
            </button>
          )}
        </div>
      </div>

      {/* Platforms */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3">Platforms</h3>
        {editing ? (
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon
              const selected = form.platforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200',
                    selected
                      ? 'border-[#4A7C0F] bg-[#4A7C0F]/15 text-[#6B8E23]'
                      : 'border-[#2A2A2A] text-[#A0A0A0] hover:border-[#444]'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.name}
                  {selected && <Check className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
        ) : campaign.platforms.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {campaign.platforms.map((pId) => {
              const p = PLATFORMS_MAP[pId]
              if (!p) return null
              const Icon = p.icon
              return (
                <a
                  key={pId}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white hover:border-[#444] transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.name}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-[#666]">No platforms selected</p>
        )}
      </div>

      {/* Caption & Description */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Caption</h3>
          {editing ? (
            <textarea
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              rows={5}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors resize-none"
              placeholder="Post caption..."
            />
          ) : (
            <p className="text-sm text-[#A0A0A0] whitespace-pre-wrap">
              {campaign.caption || 'No caption yet.'}
            </p>
          )}
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Description</h3>
          {editing ? (
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors resize-none"
              placeholder="Internal notes..."
            />
          ) : (
            <p className="text-sm text-[#A0A0A0] whitespace-pre-wrap">
              {campaign.description || 'No description yet.'}
            </p>
          )}
        </div>
      </div>

      {/* Hashtags */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Hash className="w-4 h-4" />
          Hashtags
        </h3>
        {editing ? (
          <input
            type="text"
            value={form.hashtags}
            onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors"
            placeholder="untamedbevs, cocktails, mixology"
          />
        ) : campaign.hashtags?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {campaign.hashtags.map((tag) => (
              <span key={tag} className="text-xs px-3 py-1 rounded-full bg-[#4A7C0F]/10 text-[#6B8E23]">
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#666]">No hashtags</p>
        )}
      </div>

      {/* Images */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Media ({images.length})</h3>
          {editing && (
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-white border border-[#2A2A2A] rounded-full cursor-pointer hover:border-[#4A7C0F] transition-colors">
              {uploadingImages ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4A7C0F]" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Upload
              <input
                type="file"
                multiple
                accept="image/*,video/*"
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
                  className="w-full aspect-square rounded-xl overflow-hidden border border-[#2A2A2A] hover:border-[#4A7C0F] transition-colors"
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
          <p className="text-sm text-[#666] text-center py-8">No media attached</p>
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
