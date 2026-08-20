/**
 * Owner briefing — retail lead throughput model.
 * All figures are management projections for internal discussion.
 * Conservative / base / upside are labeled as such throughout the deck.
 */

export const DISCLAIMER =
  'Internal projections for owner discussion. Not a guarantee. 90-day proof period. Subject to creative, geo, and closer follow-up.'

export const UNIT_COST = 3500
export const TEAM_COST = 7000
export const SHELF_VELOCITY = 3125
export const DOOR_VELOCITY = SHELF_VELOCITY
export const CASES_PER_ORDER = 2
export const SLA_HOURS = 48

export const COLORS = {
  gold: '#FFD700',
  orange: '#FF8C2A',
  purple: '#9B30FF',
  green: '#6B8E23',
  muted: '#8E8E8E',
  red: '#ef4444',
} as const

export interface FunnelScenario {
  name: string
  color: string
  spend: number
  impressions: number
  ctr: number
  clicks: number
  cpc: number
  lpCvr: number
  leads: number
  cpl: number
  contactRate: number
  contacted: number
  qualifyRate: number
  qualified: number
  convertRate: number
  doors: number
  shelves: number
  costPerDoor: number
  costPerShelf: number
  annualVelocity: number
}

function funnel(partial: Omit<FunnelScenario, 'clicks' | 'cpc' | 'leads' | 'cpl' | 'contacted' | 'qualified' | 'doors' | 'shelves' | 'costPerDoor' | 'costPerShelf' | 'annualVelocity'>): FunnelScenario {
  const clicks = Math.round(partial.impressions * partial.ctr)
  const cpc = clicks > 0 ? partial.spend / clicks : 0
  const leads = Math.round(clicks * partial.lpCvr)
  const cpl = leads > 0 ? partial.spend / leads : 0
  const contacted = Math.round(leads * partial.contactRate)
  const qualified = Math.round(contacted * partial.qualifyRate)
  const shelves = Math.round(qualified * partial.convertRate)
  const costPerShelf = shelves > 0 ? partial.spend / shelves : 0
  const annualVelocity = shelves * SHELF_VELOCITY
  return {
    ...partial,
    clicks,
    cpc,
    leads,
    cpl,
    contacted,
    qualified,
    doors: shelves,
    shelves,
    costPerDoor: costPerShelf,
    costPerShelf,
    annualVelocity,
  }
}

/** $3,500 / month media — one salesperson unit */
export const UNIT_FUNNELS: FunnelScenario[] = [
  funnel({
    name: 'Conservative',
    color: COLORS.muted,
    spend: UNIT_COST,
    impressions: 90000,
    ctr: 0.009,
    lpCvr: 0.04,
    contactRate: 0.8,
    qualifyRate: 0.3,
    convertRate: 0.25,
  }),
  funnel({
    name: 'Base',
    color: COLORS.gold,
    spend: UNIT_COST,
    impressions: 140000,
    ctr: 0.011,
    lpCvr: 0.06,
    contactRate: 0.9,
    qualifyRate: 0.3,
    convertRate: 0.25,
  }),
  funnel({
    name: 'Upside',
    color: COLORS.purple,
    spend: UNIT_COST,
    impressions: 180000,
    ctr: 0.014,
    lpCvr: 0.08,
    contactRate: 0.9,
    qualifyRate: 0.35,
    convertRate: 0.3,
  }),
]

export const BASE_UNIT = UNIT_FUNNELS[1]
export const CONSERVATIVE_UNIT = UNIT_FUNNELS[0]
export const UPSIDE_UNIT = UNIT_FUNNELS[2]

function scaleFunnel(base: FunnelScenario, spend: number, shelfMultiplier: number): FunnelScenario {
  const ratio = spend / base.spend
  const impressions = Math.round(base.impressions * ratio)
  const clicks = Math.round(base.clicks * ratio)
  const leads = Math.round(base.leads * ratio)
  const contacted = Math.round(base.contacted * ratio)
  const qualified = Math.round(base.qualified * ratio)
  const shelves = Math.round(base.shelves * shelfMultiplier)
  const costPerShelf = shelves > 0 ? spend / shelves : 0
  return {
    ...base,
    spend,
    impressions,
    clicks,
    cpc: clicks > 0 ? spend / clicks : 0,
    leads,
    cpl: leads > 0 ? spend / leads : 0,
    contacted,
    qualified,
    doors: shelves,
    shelves,
    costPerDoor: costPerShelf,
    costPerShelf,
    annualVelocity: shelves * SHELF_VELOCITY,
  }
}

/**
 * Scale media vs the $7k sales team.
 * At $7k+, shelves do not double linearly — CMO capacity is the bottleneck
 * unless a closer is added. $7k uses 1.7x shelves; $15k assumes a closer (3.2x).
 */
export const SCALE_ROWS = [
  {
    label: '1 salesperson',
    spend: UNIT_COST,
    kind: 'sales' as const,
    doors: 0,
    shelves: 0,
    costPerDoor: null as number | null,
    costPerShelf: null as number | null,
    annualVelocity: 0,
    note: 'Unmeasured walk-ins. Current output ~0.',
  },
  {
    label: 'Machine @ $3,500',
    spend: UNIT_COST,
    kind: 'machine' as const,
    doors: BASE_UNIT.shelves,
    shelves: BASE_UNIT.shelves,
    costPerDoor: BASE_UNIT.costPerShelf,
    costPerShelf: BASE_UNIT.costPerShelf,
    annualVelocity: BASE_UNIT.annualVelocity,
    note: 'Inbound, attributed, 48h SLA.',
  },
  {
    label: '2 salespeople',
    spend: TEAM_COST,
    kind: 'sales' as const,
    doors: 0,
    shelves: 0,
    costPerDoor: null as number | null,
    costPerShelf: null as number | null,
    annualVelocity: 0,
    note: 'Current $7,000 / month. Still ~0.',
  },
  {
    label: 'Machine @ $7,000',
    spend: TEAM_COST,
    kind: 'machine' as const,
    ...(() => {
      const s = scaleFunnel(BASE_UNIT, TEAM_COST, 1.7)
      return { doors: s.shelves, shelves: s.shelves, costPerDoor: s.costPerShelf, costPerShelf: s.costPerShelf, annualVelocity: s.annualVelocity }
    })(),
    note: 'More media. Same closer. Capacity starts to bind.',
  },
  {
    label: 'Machine @ $15,000',
    spend: 15000,
    kind: 'machine' as const,
    ...(() => {
      const s = scaleFunnel(BASE_UNIT, 15000, 3.2)
      return { doors: s.shelves, shelves: s.shelves, costPerDoor: s.costPerShelf, costPerShelf: s.costPerShelf, annualVelocity: s.annualVelocity }
    })(),
    note: 'Add a closer to work inbound. Do not add another walker.',
  },
]

export const SCALE_FUNNELS = {
  seven: scaleFunnel(BASE_UNIT, TEAM_COST, 1.7),
  fifteen: scaleFunnel(BASE_UNIT, 15000, 3.2),
}

export const FUNNEL_STEPS = [
  { key: 'spend', label: 'Spend', unit: '$' },
  { key: 'impressions', label: 'Impressions', unit: '' },
  { key: 'clicks', label: 'Clicks', unit: '' },
  { key: 'leads', label: 'Leads', unit: '' },
  { key: 'contacted', label: 'Contacted', unit: '' },
  { key: 'qualified', label: 'Qualified', unit: '' },
  { key: 'doors', label: 'Shelves', unit: '' },
] as const

export const THROUGHPUT = [
  {
    step: '01',
    title: 'Build the click',
    body: 'Every paid ad gets a tracked URL before a dollar spends.',
    links: [
      { href: '/admin/retail/utm-builder', label: 'UTM builder', hint: 'The link you paste into Meta, Google, or LinkedIn' },
      { href: '/admin/studio', label: 'Studio', hint: 'Make the creative without an agency' },
      { href: '/admin/campaigns', label: 'Campaigns', hint: 'Schedule what goes live' },
    ],
  },
  {
    step: '02',
    title: 'Ads go to these pages',
    body: 'Buyer clicks the ad and lands here. One form. 48-hour promise.',
    links: [
      { href: '/lp/retail/bars', label: 'Bars & restaurants', hint: 'Paid — on-premise' },
      { href: '/lp/retail/liquor', label: 'Liquor stores', hint: 'Paid — off-premise' },
      { href: '/lp/retail/distributors', label: 'Distributors', hint: 'Paid — wholesale' },
      { href: '/present/on-premise', label: 'On-premise deck', hint: 'Pitch the bar or restaurant owner in the room' },
      { href: '/present/off-premise', label: 'Off-premise deck', hint: 'Pitch the liquor store owner in the room' },
      { href: '/retail', label: 'Retail', hint: 'Organic and referral wholesale page' },
      { href: '/distribute', label: 'Distribute', hint: 'Referral-tracked B2B pitch' },
    ],
  },
  {
    step: '03',
    title: 'Leads go here',
    body: 'The form writes the record, emails Joe, and starts the 48-hour clock.',
    links: [
      { href: '/admin/retail', label: 'Workbench', hint: 'Kanban, SLA, which ad created them' },
      { href: '/admin/retail/performance', label: 'Performance', hint: 'Spend → shelves on one page' },
      { href: '/admin/owners', label: 'Owner guide', hint: 'The same map, always available' },
    ],
  },
] as const

export const ALREADY_BUILT = [
  { label: 'First-party attribution', detail: 'Visitor + session + UTM + click IDs land on every retail lead' },
  { label: 'Campaign landing pages', detail: '/lp/retail/bars, liquor, distributors — plus the UTM builder' },
  { label: 'Lead capture + email', detail: 'Form writes to the database and emails Joe in 48h SLA copy' },
  { label: 'CMO workbench', detail: 'Kanban, SLA clock, attribution card, activity log, referrals' },
  { label: 'Funnel dashboard', detail: 'Spend → impressions → leads → contact → qualify → shelves' },
  { label: 'Content studio', detail: 'Ideas → flows → studio → schedule. Ads without an agency.' },
]

export const TURN_ON = [
  { day: '30', title: 'Point it', items: ['Pixels + CAPI live in production', 'UTMs on every ad', 'First paid campaigns in Florida'] },
  { day: '60', title: 'Work it', items: ['Joe on the kanban every day', 'Creative iterate off real leads', 'Spend joined to contact SLA'] },
  { day: '90', title: 'Prove it', items: ['Cost per shelf on one page', 'Kill it, keep it, or scale', 'Lookalikes from converted accounts'] },
]

export const ASSUMPTIONS = [
  { item: 'A shelf', value: 'A retailer that carries Untamed — not a conversation, not a door knock' },
  { item: 'Media mix', value: 'Meta ~55–65% / Google Search ~20–25% / LinkedIn ~10–15% owner test / TikTok ~10% test. Founder social is always on.' },
  { item: 'Base CTR', value: '1.1% (conservative 0.9%, upside 1.4%)' },
  { item: 'Base landing conversion', value: '6% of clicks become inquiries' },
  { item: 'Contact SLA', value: '80–90% of leads reached within 48 hours' },
  { item: 'Qualify rate', value: '30% of contacted are the right buyer with real interest' },
  { item: 'Close rate', value: '25% of qualified become a shelf — product actually carried (30% upside)' },
  { item: 'Opening order', value: `${CASES_PER_ORDER} cases average when a retailer first carries Untamed` },
  { item: 'Shelf velocity', value: `$${SHELF_VELOCITY.toLocaleString()} annual revenue per retail location (existing financial model)` },
  { item: 'Sales team output', value: '$7,000 / month currently producing ~0 documented shelves' },
  { item: 'CMO bottleneck', value: 'At $7k+ media, add a closer — do not add another walker' },
  { item: 'Proof window', value: '90-day test at the $3,500 unit — not the full $7k. Kill, keep, or scale on cost per shelf.' },
]

export const CONTENT_PLAN = [
  {
    title: 'Founder-led social',
    role: 'The voice. Not a media buy.',
    body: 'Face, ritual, and the “pick your spirit” story from the founders. Builds trust with buyers before a dollar of ads. Studio already ships the cut-downs.',
    best: 'Instagram + TikTok organic. LinkedIn for owners and distributors — post always, buy a small test.',
  },
  {
    title: 'Video',
    role: 'Primary paid creative.',
    body: 'Vertical pours, chill-shake-pour, bartender speed, cold-box blocking. Fifteen to thirty seconds. Founder clips become ads. This is what Meta optimizes against.',
    best: 'Meta Reels first. TikTok as a cheap test. YouTube later, once the library exists.',
  },
  {
    title: 'Static images',
    role: 'The workhorse and the retarget.',
    body: 'Four-SKU lineup, 1-2-3 ticket math, shelf and cold-box stills. Fast to test. Cheap to rotate. Holds the story when video is still learning.',
    best: 'Meta feed + Google Demand Gen. Search gets the high-intent click; static carries the brand on the way in.',
  },
] as const

export const PLATFORM_MIX = [
  {
    name: 'Meta',
    share: '~65%',
    fit: 'Best home for this brand',
    why: 'Job-title and interest targeting for bar managers, liquor buyers, hospitality. Video and static in one account. Lowest path from founder clip to paid.',
  },
  {
    name: 'Google Search',
    share: '~25%',
    fit: 'Highest intent',
    why: 'Wholesale, RTS, distributor, Florida queries. Small share of dollars, high share of ready-to-talk leads. Pair with the campaign LPs.',
  },
  {
    name: 'TikTok',
    share: '~10% test',
    fit: 'Cheap reach, native video',
    why: 'Founder and ritual only if it looks native. Staff and younger buyers live here. Kill in 30 days if CPL is ugly.',
  },
  {
    name: 'LinkedIn',
    share: '~10–15% test',
    fit: 'Owners and distributors',
    why: 'Titles are real: owner, proprietor, beverage director, distributor principal. Worth buying for that layer — not for volume. Cap it so one week of CPCs cannot eat the $3,500 unit. Same LP and UTMs as Meta. If CPL stays under ~$100 and Joe can qualify them, keep it. If not, organic only.',
  },
] as const

export function money(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1000)}k`
  return String(n)
}
