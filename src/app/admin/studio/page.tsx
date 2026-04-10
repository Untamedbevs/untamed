'use client'

import { Suspense, useEffect, useState, useCallback, type Dispatch, type SetStateAction } from 'react'
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
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLATFORMS } from '@/lib/constants/platforms'
import { drinks, drinkAssetAbsoluteUrl, getDrinkBySlug, type Drink } from '@/lib/drinks'
import {
  FAL_DEFAULT_EDIT_MODEL,
  FAL_DEFAULT_IMAGE_MODEL,
  defaultFalModelForMode,
  FAL_EDIT_MODELS,
  FAL_IMAGE_MODELS,
  FAL_VIDEO_MODELS,
  FAL_VIDEO_FIRST_LAST_MODEL,
  videoModelIsTextToVideoOnly,
  videoModelRequiresFirstAndLastFrame,
} from '@/lib/fal-generate-models'

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
  reference_external_url?: string | null
  end_reference_media_id?: string | null
  reference_source_sort_order?: number | null
  end_frame_source_sort_order?: number | null
  generated_media_id: string | null
  status: 'pending' | 'generating' | 'complete' | 'approved' | 'rejected' | 'maybe'
  fal_model: string | null
  generation_metadata: Record<string, unknown> | null
  reference_media?: MediaItem | null
  end_reference_media?: MediaItem | null
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
  fal_model?: string | null
  /** Public URL (e.g. site can image) when not using library media */
  reference_external_url?: string | null
  /** Library image (e.g. product can) used as input where the model supports it */
  reference_media_id?: string | null
  /** Use another line’s finished image as primary input (edit / video start) — matches that post’s sort_order */
  reference_source_sort_order?: number | null
  /** Video end frame from another line’s finished image (first+last models) */
  end_frame_source_sort_order?: number | null
  end_reference_media_id?: string | null
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

function falModelOptionsForMode(mode: PlannedPost['generation_mode']) {
  if (mode === 'edit') return FAL_EDIT_MODELS
  if (mode === 'video') return FAL_VIDEO_MODELS
  return FAL_IMAGE_MODELS
}

function truncateLabel(s: string, max: number) {
  if (s.length <= max) return s
  return `${s.slice(0, max)}...`
}

async function parseAdminApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      error?: string
      hint?: string
      migrationHint?: string
    }
    const parts = [j.error, j.hint, j.migrationHint].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0
    )
    if (parts.length > 0) return parts.join(' ')
  } catch {
    // ignore
  }
  return res.statusText || `Request failed (${res.status})`
}

/** 3-line flow using brand can + spirit animal from `drinks.ts` (site asset URLs). */
type HeroGender = 'female' | 'male'

const HERO_LABEL: Record<HeroGender, { subject: string; pronoun: string }> = {
  female: { subject: 'a beautiful woman', pronoun: 'The woman' },
  male: { subject: 'a handsome man', pronoun: 'The man' },
}

/** Matches real Untamed SKU: 12 fl oz slimline can (not 16oz / pint / short wide). */
const HERO_CAN_FORMAT =
  'The beverage is a 12 fl oz tall slim aluminum can (slimline RTD: noticeably taller and narrower than a standard short 12oz beer can). It is not a 16 ounce can, not a pint, not a short wide stubby. Keep scale in the hand consistent with that slim tall format and with the reference can proportions.'

function getDrinkHeroChainExamplePosts(drink: Drink, siteBase: string, gender: HeroGender = 'female'): PlannedPost[] {
  const canUrl = drinkAssetAbsoluteUrl(siteBase, drink.canImage)
  const animalUrl = drinkAssetAbsoluteUrl(siteBase, drink.animalImage)
  const hero = HERO_LABEL[gender]
  return [
    {
      sort_order: 0,
      concept: `${gender === 'male' ? 'Man' : 'Woman'} holding ${drink.name} can`,
      prompt:
        `Photorealistic advertising hero for ${drink.name} (${drink.flavor}): ${hero.subject} holding this beverage can, confident natural pose, face in sharp focus and clearly visible, looking at the camera. The person's face is the primary subject. ${HERO_CAN_FORMAT} The can is held at chest level, label visible and legible. Premium studio lighting, both the face and can are in focus. Full upper body framing, not a close-up of the can.`,
      generation_mode: 'generate',
      target_size: 'landscape_16_9',
      caption_suggestion: '',
      hashtag_suggestions: [],
      fal_model: FAL_DEFAULT_IMAGE_MODEL,
      reference_external_url: canUrl,
      reference_media_id: null,
      reference_source_sort_order: null,
      end_frame_source_sort_order: null,
      end_reference_media_id: null,
    },
    {
      sort_order: 1,
      concept: `${drink.animal} holding the same can (exact scene duplicate)`,
      prompt:
        `Edit this image: replace ONLY the person with a photorealistic ${drink.animal}. The ${drink.animal} must be gripping the same ${drink.name} can in the same hand position — the can, its label, and placement are identical to the original. ${HERO_CAN_FORMAT} Same composition, same lighting, same background, same camera angle, same depth of field. The ${drink.animal} looks natural and powerful, sitting confidently like a premium advertising hero shot. Every detail except the subject stays pixel-perfect. Reference spirit animal: ${animalUrl}`,
      generation_mode: 'edit',
      target_size: 'landscape_16_9',
      caption_suggestion: '',
      hashtag_suggestions: [],
      fal_model: FAL_DEFAULT_EDIT_MODEL,
      reference_external_url: null,
      reference_media_id: null,
      reference_source_sort_order: 0,
      end_frame_source_sort_order: null,
      end_reference_media_id: null,
    },
    {
      sort_order: 2,
      concept: `Video: ${gender === 'male' ? 'man' : 'woman'} takes a sip, transforms into ${drink.animal}`,
      prompt:
        `Photorealistic commercial video. ${hero.pronoun} holds the ${drink.name} can, takes a slow sip, then smoothly morphs into a ${drink.animal} — the can stays gripped in hand the entire time, never disappearing. ${HERO_CAN_FORMAT} Every frame is photorealistic with consistent studio lighting, same background, same camera angle. The transformation is fluid and believable, not cartoonish. The ${drink.animal} ends in the same pose, still holding the can. Cinematic slow motion, shallow depth of field, premium ad quality. ${drink.tagline}`,
      generation_mode: 'video',
      target_size: 'landscape_16_9',
      caption_suggestion: '',
      hashtag_suggestions: [],
      fal_model: FAL_VIDEO_FIRST_LAST_MODEL,
      reference_external_url: null,
      reference_media_id: null,
      reference_source_sort_order: 0,
      end_frame_source_sort_order: 1,
      end_reference_media_id: null,
    },
  ]
}

/** Image media IDs usable as frame sources: prior completed image outputs, then library (deduped). */
function buildVideoFrameMediaOptions(flow: Flow, currentPost: FlowPost, libraryMedia: MediaItem[]) {
  const seen = new Set<string>()
  const options: { id: string; label: string }[] = []

  const prior = flow.flow_posts
    .filter((p) => p.sort_order < currentPost.sort_order)
    .sort((a, b) => a.sort_order - b.sort_order)

  for (const p of prior) {
    const g = p.generated_media
    if (!g?.id || g.file_type !== 'image') continue
    if (seen.has(g.id)) continue
    seen.add(g.id)
    options.push({
      id: g.id,
      label: `Post ${p.sort_order + 1}: ${truncateLabel(p.concept, 36)}`,
    })
  }

  for (const m of libraryMedia) {
    if (m.file_type !== 'image' || !m.id) continue
    if (seen.has(m.id)) continue
    seen.add(m.id)
    options.push({
      id: m.id,
      label: `Library: ${truncateLabel(m.filename, 40)}`,
    })
  }

  return options
}

/** Prior segment counts as ready once it has output (including tentative maybe). */
const FLOW_SEGMENT_OUTPUT_READY = ['complete', 'approved', 'maybe'] as const

/** Primary image URL: prior line output wins over library attachment. */
function resolvePrimaryReferenceUrl(flow: Flow, post: FlowPost): string | undefined {
  if (post.reference_source_sort_order != null) {
    const src = flow.flow_posts.find((p) => p.sort_order === post.reference_source_sort_order)
    if (!src || !(FLOW_SEGMENT_OUTPUT_READY as readonly string[]).includes(src.status)) return undefined
    const g = src.generated_media
    if (g?.file_type === 'image' && g.url) return g.url
    return undefined
  }
  const external = post.reference_external_url?.trim()
  if (external) return external
  return post.reference_media?.url ?? undefined
}

function resolveEndFrameUrl(flow: Flow, post: FlowPost): string | undefined {
  if (post.end_frame_source_sort_order != null) {
    const src = flow.flow_posts.find((p) => p.sort_order === post.end_frame_source_sort_order)
    if (!src || !(FLOW_SEGMENT_OUTPUT_READY as readonly string[]).includes(src.status)) return undefined
    const g = src.generated_media
    if (g?.file_type === 'image' && g.url) return g.url
    return undefined
  }
  return post.end_reference_media?.url ?? undefined
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-[#666]/10', text: 'text-[#666]' },
  generating: { bg: 'bg-[#E87511]/10', text: 'text-[#E87511]' },
  complete: { bg: 'bg-[#00BFFF]/10', text: 'text-[#00BFFF]' },
  approved: { bg: 'bg-[#4A7C0F]/10', text: 'text-[#4A7C0F]' },
  rejected: { bg: 'bg-[#FF0040]/10', text: 'text-[#FF0040]' },
  maybe: { bg: 'bg-[#C9A227]/10', text: 'text-[#E8C547]' },
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
  const [planDrinkSlug, setPlanDrinkSlug] = useState(() => drinks[0]?.slug ?? 'black-panther')
  const [heroGender, setHeroGender] = useState<HeroGender>('female')
  const [savePlanError, setSavePlanError] = useState<string | null>(null)
  const [savePlanBusy, setSavePlanBusy] = useState(false)

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
      let posts: PlannedPost[] = (data.posts || []).map((p: PlannedPost) => ({
        ...p,
        reference_media_id: p.reference_media_id ?? null,
        reference_external_url: p.reference_external_url ?? null,
        reference_source_sort_order: p.reference_source_sort_order ?? null,
        end_frame_source_sort_order: p.end_frame_source_sort_order ?? null,
        end_reference_media_id: p.end_reference_media_id ?? null,
      }))

      if (contentMix === 'images') {
        posts = posts.map((p) => {
          if (p.generation_mode !== 'video') return p
          return {
            ...p,
            generation_mode: 'generate',
            fal_model: defaultFalModelForMode('generate'),
          }
        })
      }

      setPlannedPosts(posts)
    } catch (err) {
      console.error(err)
    } finally {
      setPlanLoading(false)
    }
  }

  function loadDrinkHeroChainExample() {
    const drink = getDrinkBySlug(planDrinkSlug) ?? drinks[0]
    if (!drink) return
    setContentMix('mixed')
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) || ''
    setConcept(
      `${drink.name}: woman + can (site can image), ${drink.animal} + same can (edit from line 1, spirit animal from brand), then Veo first/last video between those two heroes. Uses canImage and animalImage from drinks config — deploy a public URL so Fal can fetch assets.`
    )
    setPlannedPosts(getDrinkHeroChainExamplePosts(drink, origin, heroGender))
  }

  async function savePlanAndAdvance() {
    if (plannedPosts.length === 0) return
    setSavePlanError(null)
    setSavePlanBusy(true)

    try {
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

      if (!res.ok) {
        const err = await parseAdminApiError(res)
        setSavePlanError(err)
        return
      }
      const flowData = await res.json()

      const postsPayload = plannedPosts.map((p) => ({
        sort_order: p.sort_order,
        concept: p.concept,
        prompt: p.prompt,
        generation_mode: p.generation_mode,
        target_size: p.target_size,
        fal_model: p.fal_model ?? defaultFalModelForMode(p.generation_mode),
        reference_media_id: p.reference_media_id ?? null,
        reference_external_url: p.reference_external_url?.trim() || null,
        reference_source_sort_order: p.reference_source_sort_order ?? null,
        end_frame_source_sort_order: p.end_frame_source_sort_order ?? null,
        end_reference_media_id: p.end_reference_media_id ?? null,
      }))

      const postsRes = await fetch(`/api/admin/flows/${flowData.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postsPayload),
      })

      if (!postsRes.ok) {
        const err = await parseAdminApiError(postsRes)
        setSavePlanError(err)
        await fetch(`/api/admin/flows/${flowData.id}`, { method: 'DELETE' })
        return
      }
      const postsData = await postsRes.json()

      setFlow({
        ...flowData,
        flow_posts: postsData,
      })
      setPhase('generate')
    } finally {
      setSavePlanBusy(false)
    }
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
      const primaryRef = resolvePrimaryReferenceUrl(flow, post)
      const endRef = post.generation_mode === 'video' ? resolveEndFrameUrl(flow, post) : undefined

      let endpoint: string
      const payload: Record<string, unknown> = {
        prompt: post.prompt,
        flow_post_id: post.id,
        fal_model: post.fal_model ?? defaultFalModelForMode(post.generation_mode),
      }

      if (post.generation_mode === 'generate') {
        if (primaryRef) {
          endpoint = '/api/admin/generate/edit'
          payload.image_url = primaryRef
          payload.image_size = post.target_size
        } else {
          endpoint = '/api/admin/generate/image'
          payload.image_size = post.target_size
        }
      } else if (post.generation_mode === 'edit') {
        endpoint = '/api/admin/generate/edit'
        payload.image_size = post.target_size
        if (primaryRef) payload.image_url = primaryRef
      } else {
        endpoint = '/api/admin/generate/video'
        payload.target_size = post.target_size
        if (primaryRef) payload.image_url = primaryRef
        if (endRef) payload.end_image_url = endRef
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
    const pending = flow.flow_posts
      .filter((p) => p.status === 'pending' || p.status === 'rejected')
      .sort((a, b) => a.sort_order - b.sort_order)

    const staggerMs = Number(process.env.NEXT_PUBLIC_STUDIO_GENERATE_STAGGER_MS) || 0

    for (let i = 0; i < pending.length; i++) {
      await generatePost(pending[i])
      if (staggerMs > 0 && i < pending.length - 1) {
        await new Promise((r) => setTimeout(r, staggerMs))
      }
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

  async function maybePost(postId: string) {
    await updatePostField(postId, { status: 'maybe' })
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

  const completedCount =
    flow?.flow_posts.filter((p) => (FLOW_SEGMENT_OUTPUT_READY as readonly string[]).includes(p.status)).length || 0
  const totalCount = flow?.flow_posts.length || plannedPosts.length || 0
  const approvedCount = flow?.flow_posts.filter((p) => p.status === 'approved').length || 0
  const maybeCountBar = flow?.flow_posts.filter((p) => p.status === 'maybe').length || 0

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
            {phase === 'review'
              ? `${approvedCount}/${totalCount} approved${maybeCountBar > 0 ? ` · ${maybeCountBar} maybe` : ''}`
              : `${completedCount}/${totalCount} generated`}
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
          savePlanError={savePlanError}
          savePlanBusy={savePlanBusy}
          planDrinkSlug={planDrinkSlug}
          setPlanDrinkSlug={setPlanDrinkSlug}
          heroGender={heroGender}
          setHeroGender={setHeroGender}
          onLoadDrinkHeroChainExample={loadDrinkHeroChainExample}
          onDrinkChange={(slug, gender) => {
            const drink = getDrinkBySlug(slug) ?? drinks[0]
            if (!drink) return
            const origin =
              typeof window !== 'undefined' && window.location?.origin
                ? window.location.origin
                : (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) || ''
            const g = gender ?? heroGender
            const label = g === 'male' ? 'man' : 'woman'
            setConcept(
              `${drink.name}: ${label} + can (site can image), ${drink.animal} + same can (edit from line 1, spirit animal from brand), then Veo first/last video between those two heroes.`
            )
            setPlannedPosts(getDrinkHeroChainExamplePosts(drink, origin, g))
          }}
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
          libraryMedia={libraryMedia}
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
          onMaybe={maybePost}
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
  onGenerate,
  onAdvance,
  savePlanError,
  savePlanBusy,
  planDrinkSlug,
  setPlanDrinkSlug,
  heroGender,
  setHeroGender,
  onLoadDrinkHeroChainExample,
  onDrinkChange,
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
  setPlannedPosts: Dispatch<SetStateAction<PlannedPost[]>>
  planLoading: boolean
  onGenerate: () => void
  onAdvance: () => void
  savePlanError: string | null
  savePlanBusy: boolean
  planDrinkSlug: string
  setPlanDrinkSlug: (slug: string) => void
  heroGender: HeroGender
  setHeroGender: (g: HeroGender) => void
  onLoadDrinkHeroChainExample: () => void
  onDrinkChange?: (slug: string, gender?: HeroGender) => void
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

  function addPlannedLine() {
    setPlannedPosts((prev) => [
      ...prev,
      {
        sort_order: prev.length,
        concept: 'New line item',
        prompt: '',
        generation_mode: 'generate',
        target_size: 'square_1_1',
        caption_suggestion: '',
        hashtag_suggestions: [],
        fal_model: null,
        reference_external_url: null,
        reference_media_id: null,
        reference_source_sort_order: null,
        end_frame_source_sort_order: null,
        end_reference_media_id: null,
      },
    ])
  }

  function removePlannedPost(index: number) {
    const removedSort = plannedPosts[index].sort_order
    setPlannedPosts(
      plannedPosts
        .filter((_, i) => i !== index)
        .map((p, i) => {
          let rs = p.reference_source_sort_order ?? null
          let es = p.end_frame_source_sort_order ?? null
          if (rs != null) {
            if (rs === removedSort) rs = null
            else if (rs > removedSort) rs -= 1
          }
          if (es != null) {
            if (es === removedSort) es = null
            else if (es > removedSort) es -= 1
          }
          return {
            ...p,
            sort_order: i,
            reference_source_sort_order: rs,
            end_frame_source_sort_order: es,
          }
        })
    )
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

      {/* Planned line items */}
      <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">
                {plannedPosts.length === 0 ? 'Plan line items' : `${plannedPosts.length} line items`}
              </h3>
              <p className="text-[11px] text-[#666] mt-1 max-w-xl leading-relaxed">
                Each drink in Untamed has <span className="text-[#A0A0A0]">canImage</span> and{' '}
                <span className="text-[#A0A0A0]">animalImage</span> in code. Load the hero chain to wire line 1 to the public can URL and line 2&apos;s prompt to that drink&apos;s spirit animal. You can still mix library picks and prior-line outputs on any row.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[200px]">
                <label className="text-[10px] text-[#666]">Drink</label>
                <select
                  value={planDrinkSlug}
                  onChange={(e) => { setPlanDrinkSlug(e.target.value); onDrinkChange?.(e.target.value) }}
                  className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#9B30FF]"
                >
                  {drinks.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label className="text-[10px] text-[#666]">Hero</label>
                <select
                  value={heroGender}
                  onChange={(e) => { const g = e.target.value as HeroGender; setHeroGender(g); onDrinkChange?.(planDrinkSlug, g) }}
                  className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#9B30FF]"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
              <button
                type="button"
                onClick={onLoadDrinkHeroChainExample}
                className="rounded-full border border-[#9B30FF]/40 bg-[#9B30FF]/10 px-4 py-2 text-xs font-medium text-[#BF5FFF] hover:bg-[#9B30FF]/20 transition-colors self-end sm:self-auto"
              >
                Load drink hero chain
              </button>
              <button
                type="button"
                onClick={addPlannedLine}
                className="rounded-full border border-[#2A2A2A] px-4 py-2 text-xs font-medium text-[#A0A0A0] hover:border-[#9B30FF] hover:text-[#9B30FF] transition-colors"
              >
                Add line item
              </button>
              <button
                type="button"
                onClick={onAdvance}
                disabled={plannedPosts.length === 0 || savePlanBusy}
                className="bg-white text-black font-semibold rounded-full px-5 py-2 text-sm flex items-center gap-2 hover:bg-[#9B30FF] hover:text-white transition-all duration-300 disabled:opacity-40"
              >
                {savePlanBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Save & Generate
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {savePlanError && (
            <div
              role="alert"
              className="flex gap-3 rounded-2xl border border-[#FF0040]/35 bg-[#FF0040]/10 px-4 py-3 text-sm text-[#FFB3C0]"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-[#FF0040] mt-0.5" />
              <p className="leading-relaxed">{savePlanError}</p>
            </div>
          )}

          <div className="space-y-3">
            {plannedPosts.length === 0 ? (
              <p className="text-sm text-[#666] text-center py-10 px-4 border border-dashed border-[#2A2A2A] rounded-2xl">
                No lines yet. Use &quot;Add line item&quot; to build your sequence, or run &quot;Generate plan&quot; from your concept.
              </p>
            ) : (
              plannedPosts.map((post, index) => (
              <div
                key={`plan-line-${index}-${post.sort_order}`}
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
                    <input
                      type="text"
                      value={post.concept}
                      onChange={(e) => updatePlannedPost(index, { concept: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-[#9B30FF]"
                      placeholder="Line title / concept"
                    />

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
                              onClick={() => {
                                const next = mode.value as PlannedPost['generation_mode']
                                updatePlannedPost(index, {
                                  generation_mode: next,
                                  fal_model: defaultFalModelForMode(next),
                                  ...(next !== 'video'
                                    ? { end_frame_source_sort_order: null, end_reference_media_id: null }
                                    : {}),
                                })
                              }}
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

                      <select
                        value={post.fal_model ?? defaultFalModelForMode(post.generation_mode)}
                        onChange={(e) => {
                          const next = e.target.value
                          updatePlannedPost(index, {
                            fal_model: next,
                            ...(!videoModelRequiresFirstAndLastFrame(next)
                              ? { end_frame_source_sort_order: null, end_reference_media_id: null }
                              : {}),
                          })
                        }}
                        title="fal.ai model"
                        className="max-w-[200px] bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                      >
                        {falModelOptionsForMode(post.generation_mode).map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>

                      {post.caption_suggestion && (
                        <span className="text-[10px] text-[#666] truncate max-w-[200px]" title={post.caption_suggestion}>
                          Caption: {post.caption_suggestion}
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]/50 p-3 space-y-3">
                      <p className="text-[10px] font-medium text-[#888] uppercase tracking-wide">Inputs for this line</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[#666]">Library image (e.g. product, can)</label>
                          <select
                            value={post.reference_media_id ?? ''}
                            onChange={(e) =>
                              updatePlannedPost(index, {
                                reference_media_id: e.target.value || null,
                              })
                            }
                            className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                          >
                            <option value="">None</option>
                            {libraryMedia
                              .filter((m) => m.file_type === 'image')
                              .slice(0, 80)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {truncateLabel(m.filename, 48)}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <label className="text-[10px] text-[#666]">
                            Public image URL (skips library; Fal must reach this host)
                          </label>
                          <input
                            type="url"
                            value={post.reference_external_url ?? ''}
                            onChange={(e) =>
                              updatePlannedPost(index, {
                                reference_external_url: e.target.value.trim() || null,
                              })
                            }
                            placeholder="https://yoursite.com/images/can-....png"
                            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] placeholder-[#555] focus:outline-none focus:border-[#9B30FF]"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[#666]">Use prior line output as main image</label>
                          <select
                            value={post.reference_source_sort_order ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              updatePlannedPost(index, {
                                reference_source_sort_order: v === '' ? null : Number(v),
                              })
                            }}
                            className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                          >
                            <option value="">None</option>
                            {plannedPosts.slice(0, index).map((prior, i) => (
                              <option key={i} value={i}>
                                Line {i + 1}: {truncateLabel(prior.concept, 34)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {post.generation_mode === 'video' &&
                        videoModelRequiresFirstAndLastFrame(
                          post.fal_model ?? defaultFalModelForMode('video')
                        ) && (
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-[#666]">Prior line for end frame (spirit animal hero)</label>
                            <select
                              value={post.end_frame_source_sort_order ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                updatePlannedPost(index, {
                                  end_frame_source_sort_order: v === '' ? null : Number(v),
                                })
                              }}
                              className="max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                            >
                              <option value="">None</option>
                              {plannedPosts.slice(0, index).map((prior, i) => (
                                <option key={`end-${i}`} value={i}>
                                  Line {i + 1}: {truncateLabel(prior.concept, 34)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      <p className="text-[10px] text-[#555] leading-relaxed">
                        Generate + library image uses image-to-image. If you pick a prior line, that line must finish first (use Execute All in order).
                      </p>
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
            ))
            )}
          </div>
        </div>
    </div>
  )
}

// ─── Generate Phase ──────────────────────────────────────────────────────────

function GeneratePhase({
  flow,
  libraryMedia,
  generatingPostId,
  onGeneratePost,
  onGenerateAll,
  onUpdatePost,
  onAdvance,
}: {
  flow: Flow
  libraryMedia: MediaItem[]
  generatingPostId: string | null
  onGeneratePost: (post: FlowPost) => void
  onGenerateAll: () => void
  onUpdatePost: (postId: string, updates: Partial<FlowPost>) => void
  onAdvance: () => void
}) {
  const pendingCount = flow.flow_posts.filter((p) => p.status === 'pending' || p.status === 'rejected').length
  const completedCount = flow.flow_posts.filter((p) =>
    (FLOW_SEGMENT_OUTPUT_READY as readonly string[]).includes(p.status)
  ).length
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
          const videoModelId = post.fal_model ?? defaultFalModelForMode('video')
          const frameOptions =
            post.generation_mode === 'video' && !videoModelIsTextToVideoOnly(videoModelId)
              ? buildVideoFrameMediaOptions(flow, post, libraryMedia)
              : []

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
                          onClick={() => {
                            const next = mode.value as FlowPost['generation_mode']
                            onUpdatePost(post.id, {
                              generation_mode: next,
                              fal_model: defaultFalModelForMode(next),
                              ...(next !== 'video'
                                ? {
                                    end_reference_media_id: null,
                                    end_frame_source_sort_order: null,
                                  }
                                : {}),
                            })
                          }}
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

                    <select
                      value={post.fal_model ?? defaultFalModelForMode(post.generation_mode)}
                      onChange={(e) => {
                        const next = e.target.value
                        onUpdatePost(post.id, {
                          fal_model: next,
                          ...(!videoModelRequiresFirstAndLastFrame(next)
                            ? {
                                end_reference_media_id: null,
                                end_frame_source_sort_order: null,
                              }
                            : {}),
                        })
                      }}
                      disabled={isCurrentlyGenerating}
                      title="fal.ai model"
                      className="max-w-[180px] bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                    >
                      {falModelOptionsForMode(post.generation_mode).map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  {(post.generation_mode === 'edit' || post.generation_mode === 'generate') && (
                    <div className="space-y-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]/50 p-3">
                      <p className="text-[10px] font-medium text-[#A0A0A0]">Still image inputs</p>
                      {post.reference_source_sort_order != null && (
                        <p className="text-[10px] text-[#9B30FF]/90">
                          Plan chain: using finished output from post {post.reference_source_sort_order + 1} when ready (overrides library pick below).
                        </p>
                      )}
                      {post.reference_external_url?.trim() && (
                        <p className="text-[10px] text-[#888] break-all">
                          Public can/asset URL: {truncateLabel(post.reference_external_url.trim(), 72)}
                        </p>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#888]">Base image from prior post</label>
                        <select
                          value={post.reference_source_sort_order ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            onUpdatePost(post.id, {
                              reference_source_sort_order: v === '' ? null : Number(v),
                            })
                          }}
                          disabled={isCurrentlyGenerating}
                          className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                        >
                          <option value="">None</option>
                          {flow.flow_posts
                            .filter((p) => p.sort_order < post.sort_order)
                            .map((prior) => (
                              <option key={prior.sort_order} value={prior.sort_order}>
                                Post {prior.sort_order + 1}: {truncateLabel(prior.concept, 32)}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#888]">Library or finished queue image</label>
                        <select
                          value={post.reference_media_id ?? ''}
                          onChange={(e) =>
                            onUpdatePost(post.id, { reference_media_id: e.target.value || null })
                          }
                          disabled={isCurrentlyGenerating}
                          className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                        >
                          <option value="">None</option>
                          {buildVideoFrameMediaOptions(flow, post, libraryMedia).map((o) => (
                            <option key={`img-${o.id}`} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {post.generation_mode === 'video' && videoModelIsTextToVideoOnly(videoModelId) && (
                    <p className="text-[10px] text-[#666]">
                      Text-to-video: no frame images required. Aspect ratio follows the size preset above.
                    </p>
                  )}
                  {post.generation_mode === 'video' && !videoModelIsTextToVideoOnly(videoModelId) && (
                    <div className="space-y-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]/50 p-3">
                      <p className="text-[10px] font-medium text-[#A0A0A0]">
                        Frame sources
                      </p>
                      <p className="text-[10px] text-[#666] leading-relaxed">
                        Use images from earlier posts in this flow (after they finish generating) or from your library. Required fields depend on the video model.
                      </p>
                      {(post.reference_source_sort_order != null || post.end_frame_source_sort_order != null) && (
                        <p className="text-[10px] text-[#9B30FF]/90 leading-relaxed">
                          Plan chain: prior-line output takes priority over the start/end picks below when that output is ready.
                        </p>
                      )}
                      {post.reference_external_url?.trim() && (
                        <p className="text-[10px] text-[#888] break-all">
                          Public start URL (if no prior-line start): {truncateLabel(post.reference_external_url.trim(), 64)}
                        </p>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#888]">Start frame from prior post (by plan order)</label>
                        <select
                          value={post.reference_source_sort_order ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            onUpdatePost(post.id, {
                              reference_source_sort_order: v === '' ? null : Number(v),
                            })
                          }}
                          disabled={isCurrentlyGenerating}
                          className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                        >
                          <option value="">None</option>
                          {flow.flow_posts
                            .filter((p) => p.sort_order < post.sort_order)
                            .map((prior) => (
                              <option key={prior.sort_order} value={prior.sort_order}>
                                Post {prior.sort_order + 1}: {truncateLabel(prior.concept, 32)}
                              </option>
                            ))}
                        </select>
                      </div>
                      {videoModelRequiresFirstAndLastFrame(videoModelId) && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[#888]">End frame from prior post</label>
                          <select
                            value={post.end_frame_source_sort_order ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              onUpdatePost(post.id, {
                                end_frame_source_sort_order: v === '' ? null : Number(v),
                              })
                            }}
                            disabled={isCurrentlyGenerating}
                            className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                          >
                            <option value="">None</option>
                            {flow.flow_posts
                              .filter((p) => p.sort_order < post.sort_order)
                              .map((prior) => (
                                <option key={`ev-${prior.sort_order}`} value={prior.sort_order}>
                                  Post {prior.sort_order + 1}: {truncateLabel(prior.concept, 32)}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#888]">Start frame (library or finished queue)</label>
                        <select
                          value={post.reference_media_id ?? ''}
                          onChange={(e) =>
                            onUpdatePost(post.id, {
                              reference_media_id: e.target.value || null,
                            })
                          }
                          disabled={isCurrentlyGenerating}
                          className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                        >
                          <option value="">None selected</option>
                          {frameOptions.map((o) => (
                            <option key={`s-${o.id}`} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {videoModelRequiresFirstAndLastFrame(videoModelId) && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[#888]">End frame</label>
                          <select
                            value={post.end_reference_media_id ?? ''}
                            onChange={(e) =>
                              onUpdatePost(post.id, {
                                end_reference_media_id: e.target.value || null,
                              })
                            }
                            disabled={isCurrentlyGenerating}
                            className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[10px] text-[#A0A0A0] focus:outline-none focus:border-[#9B30FF]"
                          >
                            <option value="">None selected</option>
                            {frameOptions.map((o) => (
                              <option key={`e-${o.id}`} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
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
  onMaybe,
  onReject,
  onRegenerate,
  onExport,
  previewPost,
  setPreviewPost,
  onBack,
}: {
  flow: Flow
  onApprove: (id: string) => void
  onMaybe: (id: string) => void
  onReject: (id: string) => void
  onRegenerate: (post: FlowPost) => void
  onExport: () => void
  previewPost: FlowPost | null
  setPreviewPost: (post: FlowPost | null) => void
  onBack: () => void
}) {
  const completedPosts = flow.flow_posts
    .filter((p) => ['complete', 'approved', 'rejected', 'maybe'].includes(p.status))
    .sort((a, b) => a.sort_order - b.sort_order)

  const approvedCount = flow.flow_posts.filter((p) => p.status === 'approved').length
  const maybeCount = flow.flow_posts.filter((p) => p.status === 'maybe').length
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
          <span className="text-xs text-[#666]">
            {approvedCount}/{totalCompleted} approved
            {maybeCount > 0 ? (
              <span className="text-[#C9A227]"> · {maybeCount} maybe</span>
            ) : null}
          </span>
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
                  post.status === 'maybe' ? 'border-[#C9A227]/40' :
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

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => onApprove(post.id)}
                    className={cn(
                      'flex-1 min-w-[4.5rem] flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                      post.status === 'approved'
                        ? 'bg-[#4A7C0F] text-white'
                        : 'bg-[#4A7C0F]/10 text-[#4A7C0F] hover:bg-[#4A7C0F]/20'
                    )}
                  >
                    <Check className="w-3 h-3" />
                    {post.status === 'approved' ? 'Approved' : 'Approve'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onMaybe(post.id)}
                    disabled={post.status === 'maybe'}
                    className={cn(
                      'flex-1 min-w-[4.5rem] flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50',
                      post.status === 'maybe'
                        ? 'bg-[#C9A227] text-black'
                        : 'bg-[#C9A227]/10 text-[#E8C547] hover:bg-[#C9A227]/20'
                    )}
                  >
                    <HelpCircle className="w-3 h-3" />
                    Maybe
                  </button>

                  <button
                    onClick={() => onReject(post.id)}
                    className={cn(
                      'flex-1 min-w-[4.5rem] flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all',
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
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => { onApprove(previewPost.id); setPreviewPost(null) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#4A7C0F]/10 text-[#4A7C0F] hover:bg-[#4A7C0F]/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={previewPost.status === 'maybe'}
                  onClick={() => { onMaybe(previewPost.id); setPreviewPost(null) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#C9A227]/10 text-[#E8C547] hover:bg-[#C9A227]/20 transition-all disabled:opacity-40"
                >
                  <HelpCircle className="w-4 h-4" />
                  Maybe
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
