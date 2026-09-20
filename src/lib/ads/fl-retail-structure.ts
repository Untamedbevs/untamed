export const FL_RETAIL_STRUCTURE_VERSION = 1

export interface FlRetailCampaignSpec {
  key: 'bars' | 'liquor' | 'distributors'
  name: string
  utmCampaign: string
  landingPath: string
  dailyBudgetCents: number
  audience: string
  interestQueries: string[]
  headline: string
  primaryText: string
}

/**
 * First paid Meta structure: Florida retail leads into the three campaign LPs.
 * Budgets match the briefing mix (~$76/day Meta share of the $3,500/month proof unit).
 * Campaigns are created PAUSED. Alcohol targeting is age 21+.
 */
export const FL_RETAIL_CAMPAIGNS: FlRetailCampaignSpec[] = [
  {
    key: 'bars',
    name: 'Untamed | FL Retail | Bars',
    utmCampaign: 'fl_retail_bars',
    landingPath: '/lp/retail/bars',
    dailyBudgetCents: 3500,
    audience: 'Florida bar managers, beverage directors, and restaurant owners',
    interestQueries: ['bartender', 'restaurant', 'hospitality', 'nightlife'],
    headline: 'Premium Martinis, Simplified',
    primaryText:
      'Chill. Shake. Pour. A real martini that keeps up with the ticket printer — two pours per can, consistent every shift. Samples available.',
  },
  {
    key: 'liquor',
    name: 'Untamed | FL Retail | Liquor',
    utmCampaign: 'fl_retail_liquor',
    landingPath: '/lp/retail/liquor',
    dailyBudgetCents: 2500,
    audience: 'Florida liquor store owners and buyers',
    interestQueries: ['liquor store', 'wine and spirits', 'craft cocktails'],
    headline: '1 can. 2 martinis. About $3 a cocktail.',
    primaryText:
      'Carry Untamed: a tight four-SKU lineup with a clear shelf story. Premium cocktail credentials without a discount war.',
  },
  {
    key: 'distributors',
    name: 'Untamed | FL Retail | Distributors',
    utmCampaign: 'fl_retail_distributors',
    landingPath: '/lp/retail/distributors',
    dailyBudgetCents: 1600,
    audience: 'Florida distributor principals and chain managers',
    interestQueries: ['wholesale', 'beverage distribution', 'foodservice'],
    headline: 'A Brand That Sells Itself',
    primaryText:
      'Ready-to-serve is the growth lane. Untamed sits at the premium end — four SKUs, launch support, and accounts that ask for it by name.',
  },
]

export const SITE_ORIGIN = 'https://untamedbevs.com'

export function trackedLandingUrl(spec: FlRetailCampaignSpec): string {
  const url = new URL(spec.landingPath, SITE_ORIGIN)
  url.searchParams.set('utm_source', 'meta')
  url.searchParams.set('utm_medium', 'cpc')
  url.searchParams.set('utm_campaign', spec.utmCampaign)
  url.searchParams.set('utm_content', spec.key)
  return url.toString()
}

export function dailyBudgetDollars(cents: number): number {
  return cents / 100
}

export const FL_RETAIL_TOTAL_DAILY_CENTS = FL_RETAIL_CAMPAIGNS.reduce(
  (sum, spec) => sum + spec.dailyBudgetCents,
  0
)
