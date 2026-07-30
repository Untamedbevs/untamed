/**
 * Investor deck data — sourced from the Untamed financial sensitivity model
 * and five-year base-case projections. All figures are management projections
 * for investor discussion; illustrative and subject to validation.
 */

export const DISCLAIMER =
  'Management projections for investor discussion. Figures are illustrative and subject to validation.'

export const SCENARIO_COLORS = {
  conservative: '#8E8E8E',
  base: '#FFD700',
  upside: '#9B30FF',
} as const

export const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']

/** Revenue by scenario, $M */
export const REVENUE_SCENARIOS = [
  { name: 'Conservative', color: SCENARIO_COLORS.conservative, values: [0.3, 1, 2.8, 6.5, 12] },
  { name: 'Base', color: SCENARIO_COLORS.base, values: [0.5, 1.8, 5, 12, 25] },
  { name: 'Upside', color: SCENARIO_COLORS.upside, values: [0.85, 3.2, 9, 22, 45] },
]

/** EBITDA by scenario, $M */
export const EBITDA_SCENARIOS = [
  { name: 'Conservative', color: SCENARIO_COLORS.conservative, values: [-0.3, -0.35, -0.1, 0.6, 1.8] },
  { name: 'Base', color: SCENARIO_COLORS.base, values: [-0.25, -0.2, 0.5, 2, 5.5] },
  { name: 'Upside', color: SCENARIO_COLORS.upside, values: [-0.15, 0.25, 1.8, 6, 12] },
]

/** Base-case five-year projection */
export const FIVE_YEAR_BASE = [
  { year: 'Year 1', doors: 150, revenue: 0.5, revenueLabel: '$500K', grossMargin: '40%', ebitda: -0.25, ebitdaLabel: '($250K)' },
  { year: 'Year 2', doors: 500, revenue: 1.8, revenueLabel: '$1.8M', grossMargin: '45%', ebitda: -0.2, ebitdaLabel: '($200K)' },
  { year: 'Year 3', doors: 1500, revenue: 5, revenueLabel: '$5M', grossMargin: '50%', ebitda: 0.5, ebitdaLabel: '$500K' },
  { year: 'Year 4', doors: 4000, revenue: 12, revenueLabel: '$12M', grossMargin: '52%', ebitda: 2, ebitdaLabel: '$2M' },
  { year: 'Year 5', doors: 8000, revenue: 25, revenueLabel: '$25M', grossMargin: '55%', ebitda: 5.5, ebitdaLabel: '$5.5M' },
]

/** Year 5 outcomes by execution case */
export const YEAR5_SCENARIOS = [
  {
    name: 'Conservative',
    color: SCENARIO_COLORS.conservative,
    revenue: '$12M',
    ebitda: '$1.8M',
    doors: '4,000 doors',
    summary: 'Meaningful regional RTS brand',
  },
  {
    name: 'Base',
    color: SCENARIO_COLORS.base,
    revenue: '$25M',
    ebitda: '$5.5M',
    doors: '8,000 doors',
    summary: 'National RTS martini platform',
  },
  {
    name: 'Upside',
    color: SCENARIO_COLORS.upside,
    revenue: '$45M',
    ebitda: '$12M',
    doors: '12,000 doors',
    summary: 'Category leader with acquisition potential',
  },
]

/** Year 5 revenue ($M) — doors x annual velocity per door */
export const DOORS_VELOCITY_MATRIX = {
  velocities: ['$2.5K / door', '$3.125K / door', '$3.5K / door'],
  velocityLabels: ['Low Velocity', 'Base Velocity', 'High Velocity'],
  rows: [
    { doors: '4,000 doors', values: ['$10M', '$12.5M', '$14M'] },
    { doors: '8,000 doors', values: ['$20M', '$25M', '$28M'] },
    { doors: '12,000 doors', values: ['$30M', '$37.5M', '$42M'] },
  ],
  /** [rowIndex, colIndex] of the base case cell */
  baseCell: [1, 1] as [number, number],
}

/** Break-even revenue ($M) by gross margin */
export const BREAK_EVEN = {
  byMargin: [
    { margin: '45%', revenue: 4.44, label: '$4.44M' },
    { margin: '50%', revenue: 4.0, label: '$4.0M', isBase: true },
    { margin: '55%', revenue: 3.64, label: '$3.64M' },
    { margin: '60%', revenue: 3.33, label: '$3.33M' },
  ],
  fixedOpex: '$2.0M',
  baseGrossMargin: '50%',
  baseRevenue: '$4.0M',
  doorsAtBase: '1,280',
  velocityAssumption: '$3,125 average annual revenue per retail location',
}

/** SAFE raise */
export const RAISE = {
  amount: '$850,000',
  instrument: 'SAFE',
  useOfFunds: [
    { label: 'Inventory & Production', pct: 40, color: '#FFD700' },
    { label: 'Distributor Expansion', pct: 25, color: '#9B30FF' },
    { label: 'Sampling & Activations', pct: 15, color: '#E87511' },
    { label: 'Digital Marketing', pct: 10, color: '#D4D700' },
    { label: 'Key Personnel', pct: 5, color: '#6B8E23' },
    { label: 'Working Capital', pct: 5, color: '#C0C0C0' },
  ],
  outcomes: [
    '150+ retail locations',
    'Distribution expansion',
    'Strong inventory position',
    'Foundation for Southeast growth',
  ],
}

/** Illustrative exit scenario at $25M revenue */
export const RETURN_SCENARIO = {
  assumptions: ['$25M revenue', '20–25% EBITDA margin', 'Strategic acquisition by a beverage company'],
  multiples: [
    { multiple: '2x Revenue', value: '$50M' },
    { multiple: '3x Revenue', value: '$75M' },
    { multiple: '4x Revenue', value: '$100M' },
  ],
}

/** Five-year value creation roadmap */
export const ROADMAP = [
  { year: 'Year 1', milestone: 'Florida Leadership', revenue: '$500K' },
  { year: 'Year 2', milestone: 'Southeast Expansion', revenue: '$1.8M' },
  { year: 'Year 3', milestone: 'Regional RTS Brand', revenue: '$5M' },
  { year: 'Year 4', milestone: 'National Distribution', revenue: '$12M' },
  { year: 'Year 5', milestone: 'RTS Category Leader', revenue: '$25M' },
]
