import {
  getMetaAdAccountId,
  getMetaPixelId,
  isMetaAdsConfigured,
  metaGet,
  metaGetAll,
  metaPost,
  requireMetaAdAccountId,
} from './meta-graph'

export interface MetaAdAccount {
  id: string
  name: string
  account_status: number
  currency: string
  timezone_name?: string
  disable_reason?: number
  business?: { id: string; name: string }
}

export interface MetaCampaign {
  id: string
  name: string
  objective: string
  status: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  bid_strategy?: string
  start_time?: string
  created_time?: string
  special_ad_categories?: string[]
}

export interface MetaAdSet {
  id: string
  name: string
  campaign_id: string
  status: string
  effective_status: string
  daily_budget?: string
  optimization_goal?: string
  targeting?: Record<string, unknown>
  promoted_object?: Record<string, unknown>
}

export interface MetaAd {
  id: string
  name: string
  adset_id: string
  campaign_id: string
  status: string
  effective_status: string
  creative?: { id: string }
}

export interface MetaInsights {
  spend: string
  impressions: string
  clicks: string
  ctr?: string
  cpc?: string
  cpm?: string
  reach?: string
  actions?: Array<{ action_type: string; value: string }>
  cost_per_action_type?: Array<{ action_type: string; value: string }>
  date_start: string
  date_stop: string
}

export interface MetaTokenDebug {
  is_valid: boolean
  scopes: string[]
  expires_at: number | null
  data_access_expires_at: number | null
  type?: string
}

const ACCOUNT_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_RISK_REVIEW',
  8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_CLOSURE',
  101: 'CLOSED',
  201: 'ANY_ACTIVE',
  202: 'ANY_CLOSED',
}

const CAMPAIGN_FIELDS =
  'id,name,objective,status,effective_status,daily_budget,lifetime_budget,bid_strategy,start_time,created_time,special_ad_categories'

const ADSET_FIELDS =
  'id,name,campaign_id,status,effective_status,daily_budget,optimization_goal,targeting,promoted_object'

const AD_FIELDS = 'id,name,adset_id,campaign_id,status,effective_status,creative{id}'

const INSIGHT_FIELDS =
  'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,actions,cost_per_action_type,date_start,date_stop'

const REQUIRED_SCOPES = ['ads_management', 'ads_read']

export function accountStatusLabel(status: number | undefined): string {
  if (status == null) return 'UNKNOWN'
  return ACCOUNT_STATUS[status] || `STATUS_${status}`
}

export async function debugAccessToken(): Promise<MetaTokenDebug> {
  const result = await metaGet<{
    data?: {
      is_valid?: boolean
      scopes?: string[]
      expires_at?: number
      data_access_expires_at?: number
      type?: string
    }
  }>('debug_token', {
    input_token: process.env.META_ACCESS_TOKEN || process.env.META_CAPI_ACCESS_TOKEN || '',
  })
  const data = result.data || {}
  return {
    is_valid: Boolean(data.is_valid),
    scopes: data.scopes || [],
    expires_at: data.expires_at || null,
    data_access_expires_at: data.data_access_expires_at || null,
    type: data.type,
  }
}

export async function getAdAccount(): Promise<MetaAdAccount> {
  return metaGet<MetaAdAccount>(requireMetaAdAccountId(), {
    fields: 'id,name,account_status,currency,timezone_name,disable_reason,business{id,name}',
  })
}

export async function listPixels(): Promise<Array<{ id: string; name?: string }>> {
  const accountId = requireMetaAdAccountId()
  const result = await metaGet<{ data?: Array<{ id: string; name?: string }> }>(
    `${accountId}/adspixels`,
    { fields: 'id,name' }
  )
  return result.data || []
}

export async function testMetaAdsConnection(): Promise<{
  configured: boolean
  ok: boolean
  account?: { id: string; name: string; status: string; currency: string; business?: string }
  pixel?: { id: string; name?: string; matched: boolean }
  token?: MetaTokenDebug
  missingScopes: string[]
  error?: string
}> {
  if (!isMetaAdsConfigured()) {
    return { configured: false, ok: false, missingScopes: REQUIRED_SCOPES, error: 'Credentials not set' }
  }

  try {
    const [account, token, pixels] = await Promise.all([
      getAdAccount(),
      debugAccessToken().catch(() => null),
      listPixels().catch(() => []),
    ])

    const configuredPixel = getMetaPixelId()
    const matchedPixel = configuredPixel
      ? pixels.find((p) => p.id === configuredPixel)
      : pixels[0]

    const scopes = token?.scopes || []
    const missingScopes = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope))

    return {
      configured: true,
      ok: Boolean(token?.is_valid !== false && account.id),
      account: {
        id: account.id,
        name: account.name,
        status: accountStatusLabel(account.account_status),
        currency: account.currency,
        business: account.business?.name,
      },
      pixel: matchedPixel
        ? { id: matchedPixel.id, name: matchedPixel.name, matched: Boolean(configuredPixel) }
        : configuredPixel
          ? { id: configuredPixel, matched: false }
          : undefined,
      token: token || undefined,
      missingScopes,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      missingScopes: [],
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

export async function listCampaigns(limit = 100): Promise<MetaCampaign[]> {
  return metaGetAll<MetaCampaign>(`${requireMetaAdAccountId()}/campaigns`, {
    fields: CAMPAIGN_FIELDS,
    limit: String(limit),
  })
}

export async function listAdSets(campaignId: string): Promise<MetaAdSet[]> {
  return metaGetAll<MetaAdSet>(`${campaignId}/adsets`, { fields: ADSET_FIELDS })
}

export async function listAds(adSetId: string): Promise<MetaAd[]> {
  return metaGetAll<MetaAd>(`${adSetId}/ads`, { fields: AD_FIELDS })
}

export async function getInsights(
  entityId: string,
  datePreset = 'last_30d'
): Promise<MetaInsights[]> {
  const result = await metaGet<{ data?: MetaInsights[] }>(`${entityId}/insights`, {
    fields: INSIGHT_FIELDS,
    date_preset: datePreset,
  })
  return result.data || []
}

export async function getDailyCampaignInsights(range: {
  since: string
  until: string
}): Promise<
  Array<
    MetaInsights & {
      campaign_id: string
      campaign_name: string
    }
  >
> {
  return metaGetAll(`${requireMetaAdAccountId()}/insights`, {
    fields: INSIGHT_FIELDS,
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: range.since, until: range.until }),
  })
}

export function extractAction(
  actions: Array<{ action_type: string; value: string }> | undefined,
  types: string[]
): number {
  if (!actions) return 0
  return actions.reduce((sum, action) => {
    if (types.includes(action.action_type)) return sum + Number(action.value || 0)
    return sum
  }, 0)
}

export const LEAD_ACTION_TYPES = [
  'offsite_conversion.fb_pixel_lead',
  'lead',
  'onsite_conversion.lead',
]

export async function updateEntityStatus(
  entityId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<{ success: boolean }> {
  return metaPost<{ success: boolean }>(entityId, { status })
}

export function getAdAccountIdRaw(): string | null {
  const id = getMetaAdAccountId()
  return id ? id.replace(/^act_/, '') : null
}
