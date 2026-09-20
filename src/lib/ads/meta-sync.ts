import { createAdminClient } from '@/lib/supabase/admin'
import { extractAction, getDailyCampaignInsights, LEAD_ACTION_TYPES } from './meta-client'

export interface MetaSpendSyncResult {
  since: string
  until: string
  upserted: number
  spend: number
  impressions: number
  clicks: number
  leads: number
}

function defaultRange(days = 30): { since: string; until: string } {
  const until = new Date()
  until.setUTCDate(until.getUTCDate() - 1)
  const since = new Date(until)
  since.setUTCDate(since.getUTCDate() - (days - 1))
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  }
}

export async function syncMetaSpendToDaily(days = 30): Promise<MetaSpendSyncResult> {
  const range = defaultRange(days)
  const rows = await getDailyCampaignInsights(range)
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('ad_spend_daily')
    .select('id, spend_date, campaign_id')
    .eq('platform', 'meta')
    .eq('source', 'meta_ads')
    .gte('spend_date', range.since)
    .lte('spend_date', range.until)

  const existingByKey = new Map(
    (existing || []).map((row) => [`${row.spend_date}:${row.campaign_id || ''}`, row.id as string])
  )

  let upserted = 0
  let spend = 0
  let impressions = 0
  let clicks = 0
  let leads = 0

  for (const row of rows) {
    const date = row.date_start
    const campaignId = row.campaign_id
    const payload = {
      spend_date: date,
      platform: 'meta' as const,
      campaign_name: row.campaign_name,
      campaign_id: campaignId,
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      source: 'meta_ads' as const,
    }

    spend += payload.spend
    impressions += payload.impressions
    clicks += payload.clicks
    leads += extractAction(row.actions, LEAD_ACTION_TYPES)

    const existingId = existingByKey.get(`${date}:${campaignId}`)
    if (existingId) {
      const { error } = await supabase.from('ad_spend_daily').update(payload).eq('id', existingId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('ad_spend_daily').insert(payload)
      if (error) throw error
    }
    upserted += 1
  }

  return { ...range, upserted, spend, impressions, clicks, leads }
}
