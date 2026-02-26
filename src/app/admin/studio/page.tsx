'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Wand2,
  Loader2,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Image as ImageIcon,
  Film,
  Edit3,
  Play,
  Download,
  Megaphone,
  Trash2,
  Eye,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLATFORMS } from '@/lib/constants/platforms'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string
  filename: string
  url: string
  file_type: string
  mime_type?: string | null
}

interface FlowPost {
  id: string
  flow_id: string
  sort_order: number
  concept: string
  prompt: string
  generation_mode: 'generate' | 'edit' | 'video'
  target_size: string
  reference_media_id: string | null
  generated_media_id: string | null
  status: 'pending' | 'generating' | 'complete' | 'approved' | 'rejected'
  fal_model: string | null
  generation_metadata: Record<string, unknown> | null
  reference_media?: MediaItem | null
  generated_media?: MediaItem | null
}

interface Flow {
  id: string
  title: string
  concept: string | null
  status: string
  platform_targets: string[]
  campaign_id: string | null
  flow_posts: FlowPost[]
}

interface PlannedPost {
  sort_order: number
  concept: string
  prompt: string
  generation_mode: 'generate' | 'edit' | 'video'
  target_size: string
  caption_suggestion: string
  hashtag_suggestions: string[]
}

type Phase = 'plan' | 'generate' | 'review'

// ─── Constants ───────────────────────────────────────────────────────────────

const SIZE_OPTIONS = [
  { value: 'square_1_1', label: '1:1 Square', desc: 'Instagram Feed' },
  { value: 'landscape_16_9', label: '16:9 Landscape', desc: 'YouTube / X' },
  { value: 'portrait_9_16', label: '9:16 Portrait', desc: 'Reels / TikTok' },
  { value: 'story_4_5', label: '4:5 Story', desc: 'Instagram Post' },
]

const MODE_OPTIONS = [
  { value: 'generate', label: 'Generate', icon: Sparkles, desc: 'From scratch' },
  { value: 'edit', label: 'Edit', icon: Edit3, desc: 'From reference' },
  { value: 'video', label: 'Video', icon: Film, desc: 'Animated clip' },
]

const AI_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'Fast', price: '$0.30' },
  { value: 'xai/grok-4.1-fast-non-reasoning', label: 'Grok 4.1 Fast', tier: 'Fast', price: '$0.20' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', tier: 'Fast', price: '$0.25' },
  { value: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2', tier: 'Fast', price: '$0.26' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', tier: 'Quality', price: '$3.00' },
  { value: 'openai/gpt-5', label: 'GPT-5', tier: 'Quality', price: '$1.25' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: 'Quality', price: '$1.25' },
  { value: 'xai/grok-4', label: 'Grok 4', tier: 'Quality', price: '$3.00' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2', tier: 'Premium', price: '$1.75' },
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', tier: 'Premium', price: '$5.00' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', tier: 'Premium', price: '$2.00' },
]

const TIER_COLORS: Record<string, string> = {
  Fast: 'text-[#4A7C0F]',
  Quality: 'text-[#E87511]',
  Premium: 'text-[#9B30FF]',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-[#666]/10', text: 'text-[#666]' },
  generating: { bg: 'bg-[#E87511]/10', text: 'text-[#E87511]' },
  complete: { bg: 'bg-[#00BFFF]/10', text: 'text-[#00BFFF]' },
  approved: { bg: 'bg-[#4A7C0F]/10', text: 'text-[#4A7C0F]' },
  rejected: { bg: 'bg-[#FF0040]/10', text: 'text-[#FF0040]' },
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-[#666] text-sm">Loading studio...</div>}>
      <StudioContent />
    </Suspense>
  )
}

function StudioContent() {
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('plan')
  const [flow, setFlow] = useState<Flow | null>(null)

  // Plan phase state
  const [concept, setConcept] = useState('')
  const [postCount, setPostCount] = useState(8)
  const [contentMix, setContentMix] = useState<'images' | 'mixed'>('images')
  const [platformTargets, setPlatformTargets] = useState<string[]>(['instagram'])
  const [aiModel, setAiModel] = useState('google/gemini-2.5-flash')
  const [plannedPosts, setPlannedPosts] = useState<PlannedPost[]>([])
  const [planLoading, setPlanLoading] = useState(false)

  // Reference media
  const [libraryMedia, setLibraryMedia] = useState<MediaItem[]>([])
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [showMediaPicker, setShowMediaPicker] = useState(false)

  // Generate phase state
  const [generatingPostId, setGeneratingPostId] = useState<string | null>(null)

  // Review phase state
  const [previewPost, setPreviewPost] = useState<FlowPost | null>(null)

  // Load from URL params (linked from ideas/campaigns)
  useEffect(() => {
    const fromConcept = searchParams.get('concept')
    const fromPrompt = searchParams.get('prompt')
    if (fromConcept) setConcept(fromConcept)
    else if (fromPrompt) setConcept(fromPrompt)
  }, [searchParams])

  useEffect(() => {
    fetch('/api/admin/media?file_type=image')
      .then((r) => r.json())
      .then((data) => setLibraryMedia(Array.isArray(data) ? data : []))
  }, [])

  // ─── Plan Phase Handlers ─────────────────────────────────────────────────

  async function generatePlan() {
    if (!concept.trim()) return
    setPlanLoading(true)

    try {
      const refUrls = libraryMedia
        .filter((m) => selectedRefs.includes(m.id))
        .map((m) => m.url)

      const res = await fetch('/api/admin/generate/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept,
          reference_media_urls: refUrls,
          platform_targets: platformTargets,
          post_count: postCount,
          content_mix: contentMix,
          model: aiModel,
        }),
      })

      if (!res.ok) throw new Error('Plan generation failed')

      const data = await res.json()
      let posts: PlannedPost[] = data.posts || []

      if (contentMix === 'images') {
        posts = posts.map((p) => ({
          ...p,
          generation_mode: p.generation_mode === 'video' ? 'generate' : p.generation_mode,
        }))
      }

      setPlannedPosts(posts)
    } catch (err) {
      console.error(err)
    } finally {
      setPlanLoading(false)
    }
  }

  async function savePlanAndAdvance() {
    if (plannedPosts.length === 0) return

    const res = await fetch('/api/admin/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: concept.slice(0, 80),
        concept,
        status: 'generating',
        platform_targets: platformTargets,
      }),
    })

    if (!res.ok) return
    const flowData = await res.json()

    const postsPayload = plannedPosts.map((p) => ({
      sort_order: p.sort_order,
      concept: p.concept,
      prompt: p.prompt,
      generation_mode: p.generation_mode,
      target_size: p.target_size,
    }))

    const postsRes = await fetch(`/api/admin/flows/${flowData.id}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postsPayload),
    })

    if (!postsRes.ok) return
    const postsData = await postsRes.json()

    setFlow({
      ...flowData,
      flow_posts: postsData,
    })
    setPhase('generate')
  }

  // ─── Generate Phase Handlers ─────────────────────────────────────────────

  const refreshFlow = useCallback(async () => {
    if (!flow) return
    const res = await fetch(`/api/admin/flows/${flow.id}`)
    if (res.ok) {
      const data = await res.json()
      setFlow(data)
    }
  }, [flow])

  async function generatePost(post: FlowPost) {
    if (!flow) return
    setGeneratingPostId(post.id)

    try {
      const endpoint = post.generation_mode === 'video'
        ? '/api/admin/generate/video'
        : post.generation_mode === 'edit'
          ? '/api/admin/generate/edit'
          : '/api/admin/generate/image'

      const payload: Record<string, unknown> = {
        prompt: post.prompt,
        flow_post_id: post.id,
      }

      if (post.generation_mode !== 'video') {
        payload.image_size = post.target_size
      }

      if ((post.generation_mode === 'edit' || post.generation_mode === 'video') && post.reference_media?.url) {
        payload.image_url = post.reference_media.url
      }

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      await refreshFlow()
    } catch (err) {
      console.error(err)
    } finally {
      setGeneratingPostId(null)
    }
  }

  async function generateAll() {
    if (!flow) return
    const pending = flow.flow_posts.filter((p) => p.status === 'pending' || p.status === 'rejected')

    for (const post of pending) {
      await generatePost(post)
    }
  }

  async function updatePostField(postId: string, updates: Partial<FlowPost>) {
    if (!flow) return
    await fetch(`/api/admin/flows/${flow.id}/posts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: postId, ...updates }]),
    })
    await refreshFlow()
  }

  // ─── Review Phase Handlers ───────────────────────────────────────────────

  async function approvePost(postId: string) {
    await updatePostField(postId, { status: 'approved' })
  }

  async function rejectPost(postId: string) {
    await updatePostField(postId, { status: 'rejected' })
  }

  async function regeneratePost(post: FlowPost) {
    await updatePostField(post.id, { status: 'pending', generated_media_id: null } as Partial<FlowPost>)
    await refreshFlow()
    const updated = flow?.flow_posts.find((p) => p.id === post.id)
    if (updated) await generatePost({ ...updated, status: 'pending', generated_media_id: null })
  }

  async function exportToCampaign() {
    if (!flow) return
    const approved = flow.flow_posts
      .filter((p) => p.status === 'approved' && p.generated_media_id)
      .sort((a, b) => a.sort_order - b.sort_order)

    const res = await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: flow.title,
        description: flow.concept,
        status: 'draft',
        platforms: flow.platform_targets,
        media_ids: approved.map((p) => p.generated_media_id),
      }),
    })

    if (res.ok) {
      const campaign = await res.json()
      await fetch(`/api/admin/flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete', campaign_id: campaign.id }),
      })
      window.location.href = `/admin/campaigns/${campaign.id}`
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const completedCount = flow?.flow_posts.filter((p) => ['complete', 'approved'].includes(p.status)).length || 0
  const totalCount = flow?.flow_posts.length || plannedPosts.length || 0
  const approvedCount = flow?.flow_posts.filter((p) => p.status === 'approved').length || 0

  return (
    <div className="space-y-6">
      {/* Phase Progress Bar */}
      <div className="flex items-center gap-3">
        {(['plan', 'generate', 'review'] as Phase[]).map((p, i) => {
          const labels = { plan: 'Plan', generate: 'Generate', review: 'Review' }
          const icons = { plan: Wand2, generate: Sparkles, review: Eye }
          const Icon = icons[p]
          const isActive = phase === p
          const isPast = (['plan', 'generate', 'review'] as Phase[]).indexOf(phase) > i

          return (
            <div key={p} className="flex items-center gap-3">
              {i > 0 && (
                <ChevronRight className={cn('w-4 h-4', isPast ? 'text-[#9B30FF]' : 'text-[#333]')} />
              )}
              <button
                onClick={() => {
                  if (isPast || (p === 'review' && flow && completedCount > 0)) setPhase(p)
                }}
                disabled={!isPast && !isActive && !(p === 'review' && flow && completedCount > 0)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                    : isPast
                      ? 'bg-[#4A7C0F]/10 text-[#4A7C0F] border border-[#4A7C0F]/20'
                      : 'text-[#666] border border-[#2A2A2A]'
                )}
              >
                {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                {labels[p]}
              </button>
            </div>
          )
        })}

        {totalCount > 0 && (
          <span className="ml-auto text-xs text-[#666]">
            {phase === 'review' ? `${approvedCount}/${totalCount} approved` : `${completedCount}/${totalCount} generated`}
          </span>
        )}
      </div>

      {/* Phase Content */}
      {phase === 'plan' && (
        <PlanPhase
          concept={concept}
          setConcept={setConcept}
          postCount={postCount}
          setPostCount={setPostCount}
          contentMix={contentMix}
          setContentMix={setContentMix}
          platformTargets={platformTargets}
          setPlatformTargets={setPlatformTargets}
          aiModel={aiModel}
          setAiModel={setAiModel}
          plannedPosts={plannedPosts}
          setPlannedPosts={setPlannedPosts}
          planLoading={planLoading}
          onGenerate={generatePlan}
          onAdvance={savePlanAndAdvance}
          libraryMedia={libraryMedia}
          selectedRefs={selectedRefs}
          setSelectedRefs={setSelectedRefs}
          showMediaPicker={showMediaPicker}
          setShowMediaPicker={setShowMediaPicker}
        />
      )}

      {phase === 'generate' && flow && (
        <GeneratePhase
          flow={flow}
          generatingPostId={generatingPostId}
          onGeneratePost={generatePost}
          onGenerateAll={generateAll}
          onUpdatePost={updatePostField}
          onAdvance={() => setPhase('review')}
        />
      )}

      {phase === 'review' && flow && (
        <ReviewPhase
          flow={flow}
          onApprove={approvePost}
          onReject={rejectPost}
          onRegenerate={regeneratePost}
          onExport={exportToCampaign}
          previewPost={previewPost}
          setPreviewPost={setPreviewPost}
          onBack={() => setPhase('generate')}
        />
      )}
    </div>
  )
}

// ─── Plan Phase ──────────────────────────────────────────────────────────────

function PlanPhase({
  concept, setConcept,
  postCount, setPostCount,
  contentMix, setContentMix,
  platformTargets, setPlatformTargets,
  aiModel, setAiModel,
  plannedPosts, setPlannedPosts,
  planLoading,
  onGenerate, onAdvance,
  libraryMedia, selectedRefs, setSelectedRefs,
  showMediaPicker, setShowMediaPicker,
}: {
  concept: string
  setConcept: (v: string) => void
  postCount: number
  setPostCount: (v: number) => void
  contentMix: 'images' | 'mixed'
  setContentMix: (v: 'images' | 'mixed') => void
  platformTargets: string[]
  setPlatformTargets: (v: string[]) => void
  aiModel: string
  setAiModel: (v: string) => void
  plannedPosts: PlannedPost[]
  setPlannedPosts: (v: PlannedPost[]) => void
  planLoading: boolean
  onGenerate: () => void
  onAdvance: () => void
  libraryMedia: MediaItem[]
  selectedRefs: string[]
  setSelectedRefs: (v: string[]) => void
  showMediaPicker: boolean
  setShowMediaPicker: (v: boolean) => void
}) {
  function togglePlatform(id: string) {
    setPlatformTargets(
      platformTargets.includes(id)
        ? platformTargets.filter((p) => p !== id)
        : [...platformTargets, id]
    )
  }

  function toggleRef(id: string) {
    setSelectedRefs(
      selectedRefs.includes(id)
        ? selectedRefs.filter((r) => r !== id)
        : [...selectedRefs, id]
    )
  }

  function updatePlannedPost(index: number, updates: Partial<PlannedPost>) {
    const updated = [...plannedPosts]
    updated[index] = { ...updated[index], ...updates }
    setPlannedPosts(updated)
  }

  function removePlannedPost(index: number) {
    const updated = plannedPosts.filter((_, i) => i !== index)
    setPlannedPosts(updated.map((p, i) => ({ ...p, sort_order: i })))
  }

  return (
    <div className="space-y-6">
      {/* Campaign Concept */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-semibold text-white">Campaign Concept</h3>

        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          rows={4}
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none"
          placeholder="Describe your campaign concept... e.g. 'Whisper campaign building mystery around Black Panther launch -- start with cryptic dark imagery, gradually revealing the product over 8 posts'"
        />

        {/* AI Model Selector */}
        <div>
          <label className="block text-xs font-medium text-[#A0A0A0] mb-2">AI Model</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {AI_MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setAiModel(m.value)}
                className={cn(
                  'flex flex-col items-start px-3 py-2 rounded-xl text-xs border transition-all',
                  aiModel === m.value
                    ? 'border-[#9B30FF] bg-[#9B30FF]/10'
                    : 'border-[#2A2A2A] hover:border-[#444]'
                )}
              >
                <span className={cn('font-medium', aiModel === m.value ? 'text-white' : 'text-[#A0A0A0]')}>
                  {m.label}
                </span>
                <span className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn('text-[10px] font-medium', TIER_COLORS[m.tier])}>{m.tier}</span>
                  <span className="text-[10px] text-[#666]">{m.price}/M tok</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#A0A0A0] mb-2">Posts</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={4}
                max={16}
                value={postCount}
                onChange={(e) => setPostCount(Number(e.target.value))}
                className="flex-1 accent-[#9B30FF]"
              />
              <span className="text-sm text-white font-medium w-6 text-center">{postCount}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A0A0A0] mb-2">Content Mix</label>
            <div className="flex gap-2">
              {(['images', 'mixed'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setContentMix(m)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all',
                    contentMix === m
                      ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-[#9B30FF]'
                      : 'border-[#2A2A2A] text-[#A0A0A0] hover:border-[#444]'
                  )}
                >
                  {m === 'images' ? <ImageIcon className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                  {m === 'images' ? 'Images Only' : 'Mixed'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A0A0A0] mb-2">Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const Icon = p.icon
                const selected = platformTargets.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all',
                      selected
                        ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-[#9B30FF]'
                        : 'border-[#2A2A2A] text-[#666] hover:border-[#444]'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {p.name.replace(' (Twitter)', '')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Reference Media */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[#A0A0A0]">
              Reference Media {selectedRefs.length > 0 && `(${selectedRefs.length} selected)`}
            </label>
            <button
              onClick={() => setShowMediaPicker(!showMediaPicker)}
              className="text-xs text-[#9B30FF] hover:text-[#BF5FFF] transition-colors"
            >
              {showMediaPicker ? 'Hide library' : 'Pick from library'}
            </button>
          </div>

          {selectedRefs.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {selectedRefs.map((refId) => {
                const media = libraryMedia.find((m) => m.id === refId)
                if (!media) return null
                return (
                  <div key={refId} className="relative group">
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-[#2A2A2A]">
                      <img src={media.url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={() => toggleRef(refId)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {showMediaPicker && (
            <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 max-h-[200px] overflow-y-auto">
              {libraryMedia.length === 0 ? (
                <p className="text-xs text-[#666] text-center py-4">No images in your media library</p>
              ) : (
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                  {libraryMedia.slice(0, 40).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => toggleRef(m.id)}
                      className={cn(
                        'aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        selectedRefs.includes(m.id)
                          ? 'border-[#9B30FF] ring-1 ring-[#9B30FF]'
                          : 'border-transparent hover:border-[#444]'
                      )}
                    >
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generate Plan Button */}
        <button
          onClick={onGenerate}
          disabled={planLoading || !concept.trim()}
          className="w-full bg-white text-black font-semibold rounded-full px-6 py-3 text-sm flex items-center justify-center gap-2 hover:bg-[#9B30FF] hover:text-white transition-all duration-300 disabled:opacity-50"
        >
          {planLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating plan...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Plan
            </>
          )}
        </button>
      </div>

      {/* Planned Posts */}
      {plannedPosts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">{plannedPosts.length} Posts Planned</h3>
            <button
              onClick={onAdvance}
              className="bg-white text-black font-semibold rounded-full px-5 py-2 text-sm flex items-center gap-2 hover:bg-[#9B30FF] hover:text-white transition-all duration-300"
            >
              Save & Generate
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {plannedPosts.map((post, index) => (
              <div
                key={index}
                className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 hover:border-[#444] transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <GripVertical className="w-4 h-4 text-[#333]" />
                    <span className="w-7 h-7 rounded-full bg-[#9B30FF]/10 text-[#9B30FF] text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-3">
                    <p className="text-sm text-white font-medium">{post.concept}</p>

                    <textarea
                      value={post.prompt}
                      onChange={(e) => updatePlannedPost(index, { prompt: e.target.value })}
                      rows={2}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-[#A0A0A0] placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none"
                    />

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Mode */}
                      <div className="flex gap-1">
                        {MODE_OPTIONS
                          .filter((mode) => contentMix === 'images' ? mode.value !== 'video' : true)
                          .map((mode) => {
                          const Icon = mode.icon
                          return (
                            <button
                              key={mode.value}
                              onClick={() => updatePlannedPost(index, { generation_mode: mode.value as PlannedPost['generation_mode'] })}
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-all',
                                post.generation_mode === mode.value
                                  ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-[#9B30FF]'
                                  : 'border-[#2A2A2A] text-[#666] hover:border-[#444]'
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              {mode.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Size */}
                      <select
                        value={post.target_size}
                        onChange={(e) => updatePlannedPost(index, { target_size: e.target.value })}
                        className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                      >
                        {SIZE_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>

                      {post.caption_suggestion && (
                        <span className="text-[10px] text-[#666] truncate max-w-[200px]" title={post.caption_suggestion}>
                          Caption: {post.caption_suggestion}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => removePlannedPost(index)}
                    className="p-1.5 text-[#666] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Generate Phase ──────────────────────────────────────────────────────────

function GeneratePhase({
  flow,
  generatingPostId,
  onGeneratePost,
  onGenerateAll,
  onUpdatePost,
  onAdvance,
}: {
  flow: Flow
  generatingPostId: string | null
  onGeneratePost: (post: FlowPost) => void
  onGenerateAll: () => void
  onUpdatePost: (postId: string, updates: Partial<FlowPost>) => void
  onAdvance: () => void
}) {
  const pendingCount = flow.flow_posts.filter((p) => p.status === 'pending' || p.status === 'rejected').length
  const completedCount = flow.flow_posts.filter((p) => ['complete', 'approved'].includes(p.status)).length
  const isGenerating = generatingPostId !== null

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onGenerateAll}
            disabled={isGenerating || pendingCount === 0}
            className="bg-white text-black font-semibold rounded-full px-5 py-2 text-sm flex items-center gap-2 hover:bg-[#9B30FF] hover:text-white transition-all duration-300 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isGenerating ? 'Generating...' : `Execute All (${pendingCount})`}
          </button>

          {isGenerating && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#9B30FF] rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / flow.flow_posts.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[#666]">{completedCount}/{flow.flow_posts.length}</span>
            </div>
          )}
        </div>

        {completedCount > 0 && (
          <button
            onClick={onAdvance}
            className="text-sm text-[#9B30FF] hover:text-[#BF5FFF] font-medium flex items-center gap-1 transition-colors"
          >
            Review Gallery
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Post List */}
      <div className="space-y-3">
        {flow.flow_posts.map((post) => {
          const isCurrentlyGenerating = generatingPostId === post.id
          const statusStyle = STATUS_COLORS[post.status] || STATUS_COLORS.pending

          return (
            <div
              key={post.id}
              className={cn(
                'bg-[#141414] border rounded-2xl p-5 transition-all',
                isCurrentlyGenerating ? 'border-[#E87511]/50 bg-[#E87511]/5' : 'border-[#2A2A2A] hover:border-[#444]'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Number + Status */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <span className="w-7 h-7 rounded-full bg-[#9B30FF]/10 text-[#9B30FF] text-xs font-bold flex items-center justify-center">
                    {post.sort_order + 1}
                  </span>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', statusStyle.bg, statusStyle.text)}>
                    {post.status}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-white font-medium">{post.concept}</p>

                  <textarea
                    value={post.prompt}
                    onChange={(e) => onUpdatePost(post.id, { prompt: e.target.value })}
                    rows={2}
                    disabled={isCurrentlyGenerating}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none disabled:opacity-50"
                  />

                  <div className="flex items-center gap-2">
                    {MODE_OPTIONS.map((mode) => {
                      const Icon = mode.icon
                      return (
                        <button
                          key={mode.value}
                          onClick={() => onUpdatePost(post.id, { generation_mode: mode.value as FlowPost['generation_mode'] })}
                          disabled={isCurrentlyGenerating}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-all',
                            post.generation_mode === mode.value
                              ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-[#9B30FF]'
                              : 'border-[#2A2A2A] text-[#666] hover:border-[#444]'
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {mode.label}
                        </button>
                      )
                    })}

                    <select
                      value={post.target_size}
                      onChange={(e) => onUpdatePost(post.id, { target_size: e.target.value })}
                      disabled={isCurrentlyGenerating}
                      className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                    >
                      {SIZE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Thumbnail / Generate Button */}
                <div className="shrink-0 w-24">
                  {post.generated_media?.url ? (
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-[#2A2A2A]">
                      {post.generated_media.file_type === 'video' ? (
                        <video src={post.generated_media.url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={post.generated_media.url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ) : isCurrentlyGenerating ? (
                    <div className="w-24 h-24 rounded-xl border border-[#E87511]/30 bg-[#E87511]/5 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-[#E87511] animate-spin" />
                    </div>
                  ) : (
                    <button
                      onClick={() => onGeneratePost(post)}
                      disabled={isGenerating}
                      className="w-24 h-24 rounded-xl border border-dashed border-[#2A2A2A] hover:border-[#9B30FF] flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-5 h-5 text-[#666]" />
                      <span className="text-[10px] text-[#666]">Generate</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Review Phase ────────────────────────────────────────────────────────────

function ReviewPhase({
  flow,
  onApprove,
  onReject,
  onRegenerate,
  onExport,
  previewPost,
  setPreviewPost,
  onBack,
}: {
  flow: Flow
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRegenerate: (post: FlowPost) => void
  onExport: () => void
  previewPost: FlowPost | null
  setPreviewPost: (post: FlowPost | null) => void
  onBack: () => void
}) {
  const completedPosts = flow.flow_posts
    .filter((p) => ['complete', 'approved', 'rejected'].includes(p.status))
    .sort((a, b) => a.sort_order - b.sort_order)

  const approvedCount = flow.flow_posts.filter((p) => p.status === 'approved').length
  const totalCompleted = completedPosts.length

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-[#A0A0A0] hover:text-white font-medium flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Generate
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#666]">{approvedCount}/{totalCompleted} approved</span>
          <button
            onClick={onExport}
            disabled={approvedCount === 0}
            className="bg-white text-black font-semibold rounded-full px-5 py-2 text-sm flex items-center gap-2 hover:bg-[#4A7C0F] hover:text-white transition-all duration-300 disabled:opacity-50"
          >
            <Megaphone className="w-4 h-4" />
            Export to Campaign ({approvedCount})
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {completedPosts.map((post) => {
          const statusStyle = STATUS_COLORS[post.status] || STATUS_COLORS.complete

          return (
            <div
              key={post.id}
              className={cn(
                'bg-[#141414] border rounded-2xl overflow-hidden transition-all group',
                post.status === 'approved' ? 'border-[#4A7C0F]/50' :
                  post.status === 'rejected' ? 'border-[#FF0040]/30' :
                    'border-[#2A2A2A] hover:border-[#444]'
              )}
            >
              {/* Image/Video */}
              <div
                className="relative aspect-square cursor-pointer"
                onClick={() => setPreviewPost(post)}
              >
                {post.generated_media?.file_type === 'video' ? (
                  <video
                    src={post.generated_media.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                ) : post.generated_media?.url ? (
                  <img src={post.generated_media.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#0A0A0A] flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-[#333]" />
                  </div>
                )}

                {/* Sequence Number */}
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs font-bold flex items-center justify-center">
                  {post.sort_order + 1}
                </div>

                {/* Status Badge */}
                <div className={cn('absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium', statusStyle.bg, statusStyle.text)}>
                  {post.status}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Eye className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Info + Actions */}
              <div className="p-3 space-y-2">
                <p className="text-xs text-[#A0A0A0] line-clamp-2">{post.concept}</p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onApprove(post.id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                      post.status === 'approved'
                        ? 'bg-[#4A7C0F] text-white'
                        : 'bg-[#4A7C0F]/10 text-[#4A7C0F] hover:bg-[#4A7C0F]/20'
                    )}
                  >
                    <Check className="w-3 h-3" />
                    {post.status === 'approved' ? 'Approved' : 'Approve'}
                  </button>

                  <button
                    onClick={() => onReject(post.id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                      post.status === 'rejected'
                        ? 'bg-[#FF0040] text-white'
                        : 'bg-[#FF0040]/10 text-[#FF0040] hover:bg-[#FF0040]/20'
                    )}
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </button>

                  <button
                    onClick={() => onRegenerate(post)}
                    className="p-1.5 rounded-lg bg-[#E87511]/10 text-[#E87511] hover:bg-[#E87511]/20 transition-all"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview Modal */}
      {previewPost && previewPost.generated_media && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setPreviewPost(null)}>
          <div className="max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold">Post {previewPost.sort_order + 1}</h3>
                <p className="text-sm text-[#A0A0A0]">{previewPost.concept}</p>
              </div>
              <button onClick={() => setPreviewPost(null)} className="text-[#666] hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden rounded-2xl bg-[#0A0A0A]">
              {previewPost.generated_media.file_type === 'video' ? (
                <video
                  src={previewPost.generated_media.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[70vh] rounded-xl"
                />
              ) : (
                <img
                  src={previewPost.generated_media.url}
                  alt=""
                  className="max-w-full max-h-[70vh] rounded-xl object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-[#666] max-w-lg truncate">{previewPost.prompt}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onApprove(previewPost.id); setPreviewPost(null) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#4A7C0F]/10 text-[#4A7C0F] hover:bg-[#4A7C0F]/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => { onReject(previewPost.id); setPreviewPost(null) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#FF0040]/10 text-[#FF0040] hover:bg-[#FF0040]/20 transition-all"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => { onRegenerate(previewPost); setPreviewPost(null) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#E87511]/10 text-[#E87511] hover:bg-[#E87511]/20 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
