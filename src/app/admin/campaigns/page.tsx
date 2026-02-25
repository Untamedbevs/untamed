'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  List,
  CalendarDays,
  Search,
  X,
  Trash2,
  Edit3,
  ExternalLink,
  Loader2,
  Clock,
  Hash,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  Upload,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLATFORMS, PLATFORMS_MAP } from '@/lib/constants/platforms'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignMedia {
  id: string
  sort_order: number
  platform_variant: string | null
  media: {
    id: string
    filename: string
    url: string
    file_type: string
    mime_type: string | null
  }
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
  campaign_media: CampaignMedia[]
}

interface MediaOption {
  id: string
  filename: string
  url: string
  file_type: string
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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  const fetchCampaigns = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (search) params.set('search', search)

    const res = await fetch(`/api/admin/campaigns?${params}`)
    const data = await res.json()
    setCampaigns(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterStatus, search])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign?')) return
    await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
  }

  function handleSaved() {
    setShowCreateModal(false)
    setEditingCampaign(null)
    fetchCampaigns()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#4A7C0F] animate-spin" />
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
              placeholder="Search campaigns..."
              className="bg-[#141414] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors w-48"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4A7C0F] transition-colors"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#141414] border border-[#2A2A2A] rounded-xl overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                view === 'list' ? 'bg-[#4A7C0F]/15 text-[#6B8E23]' : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                view === 'calendar' ? 'bg-[#4A7C0F]/15 text-[#6B8E23]' : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white text-black font-semibold rounded-full px-4 py-2 text-sm flex items-center gap-2 hover:bg-[#4A7C0F] hover:text-white transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Platform quick links */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {PLATFORMS.map((p) => {
          const Icon = p.icon
          return (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#141414] border border-[#2A2A2A] rounded-full px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-white hover:border-[#444] transition-all shrink-0"
            >
              <Icon className="w-3.5 h-3.5" />
              {p.name}
              <ExternalLink className="w-3 h-3" />
            </a>
          )
        })}
      </div>

      {/* Content */}
      {view === 'list' ? (
        <CampaignList
          campaigns={campaigns}
          onEdit={setEditingCampaign}
          onDelete={deleteCampaign}
        />
      ) : (
        <CampaignCalendar
          campaigns={campaigns}
          onEdit={setEditingCampaign}
        />
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCampaign) && (
        <CampaignModal
          campaign={editingCampaign}
          onClose={() => {
            setShowCreateModal(false)
            setEditingCampaign(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ─── Campaign List ───────────────────────────────────────────────────────────

function CampaignList({
  campaigns,
  onEdit,
  onDelete,
}: {
  campaigns: Campaign[]
  onEdit: (c: Campaign) => void
  onDelete: (id: string) => void
}) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[#666]">No campaigns yet. Plan your first post!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 hover:border-[#444] transition-all duration-200 group"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <a href={`/admin/campaigns/${campaign.id}`} className="text-base font-semibold text-white truncate hover:text-[#6B8E23] transition-colors">
                  {campaign.title}
                </a>
                <span
                  className="text-xs px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: `${STATUS_COLORS[campaign.status]}20`,
                    color: STATUS_COLORS[campaign.status],
                  }}
                >
                  {campaign.status}
                </span>
                {campaign.category && (
                  <span className="text-xs text-[#666] shrink-0">
                    {CATEGORY_OPTIONS.find((c) => c.value === campaign.category)?.label}
                  </span>
                )}
              </div>

              {campaign.caption && (
                <p className="text-sm text-[#A0A0A0] mb-3 line-clamp-2">{campaign.caption}</p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                {/* Platforms */}
                <div className="flex items-center gap-1.5">
                  {campaign.platforms.map((pId) => {
                    const p = PLATFORMS_MAP[pId]
                    if (!p) return null
                    const Icon = p.icon
                    return (
                      <div
                        key={pId}
                        className="w-6 h-6 rounded-full bg-[#1A1A1A] flex items-center justify-center"
                        title={p.name}
                      >
                        <Icon className="w-3 h-3 text-[#A0A0A0]" />
                      </div>
                    )
                  })}
                </div>

                {/* Schedule */}
                {campaign.scheduled_date && (
                  <span className="text-xs text-[#666] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(campaign.scheduled_date), 'MMM d, yyyy h:mm a')}
                  </span>
                )}

                {/* Hashtags */}
                {campaign.hashtags.length > 0 && (
                  <span className="text-xs text-[#666] flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {campaign.hashtags.slice(0, 3).join(', ')}
                    {campaign.hashtags.length > 3 && ` +${campaign.hashtags.length - 3}`}
                  </span>
                )}

                {/* Media count */}
                {campaign.campaign_media?.length > 0 && (
                  <span className="text-xs text-[#666] flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {campaign.campaign_media.length} file{campaign.campaign_media.length !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Linked idea */}
                {campaign.idea && (
                  <span className="text-xs text-[#9B30FF]">
                    Idea: {campaign.idea.title}
                  </span>
                )}
              </div>
            </div>

            {/* Media thumbnails */}
            {campaign.campaign_media?.length > 0 && (
              <div className="flex -space-x-2 shrink-0">
                {campaign.campaign_media.slice(0, 3).map((cm) => (
                  <div
                    key={cm.id}
                    className="w-12 h-12 rounded-lg border-2 border-[#141414] overflow-hidden"
                  >
                    {cm.media.file_type === 'image' ? (
                      <img src={cm.media.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#0A0A0A] flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-[#666]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(campaign)}
                className="p-2 text-[#666] hover:text-white transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(campaign.id)}
                className="p-2 text-[#666] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Calendar View ───────────────────────────────────────────────────────────

function CampaignCalendar({
  campaigns,
  onEdit,
}: {
  campaigns: Campaign[]
  onEdit: (c: Campaign) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const startDayOfWeek = getDay(monthStart)
  const emptyDays = Array.from({ length: startDayOfWeek })

  const scheduledCampaigns = campaigns.filter((c) => c.scheduled_date || c.posted_date)

  function getCampaignsForDay(day: Date) {
    return scheduledCampaigns.filter((c) => {
      const date = c.scheduled_date || c.posted_date
      return date && isSameDay(new Date(date), day)
    })
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 text-[#666] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 text-[#666] hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-[#666] py-2 border-b border-[#1A1A1A]">
            {d}
          </div>
        ))}

        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-[#1A1A1A] bg-[#0D0D0D]" />
        ))}

        {days.map((day) => {
          const dayCampaigns = getCampaignsForDay(day)
          const isToday = isSameDay(day, new Date())
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[100px] border-b border-r border-[#1A1A1A] p-1.5',
                isToday && 'bg-[#9B30FF]/5'
              )}
            >
              <span
                className={cn(
                  'text-xs',
                  isToday
                    ? 'text-[#9B30FF] font-bold'
                    : 'text-[#A0A0A0]'
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-1">
                {dayCampaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onEdit(c)}
                    className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-colors"
                    style={{
                      backgroundColor: `${STATUS_COLORS[c.status]}20`,
                      color: STATUS_COLORS[c.status],
                    }}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Create/Edit Modal ───────────────────────────────────────────────────────

function CampaignModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!campaign
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [allMedia, setAllMedia] = useState<MediaOption[]>([])
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(
    campaign?.campaign_media?.sort((a, b) => a.sort_order - b.sort_order).map((cm) => cm.media.id) ?? []
  )
  const [uploadedPreviews, setUploadedPreviews] = useState<MediaOption[]>(
    campaign?.campaign_media?.sort((a, b) => a.sort_order - b.sort_order).map((cm) => ({
      id: cm.media.id,
      url: cm.media.url,
      filename: cm.media.filename,
      file_type: cm.media.file_type,
    })) ?? []
  )
  const [showMediaPicker, setShowMediaPicker] = useState(false)

  const [form, setForm] = useState({
    title: campaign?.title ?? '',
    description: campaign?.description ?? '',
    status: campaign?.status ?? 'draft',
    category: campaign?.category ?? '',
    platforms: campaign?.platforms ?? [],
    scheduled_date: campaign?.scheduled_date
      ? format(new Date(campaign.scheduled_date), "yyyy-MM-dd'T'HH:mm")
      : '',
    caption: campaign?.caption ?? '',
    hashtags: campaign?.hashtags?.join(', ') ?? '',
  })

  useEffect(() => {
    fetch('/api/admin/media')
      .then((r) => r.json())
      .then((data) => setAllMedia(Array.isArray(data) ? data : []))
  }, [])

  function togglePlatform(platformId: string) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter((p) => p !== platformId)
        : [...prev.platforms, platformId],
    }))
  }

  function toggleMedia(mediaId: string) {
    setSelectedMediaIds((prev) =>
      prev.includes(mediaId)
        ? prev.filter((id) => id !== mediaId)
        : [...prev, mediaId]
    )
  }

  function removeMedia(mediaId: string) {
    setSelectedMediaIds((prev) => prev.filter((id) => id !== mediaId))
    setUploadedPreviews((prev) => prev.filter((m) => m.id !== mediaId))
  }

  async function handleImageUpload(files: FileList) {
    setUploadingImages(true)
    const folder = isEditing ? `/campaigns/${campaign.id}` : '/campaigns/drafts'

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)

      const res = await fetch('/api/admin/media', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setSelectedMediaIds((prev) => [...prev, data.id])
        setUploadedPreviews((prev) => [...prev, { id: data.id, url: data.url, filename: data.filename, file_type: data.file_type }])
        setAllMedia((prev) => [data, ...prev])
      }
    }
    setUploadingImages(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      media_ids: selectedMediaIds,
    }

    const url = isEditing ? `/api/admin/campaigns/${campaign.id}` : '/api/admin/campaigns'
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
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#2A2A2A]">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Campaign' : 'New Campaign'}
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
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors"
              placeholder="Campaign title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Caption</label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors resize-none"
              placeholder="Post caption..."
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-2">Platforms</label>
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
                        : 'border-[#2A2A2A] text-[#A0A0A0] hover:border-[#444] hover:text-white'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {p.name}
                    {selected && <Check className="w-3 h-3" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4A7C0F] transition-colors"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4A7C0F] transition-colors"
              >
                <option value="">None</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Scheduled</label>
              <input
                type="datetime-local"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4A7C0F] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors resize-none"
              placeholder="Internal notes about this campaign..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">
              Hashtags <span className="text-[#666]">(comma separated)</span>
            </label>
            <input
              type="text"
              value={form.hashtags}
              onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4A7C0F] transition-colors"
              placeholder="untamedbevs, cocktails, mixology"
            />
          </div>

          {/* Media Attachment */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[#A0A0A0]">Media</label>
              <div className="flex items-center gap-3">
                <a
                  href={`/admin/studio?concept=${encodeURIComponent(form.title + (form.caption ? ' — ' + form.caption : ''))}`}
                  className="text-xs text-[#9B30FF] hover:text-[#BF5FFF] transition-colors flex items-center gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  Generate in Studio
                </a>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(!showMediaPicker)}
                  className="text-xs text-[#4A7C0F] hover:text-[#6B8E23] transition-colors"
                >
                  {showMediaPicker ? 'Hide library' : 'Pick from library'}
                </button>
              </div>
            </div>

            {/* Selected media preview */}
            {uploadedPreviews.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {uploadedPreviews.map((m) => (
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

            {/* Upload button */}
            <label className="flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] border border-dashed border-[#2A2A2A] rounded-xl cursor-pointer hover:border-[#4A7C0F] transition-colors mb-3">
              {uploadingImages ? (
                <Loader2 className="w-4 h-4 text-[#4A7C0F] animate-spin" />
              ) : (
                <Upload className="w-4 h-4 text-[#666]" />
              )}
              <span className="text-sm text-[#A0A0A0]">
                {uploadingImages ? 'Uploading...' : 'Upload images'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                disabled={uploadingImages}
              />
            </label>

            {/* Media picker from library */}
            {showMediaPicker && (
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 max-h-[200px] overflow-y-auto">
                {allMedia.length === 0 ? (
                  <p className="text-xs text-[#666] text-center py-4">No media uploaded yet</p>
                ) : (
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                    {allMedia.map((m) => {
                      const selected = selectedMediaIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            toggleMedia(m.id)
                            if (!selected) {
                              setUploadedPreviews((prev) =>
                                prev.some((p) => p.id === m.id) ? prev : [...prev, m]
                              )
                            } else {
                              setUploadedPreviews((prev) => prev.filter((p) => p.id !== m.id))
                            }
                          }}
                          className={cn(
                            'aspect-square rounded-lg overflow-hidden border-2 transition-all',
                            selected
                              ? 'border-[#4A7C0F] ring-1 ring-[#4A7C0F]'
                              : 'border-transparent hover:border-[#444]'
                          )}
                        >
                          <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
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
              className="px-6 py-2 text-sm bg-white text-black font-semibold rounded-full hover:bg-[#4A7C0F] hover:text-white transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
