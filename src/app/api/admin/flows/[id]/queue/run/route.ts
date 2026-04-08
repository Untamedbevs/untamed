import { createAdminClient } from '@/lib/supabase/admin'
import {
  countPendingOrRejected,
  flowGenerationComplete,
  generateFlowPostJoined,
  loadFlowPostsJoined,
  pickNextRunnablePost,
} from '@/lib/flow/generate-flow-post'
import { NextRequest, NextResponse } from 'next/server'

type StepResult =
  | {
      kind: 'ran'
      postId: string
      sortOrder: number
      mediaUrl?: string
      error?: string
      /** Fal queue / inference request id (for dashboard & support) */
      falRequestId?: string
      falModel?: string
    }
  | { kind: 'blocked'; pendingLeft: number; message: string }
  | { kind: 'idle'; message: string }

const DEFAULT_MAX_STEPS = 40
const ABS_MAX_STEPS = 80

/**
 * Runs segments strictly in sort_order, one at a time.
 * Each segment starts only after the previous runnable one has finished (Fal + S3 + DB),
 * so chained references always see the prior segment's output.
 *
 * Body: { maxSteps?: number } — max segment jobs this request (default 40, max 80).
 * Ignores legacy maxConcurrent if sent.
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

  let body: { maxSteps?: number } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body */
  }

  const maxSteps = Math.min(
    Math.max(Number(body.maxSteps) || DEFAULT_MAX_STEPS, 1),
    ABS_MAX_STEPS
  )

  await supabase.from('flows').update({ status: 'generating' }).eq('id', flowId)

  const steps: StepResult[] = []
  let completedThisRequest = 0

  for (let i = 0; i < maxSteps; i++) {
    const posts = await loadFlowPostsJoined(supabase, flowId)

    if (flowGenerationComplete(posts)) {
      await supabase.from('flows').update({ status: 'reviewing' }).eq('id', flowId)
      steps.push({ kind: 'idle', message: 'All segments are complete or approved.' })
      break
    }

    const next = pickNextRunnablePost(posts)
    if (!next) {
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

    const result = await generateFlowPostJoined(supabase, next, posts)
    completedThisRequest += 1

    if (!result.ok) {
      steps.push({
        kind: 'ran',
        postId: next.id,
        sortOrder: next.sort_order,
        error: result.error,
      })
      break
    }

    steps.push({
      kind: 'ran',
      postId: next.id,
      sortOrder: next.sort_order,
      mediaUrl: result.media.url,
      falRequestId: result.request_id,
      falModel: result.fal_model,
    })
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
    !pickNextRunnablePost(finalPosts)
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
    maxSteps,
  })
}
