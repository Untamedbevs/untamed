import { createAdminClient } from '@/lib/supabase/admin'
import { daysAgoIso, isoRange, monthStartIso, todayIso, weekStartIso, yearStartIso } from './periods'

const CLIENT_ID = 'untamed'

async function orderCents(fromDay: string) {
  const { from, to } = isoRange(fromDay)
  const { data, error } = await createAdminClient()
    .from('loyalty_orders')
    .select('total_cents')
    .gte('created_at', from)
    .lte('created_at', to)
  if (error) throw new Error(error.message)
  return (data || []).reduce((s, r) => s + Number(r.total_cents || 0), 0)
}

export async function buildUntamedSnapshot() {
  const supabase = createAdminClient()
  const month = monthStartIso()
  const d30 = daysAgoIso(29)
  const notes: string[] = []

  const [today, week, d30c, ytd] = await Promise.all([
    orderCents(todayIso()),
    orderCents(weekStartIso()),
    orderCents(d30),
    orderCents(yearStartIso()),
  ])

  const { count: leads30, error: leadErr } = await supabase
    .from('distributor_leads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', isoRange(d30).from)
  if (leadErr) throw new Error(leadErr.message)

  const { data: spendRows, error: spendErr } = await supabase
    .from('ad_spend_daily')
    .select('spend, campaign_name, campaign_id, platform, spend_date')
    .gte('spend_date', month)
  if (spendErr) {
    notes.push(`ad_spend_daily: ${spendErr.message}`)
  }
  const spend = (spendRows || []).reduce((s, r) => s + Number(r.spend || 0), 0)

  const dollars = (cents: number) => cents / 100
  const metric = (
    key: string,
    period: 'today' | 'week' | '30d' | 'ytd' | 'mtd' | 'current',
    value: number,
    unit: 'usd' | 'count',
    label: string,
    ownerVisible: boolean,
    source: string
  ) => ({ key, period, value, unit, label, ownerVisible, source })

  return {
    clientId: CLIENT_ID,
    capturedAt: new Date().toISOString(),
    timezone: 'America/New_York',
    metrics: [
      metric('revenue', 'today', dollars(today), 'usd', 'Drink sales', true, 'loyalty_orders.total_cents'),
      metric('revenue', 'week', dollars(week), 'usd', 'Drink sales', true, 'loyalty_orders.total_cents'),
      metric('revenue', '30d', dollars(d30c), 'usd', 'Drink sales', true, 'loyalty_orders.total_cents'),
      metric('revenue', 'ytd', dollars(ytd), 'usd', 'Drink sales', true, 'loyalty_orders.total_cents'),
      metric('leads.count', '30d', leads30 || 0, 'count', 'Distributor leads', true, 'distributor_leads'),
      metric('ads.spend', 'mtd', spend, 'usd', 'Meta spend', false, 'ad_spend_daily'),
    ],
    ads: (spendRows || []).slice(0, 20).map((row) => ({
      platform: row.platform || 'meta',
      campaignName: row.campaign_name,
      campaignId: row.campaign_id,
      spend: Number(row.spend || 0),
      period: 'mtd',
      resultLabel: 'leads',
    })),
    health: { ok: notes.length === 0, notes },
  }
}
