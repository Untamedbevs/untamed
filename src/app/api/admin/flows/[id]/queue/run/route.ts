import { createAdminClient } from '@/lib/supabase/admin'
import {
  countPendingOrRejected,
  flowGenerationComplete,
  generateFlowPostJoined,
  loadFlowPostsJoined,
  pickAllRunnablePosts,
} from '@/lib/flow/generate-flow-post'
import { NextRequest, NextResponse } from 'next/server'

type StepResult =
  | { kind: 'ran'; postId: string; sortOrder: number; mediaUrl?: string; error?: string }
  | { kind: 'blocked'; pendingLeft: number; message: string }
  | { kind: 'idle'; message: string }

const DEFAULT_MAX_STEPS = 40
const DEFAULT_MAX_CONCURRENT = 8
const ABS_MAX_STEPS = 80
const ABS_MAX_CONCURRENT = 24

/**
 * Runs segments in dependency-aware parallel waves:
 * - Skips segments that are already complete/approved (not pending/rejected).
 * - Any segment whose deps are ready runs together in one wave (up to maxConcurrent).
 * - Chained lines (prior output required) wait until that output exists with an image URL, then run in a later wave.
 *
 * Body: { maxSteps?: number, maxConcurrent?: number }
 * - maxSteps: max segment completions this request (default 40, max 80)
 * - maxConcurrent: max parallel Fal jobs per wave (default 8, max 24)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flowId } = await params
  const supabase = createAdminClient()

  const { data: flowRow, error: flowErr } = await supabase
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .single()

  if (flowErr || !flowRow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 })
  }

  let body: { maxSteps?: number; maxConcurrent?: number } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body */
  }

  const maxSteps = Math.min(
    Math.max(Number(body.maxSteps) || DEFAULT_MAX_STEPS, 1),
    ABS_MAX_STEPS
  )
  const maxConcurrent = Math.min(
    Math.max(Number(body.maxConcurrent) || DEFAULT_MAX_CONCURRENT, 1),
    ABS_MAX_CONCURRENT
  )

  await supabase.from('flows').update({ status: 'generating' }).eq('id', flowId)

  const steps: StepResult[] = []
  let completedThisRequest = 0
  let waveIndex = 0
  const maxWaves = 60

  while (completedThisRequest < maxSteps && waveIndex < maxWaves) {
    waveIndex += 1
    const posts = await loadFlowPostsJoined(supabase, flowId)

    if (flowGenerationComplete(posts)) {
      await supabase.from('flows').update({ status: 'reviewing' }).eq('id', flowId)
      steps.push({ kind: 'idle', message: 'All segments are complete or approved.' })
      break
    }

    const runnable = pickAllRunnablePosts(posts)
    if (runnable.length === 0) {
      const pendingLeft = countPendingOrRejected(posts)
      steps.push({
        kind: 'blocked',
        pendingLeft,
        message:
          pendingLeft > 0
            ? 'Waiting on dependencies (e.g. a prior segment must finish first), or a segment is stuck in generating. Use Reset stuck on the flow page if needed.'
            : 'Nothing to run.',
      })
      break
    }

    const remainingBudget = maxSteps - completedThisRequest
    const batchSize = Math.min(runnable.length, maxConcurrent, remainingBudget)
    const batch = runnable.slice(0, batchSize)

    const settled = await Promise.allSettled(
      batch.map((p) => generateFlowPostJoined(supabase, p, posts))
    )

    let waveError = false
    for (let idx = 0; idx < batch.length; idx++) {
      const p = batch[idx]
      const s = settled[idx]
      if (s.status === 'fulfilled') {
        const r = s.value
        if (r.ok) {
          steps.push({
            kind: 'ran',
            postId: p.id,
            sortOrder: p.sort_order,
            mediaUrl: r.media.url,
          })
        } else {
          steps.push({
            kind: 'ran',
            postId: p.id,
            sortOrder: p.sort_order,
            error: r.error,
          })
          waveError = true
        }
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : 'Unknown error'
        steps.push({
          kind: 'ran',
          postId: p.id,
          sortOrder: p.sort_order,
          error: msg,
        })
        waveError = true
      }
      completedThisRequest += 1
    }

    if (waveError) {
      break
    }
  }

  const finalPosts = await loadFlowPostsJoined(supabase, flowId)
  const flowComplete = flowGenerationComplete(finalPosts)
  const pendingLeft = countPendingOrRejected(finalPosts)
  const generatingLeft = finalPosts.filter((p) => p.status === 'generating').length

  if (flowComplete) {
    await supabase.from('flows').update({ status: 'reviewing' }).eq('id', flowId)
  } else if (
    pendingLeft === 0 &&
    generatingLeft === 0 &&
    pickAllRunnablePosts(finalPosts).length === 0
  ) {
    await supabase.from('flows').update({ status: 'reviewing' }).eq('id', flowId)
  }

  return NextResponse.json({
    flowId,
    steps,
    flowComplete,
    pendingLeft,
    generatingLeft,
    completedThisRequest,
    wavesRun: waveIndex,
    maxConcurrent,
    maxSteps,
  })
}
