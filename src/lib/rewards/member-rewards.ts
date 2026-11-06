import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CLAIM_COLUMNS,
  loadMilestones,
  milestoneStates,
  trailPointsFor,
  type Milestone,
  type MilestoneClaim,
  type MilestoneState,
} from './catalog'

export interface MemberTrail {
  points: number
  stops: { milestone: Milestone; state: MilestoneState }[]
  claims: (MilestoneClaim & { milestone_title: string | null })[]
  next: Milestone | null
  /** Points of the last milestone reached, or 0 before the first. */
  previousThreshold: number
  claimable: number
}

/** A member's place on the points trail, for the portal pages. Server only. */
export async function loadMemberTrail(admin: SupabaseClient, memberId: string): Promise<MemberTrail> {
  const [points, milestones, { data: claimRows }] = await Promise.all([
    trailPointsFor(admin, memberId),
    loadMilestones(admin),
    admin
      .from('reward_milestone_claims')
      .select(`${CLAIM_COLUMNS}, milestone:reward_milestones(title)`)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false }),
  ])
  const claims = ((claimRows || []) as unknown as (MilestoneClaim & { milestone: { title: string } | null })[]).map(
    ({ milestone, ...c }) => ({ ...c, milestone_title: milestone?.title ?? null })
  )
  const stops = milestoneStates(points, milestones, claims)
  const reached = milestones.filter((m) => m.points <= points)
  return {
    points,
    stops,
    claims,
    next: milestones.find((m) => m.points > points) ?? null,
    previousThreshold: reached.length ? reached[reached.length - 1].points : 0,
    claimable: stops.filter((s) => s.state === 'claimable').length,
  }
}
