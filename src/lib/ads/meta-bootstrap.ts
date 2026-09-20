import {
  FL_RETAIL_CAMPAIGNS,
  type FlRetailCampaignSpec,
  trackedLandingUrl,
} from './fl-retail-structure'
import { listCampaigns, type MetaCampaign } from './meta-client'
import { getMetaPixelId, metaGet, metaPost, requireMetaAdAccountId } from './meta-graph'

interface GeoSearchRow {
  key: string
  name: string
  type?: string
  country_code?: string
}

interface InterestSearchRow {
  id: string
  name: string
  audience_size_lower_bound?: number
}

export interface BootstrapResult {
  created: Array<{ key: string; campaignId: string; adSetId: string; landingUrl: string }>
  skipped: Array<{ key: string; campaignId: string; reason: string }>
  errors: Array<{ key: string; error: string }>
}

async function resolveFloridaRegion(): Promise<{ key: string; name: string }> {
  const result = await metaGet<{ data?: GeoSearchRow[] }>('search', {
    type: 'adgeolocation',
    q: 'Florida',
    location_types: JSON.stringify(['region']),
  })
  const match =
    result.data?.find((row) => row.name === 'Florida' && row.country_code === 'US') ||
    result.data?.find((row) => row.name === 'Florida')
  if (!match) throw new Error('Could not resolve Florida geo targeting from Meta')
  return { key: match.key, name: match.name }
}

async function resolveInterests(queries: string[]): Promise<Array<{ id: string; name: string }>> {
  const found: Array<{ id: string; name: string }> = []
  const seen = new Set<string>()

  for (const query of queries) {
    try {
      const result = await metaGet<{ data?: InterestSearchRow[] }>('search', {
        type: 'adinterest',
        q: query,
        limit: '3',
      })
      const row = result.data?.[0]
      if (row && !seen.has(row.id)) {
        seen.add(row.id)
        found.push({ id: row.id, name: row.name })
      }
    } catch {
      // Interest search is optional — Advantage+ geo still delivers
    }
  }

  return found
}

function buildTargeting(
  floridaKey: string,
  interests: Array<{ id: string; name: string }>
): Record<string, unknown> {
  const targeting: Record<string, unknown> = {
    geo_locations: {
      regions: [{ key: floridaKey }],
      location_types: ['home', 'recent'],
    },
    age_min: 21,
    age_max: 65,
    targeting_automation: {
      advantage_audience: 1,
    },
  }

  if (interests.length > 0) {
    targeting.flexible_spec = [{ interests }]
  }

  return targeting
}

async function createPausedCampaign(spec: FlRetailCampaignSpec): Promise<{ id: string }> {
  return metaPost<{ id: string }>(`${requireMetaAdAccountId()}/campaigns`, {
    name: spec.name,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    special_ad_categories: [],
    daily_budget: spec.dailyBudgetCents,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    buying_type: 'AUCTION',
  })
}

async function createPausedAdSet(opts: {
  spec: FlRetailCampaignSpec
  campaignId: string
  floridaKey: string
  interests: Array<{ id: string; name: string }>
}): Promise<{ id: string }> {
  const pixelId = getMetaPixelId()
  const payload: Record<string, unknown> = {
    campaign_id: opts.campaignId,
    name: `${opts.spec.name} | FL 21+`,
    status: 'PAUSED',
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    destination_type: 'WEBSITE',
    targeting: buildTargeting(opts.floridaKey, opts.interests),
  }

  if (pixelId) {
    payload.promoted_object = {
      pixel_id: pixelId,
      custom_event_type: 'LEAD',
    }
  }

  return metaPost<{ id: string }>(`${requireMetaAdAccountId()}/adsets`, payload)
}

export async function bootstrapFlRetailCampaigns(): Promise<BootstrapResult> {
  const existing = await listCampaigns(200)
  const byName = new Map(existing.map((campaign) => [campaign.name, campaign]))
  const florida = await resolveFloridaRegion()

  const created: BootstrapResult['created'] = []
  const skipped: BootstrapResult['skipped'] = []
  const errors: BootstrapResult['errors'] = []

  for (const spec of FL_RETAIL_CAMPAIGNS) {
    const already = byName.get(spec.name)
    if (already) {
      skipped.push({
        key: spec.key,
        campaignId: already.id,
        reason: 'Campaign with this name already exists',
      })
      continue
    }

    try {
      const interests = await resolveInterests(spec.interestQueries)
      const campaign = await createPausedCampaign(spec)
      const adSet = await createPausedAdSet({
        spec,
        campaignId: campaign.id,
        floridaKey: florida.key,
        interests,
      })
      created.push({
        key: spec.key,
        campaignId: campaign.id,
        adSetId: adSet.id,
        landingUrl: trackedLandingUrl(spec),
      })
    } catch (error) {
      errors.push({
        key: spec.key,
        error: error instanceof Error ? error.message : 'Create failed',
      })
    }
  }

  return { created, skipped, errors }
}

export function existingFlRetailCampaigns(campaigns: MetaCampaign[]): MetaCampaign[] {
  const names = new Set(FL_RETAIL_CAMPAIGNS.map((spec) => spec.name))
  return campaigns.filter((campaign) => names.has(campaign.name))
}
