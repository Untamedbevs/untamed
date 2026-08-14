/**
 * Owner briefing — retail lead throughput model.
 * All figures are management projections for internal discussion.
 * Conservative / base / upside are labeled as such throughout the deck.
 */

export const DISCLAIMER =
  'Internal projections for owner discussion. Not a guarantee. 90-day proof period. Subject to creative, geo, and closer follow-up.'

export const UNIT_COST = 3500
export const TEAM_COST = 7000
export const DOOR_VELOCITY = 3125
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
  costPerDoor: number
  annualVelocity: number
}

function funnel(partial: Omit<FunnelScenario, 'clicks' | 'cpc' | 'leads' | 'cpl' | 'contacted' | 'qualified' | 'doors' | 'costPerDoor' | 'annualVelocity'>): FunnelScenario {
  const clicks = Math.round(partial.impressions * partial.ctr)
  const cpc = clicks > 0 ? partial.spend / clicks : 0
  const leads = Math.round(clicks * partial.lpCvr)
  const cpl = leads > 0 ? partial.spend / leads : 0
  const contacted = Math.round(leads * partial.contactRate)
  const qualified = Math.round(contacted * partial.qualifyRate)
  const doors = Math.round(qualified * partial.convertRate)
  const costPerDoor = doors > 0 ? partial.spend / doors : 0
  const annualVelocity = doors * DOOR_VELOCITY
  return {
    ...partial,
    clicks,
    cpc,
    leads,
    cpl,
    contacted,
    qualified,
    doors,
    costPerDoor,
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

function scaleFunnel(base: FunnelScenario, spend: number, doorMultiplier: number): FunnelScenario {
  const ratio = spend / base.spend
  const impressions = Math.round(base.impressions * ratio)
  const clicks = Math.round(base.clicks * ratio)
  const leads = Math.round(base.leads * ratio)
  const contacted = Math.round(base.contacted * ratio)
  const qualified = Math.round(base.qualified * ratio)
  const doors = Math.round(base.doors * doorMultiplier)
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
    doors,
    costPerDoor: doors > 0 ? spend / doors : 0,
    annualVelocity: doors * DOOR_VELOCITY,
  }
}

/**
 * Scale media vs the $7k sales team.
 * At $7k+, doors do not double linearly — CMO capacity is the bottleneck
 * unless a closer is added. $7k uses 1.7x doors; $15k assumes a closer (3.2x).
 */
export const SCALE_ROWS = [
  {
    label: '1 salesperson',
    spend: UNIT_COST,
    kind: 'sales' as const,
    doors: 0,
    costPerDoor: null as number | null,
    annualVelocity: 0,
    note: 'Unmeasured walk-ins. Current output ~0.',
  },
  {
    label: 'Machine @ $3,500',
    spend: UNIT_COST,
    kind: 'machine' as const,
    doors: BASE_UNIT.doors,
    costPerDoor: BASE_UNIT.costPerDoor,
    annualVelocity: BASE_UNIT.annualVelocity,
    note: 'Inbound, attributed, 48h SLA.',
  },
  {
    label: '2 salespeople',
    spend: TEAM_COST,
    kind: 'sales' as const,
    doors: 0,
    costPerDoor: null as number | null,
    annualVelocity: 0,
    note: 'Current $7,000 / month. Still ~0.',
  },
  {
    label: 'Machine @ $7,000',
    spend: TEAM_COST,
    kind: 'machine' as const,
    ...(() => {
      const s = scaleFunnel(BASE_UNIT, TEAM_COST, 1.7)
      return { doors: s.doors, costPerDoor: s.costPerDoor, annualVelocity: s.annualVelocity }
    })(),
    note: 'More media. Same closer. Capacity starts to bind.',
  },
  {
    label: 'Machine @ $15,000',
    spend: 15000,
    kind: 'machine' as const,
    ...(() => {
      const s = scaleFunnel(BASE_UNIT, 15000, 3.2)
      return { doors: s.doors, costPerDoor: s.costPerDoor, annualVelocity: s.annualVelocity }
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
  { key: 'doors', label: 'Doors', unit: '' },
] as const

export const ALREADY_BUILT = [
  { label: 'First-party attribution', detail: 'Visitor + session + UTM cookies live on untamedbevs.com' },
  { label: 'Retail landing pages', detail: '/retail and /distribute with inquiry form' },
  { label: 'Lead capture + email', detail: 'Form writes to the database and emails Joe in 48h SLA copy' },
  { label: 'Pipeline statuses', detail: 'New → contacted → qualified → negotiating → converted' },
  { label: 'B2B referral loop', detail: 'Every retailer can refer the next one. Credits already fire.' },
  { label: 'Content studio', detail: 'Ideas → flows → studio → schedule. Ads without an agency.' },
]

export const TURN_ON = [
  { day: '30', title: 'Measure', items: ['Wire UTMs onto every retail lead', 'Pixels + CAPI so platforms can optimize', 'Campaign landing pages'] },
  { day: '60', title: 'Work', items: ['CMO workbench with SLA and activity log', 'Funnel KPI dashboard', 'First paid campaigns in Florida'] },
  { day: '90', title: 'Prove', items: ['Spend joined to doors', 'Kill or scale the $7k', 'Lookalikes from converted accounts'] },
]

export const ASSUMPTIONS = [
  { item: 'Media mix', value: 'Meta ~70% / Google Search ~30%, Florida bar + liquor buyers' },
  { item: 'Base CTR', value: '1.1% (conservative 0.9%, upside 1.4%)' },
  { item: 'Base landing conversion', value: '6% of clicks become inquiries' },
  { item: 'Contact SLA', value: '80–90% of leads reached within 48 hours' },
  { item: 'Qualify rate', value: '30% of contacted are the right buyer with real interest' },
  { item: 'Close rate', value: '25% of qualified become a door (30% upside)' },
  { item: 'Door velocity', value: `$${DOOR_VELOCITY.toLocaleString()} annual revenue per door (existing financial model)` },
  { item: 'Sales team output', value: '$7,000 / month currently producing ~0 documented doors' },
  { item: 'CMO bottleneck', value: 'At $7k+ media, add a closer — do not add another walker' },
  { item: 'Proof window', value: '90 days, then kill or scale. No multi-year lock-in.' },
]

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
