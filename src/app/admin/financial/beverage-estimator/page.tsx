'use client'

import { useState, useMemo } from 'react'
import {
  Calculator,
  Package,
  DollarSign,
  Warehouse,
  Tags,
  TrendingUp,
  RotateCcw,
  Download,
  ChevronDown,
  Info,
  PieChart,
  BarChart3,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Pricing data extracted from the two Excel workbooks
// ---------------------------------------------------------------------------

type PricingBucket = {
  label: string
  min: number
  max: number | null
  items: Record<string, number>
}

const UNDER_40K_BUCKETS: PricingBucket[] = [
  {
    label: '1,000 – 1,999 cans',
    min: 1000,
    max: 1999,
    items: {
      'Cans + Ends': 0.19,
      Bundling: 0.05,
      Labels: 0.25,
      Packaging: 0.10,
      Ingredients: 1.00,
    },
  },
  {
    label: '2,000 – 4,999 cans',
    min: 2000,
    max: 4999,
    items: {
      'Cans + Ends': 0.19,
      Bundling: 0.05,
      Labels: 0.20,
      Packaging: 0.10,
      Ingredients: 0.75,
    },
  },
  {
    label: '5,000 – 9,999 cans',
    min: 5000,
    max: 9999,
    items: {
      'Cans + Ends': 0.19,
      Bundling: 0.05,
      Labels: 0.16,
      Packaging: 0.10,
      Ingredients: 0.60,
    },
  },
  {
    label: '10,000 – 24,999 cans',
    min: 10000,
    max: 24999,
    items: {
      'Cans + Ends': 0.19,
      Bundling: 0.05,
      Labels: 0.16,
      Packaging: 0.10,
      Ingredients: 0.40,
    },
  },
  {
    label: '25,000 – 39,999 cans',
    min: 25000,
    max: 39999,
    items: {
      'Cans + Ends': 0.19,
      Bundling: 0.05,
      Labels: 0.16,
      Packaging: 0.10,
      Ingredients: 0.25,
    },
  },
]

const OVER_40K_BUCKETS: PricingBucket[] = [
  {
    label: '40,000 – 99,999 cans',
    min: 40000,
    max: 99999,
    items: {
      Tolling: 0.35,
      Bundling: 0.05,
      'Cans + Ends': 0.18,
      Labels: 0.16,
      Packaging: 0.07,
      Ingredients: 0.30,
    },
  },
  {
    label: '100,000 – 499,999 cans',
    min: 100000,
    max: 499999,
    items: {
      Tolling: 0.33,
      Bundling: 0.05,
      'Cans + Ends': 0.17,
      Labels: 0.12,
      Packaging: 0.06,
      Ingredients: 0.20,
    },
  },
  {
    label: '500,000+ cans',
    min: 500000,
    max: null,
    items: {
      Tolling: 0.30,
      Bundling: 0.04,
      'Cans + Ends': 0.17,
      Labels: 0.09,
      Packaging: 0.05,
      Ingredients: 0.15,
    },
  },
]

const ALL_BUCKETS = [...UNDER_40K_BUCKETS, ...OVER_40K_BUCKETS]

const DEFAULT_FACILITY_RENTAL = 12500
const DEFAULT_SKU_FEE = 1500
const DEFAULT_MIN_CANS = 1000
const DEFAULT_FACILITY_THRESHOLD = 40000

const LINE_ITEM_ORDER = [
  'Tolling',
  'Bundling',
  'Cans + Ends',
  'Labels',
  'Packaging',
  'Ingredients',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findBucket(cans: number): PricingBucket | null {
  return (
    ALL_BUCKETS.find(
      (b) => cans >= b.min && (b.max === null || cans <= b.max)
    ) ?? null
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

// ---------------------------------------------------------------------------
// Chart colors per line item
// ---------------------------------------------------------------------------

const ITEM_COLORS: Record<string, string> = {
  Tolling: '#9B30FF',
  Bundling: '#00BFFF',
  'Cans + Ends': '#4A7C0F',
  Labels: '#D4D700',
  Packaging: '#E87511',
  Ingredients: '#FF0040',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  name: string
  unitCost: number
  total: number
}

interface Estimate {
  bucket: PricingBucket
  lineItems: LineItem[]
  perCanTotal: number
  variableTotal: number
  skuFee: number
  facilityFee: number
  grandTotal: number
  effectiveCostPerCan: number
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function PerCanDonut({ lineItems }: { lineItems: LineItem[] }) {
  const [hovered, setHovered] = useState<string | null>(null)

  const size = 180
  const cx = size / 2
  const cy = size / 2
  const radius = 72
  const innerRadius = 46
  const total = lineItems.reduce((s, li) => s + li.unitCost, 0)

  const slices = useMemo(() => {
    let startAngle = -Math.PI / 2
    return lineItems.map((li) => {
      const fraction = li.unitCost / total
      const angle = fraction * Math.PI * 2
      const endAngle = startAngle + angle
      const largeArc = angle > Math.PI ? 1 : 0

      const x1 = cx + radius * Math.cos(startAngle)
      const y1 = cy + radius * Math.sin(startAngle)
      const x2 = cx + radius * Math.cos(endAngle)
      const y2 = cy + radius * Math.sin(endAngle)

      const ix1 = cx + innerRadius * Math.cos(startAngle)
      const iy1 = cy + innerRadius * Math.sin(startAngle)
      const ix2 = cx + innerRadius * Math.cos(endAngle)
      const iy2 = cy + innerRadius * Math.sin(endAngle)

      const midAngle = startAngle + angle / 2
      const labelR = (radius + innerRadius) / 2
      const labelX = cx + labelR * Math.cos(midAngle)
      const labelY = cy + labelR * Math.sin(midAngle)

      let path: string
      if (lineItems.length === 1) {
        const r = radius
        const ir = innerRadius
        path = [
          `M ${cx - r} ${cy}`,
          `A ${r} ${r} 0 0 1 ${cx + r} ${cy}`,
          `A ${r} ${r} 0 0 1 ${cx - r} ${cy}`,
          `M ${cx - ir} ${cy}`,
          `A ${ir} ${ir} 0 0 0 ${cx + ir} ${cy}`,
          `A ${ir} ${ir} 0 0 0 ${cx - ir} ${cy}`,
        ].join(' ')
      } else {
        path = [
          `M ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${ix2} ${iy2}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
          'Z',
        ].join(' ')
      }

      const result = { li, path, fraction, labelX, labelY }
      startAngle = endAngle
      return result
    })
  }, [lineItems, total, cx, cy, radius, innerRadius])

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
          <PieChart className="w-[18px] h-[18px] text-[#9B30FF]" />
        </div>
        <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
          Per-Can Cost Mix
        </h2>
      </div>

      <div className="flex items-center justify-center gap-6 flex-wrap">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="shrink-0"
        >
          {slices.map(({ li, path, fraction, labelX, labelY }) => (
            <g key={li.name}>
              <path
                d={path}
                fill={ITEM_COLORS[li.name] || '#666'}
                fillRule="evenodd"
                opacity={
                  hovered === null || hovered === li.name ? 0.9 : 0.3
                }
                stroke="#141414"
                strokeWidth="2"
                className="transition-opacity duration-200 cursor-pointer"
                onMouseEnter={() => setHovered(li.name)}
                onMouseLeave={() => setHovered(null)}
              />
              {fraction >= 0.08 && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="10"
                  fontWeight="600"
                  className="pointer-events-none"
                >
                  {Math.round(fraction * 100)}%
                </text>
              )}
            </g>
          ))}
          <text
            x={cx}
            y={cy - 5}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="14"
            fontWeight="700"
          >
            {formatCurrency(total)}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#666"
            fontSize="9"
          >
            per can
          </text>
        </svg>

        <div className="space-y-2">
          {lineItems.map((li) => {
            const pct = ((li.unitCost / total) * 100).toFixed(1)
            return (
              <div
                key={li.name}
                className={`flex items-center gap-2.5 transition-opacity duration-200 cursor-pointer ${
                  hovered !== null && hovered !== li.name ? 'opacity-40' : ''
                }`}
                onMouseEnter={() => setHovered(li.name)}
                onMouseLeave={() => setHovered(null)}
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: ITEM_COLORS[li.name] || '#666' }}
                />
                <div>
                  <p className="text-xs text-white font-medium">{li.name}</p>
                  <p className="text-[10px] text-[#666] tabular-nums">
                    {formatCurrency(li.unitCost)} ({pct}%)
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CostBreakdownBar({ estimate }: { estimate: Estimate }) {
  const segments = [
    {
      label: 'Variable Production',
      value: estimate.variableTotal,
      color: '#4A7C0F',
    },
    ...(estimate.skuFee > 0
      ? [{ label: 'SKU Fee', value: estimate.skuFee, color: '#D4D700' }]
      : []),
    ...(estimate.facilityFee > 0
      ? [
          {
            label: 'Facility Rental',
            value: estimate.facilityFee,
            color: '#E87511',
          },
        ]
      : []),
  ]

  const max = Math.max(...segments.map((s) => s.value))

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#00BFFF]/15 flex items-center justify-center">
          <BarChart3 className="w-[18px] h-[18px] text-[#00BFFF]" />
        </div>
        <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
          Total Cost Breakdown
        </h2>
      </div>

      <div className="space-y-4">
        {segments.map((seg) => {
          const pct = (seg.value / max) * 100
          return (
            <div key={seg.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs text-[#A0A0A0]">{seg.label}</span>
                </div>
                <span className="text-xs text-white tabular-nums font-medium">
                  {formatCurrency(seg.value)}
                </span>
              </div>
              <div className="h-6 bg-[#0A0A0A] rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: seg.color,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          )
        })}

        <div className="pt-3 mt-1 border-t border-[#2A2A2A] flex items-center justify-between">
          <span className="text-sm text-white font-semibold">Grand Total</span>
          <span className="text-sm text-[#9B30FF] font-bold tabular-nums">
            {formatCurrency(estimate.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FinancialPage() {
  const [cans, setCans] = useState<number>(0)
  const [skus, setSkus] = useState<number>(1)
  const [showPricingTable, setShowPricingTable] = useState(false)

  const [facilityRental, setFacilityRental] = useState(DEFAULT_FACILITY_RENTAL)
  const [skuFeeRate, setSkuFeeRate] = useState(DEFAULT_SKU_FEE)
  const [minCans, setMinCans] = useState(DEFAULT_MIN_CANS)
  const [facilityThreshold, setFacilityThreshold] = useState(DEFAULT_FACILITY_THRESHOLD)

  const estimate = useMemo<Estimate | null>(() => {
    if (cans < (minCans || 1)) return null

    const bucket = findBucket(cans)
    if (!bucket) return null

    const lineItems: LineItem[] = LINE_ITEM_ORDER.filter(
      (name) => name in bucket.items
    ).map((name) => ({
      name,
      unitCost: bucket.items[name],
      total: round2(bucket.items[name] * cans),
    }))

    const perCanTotal = round2(
      lineItems.reduce((sum, li) => sum + li.unitCost, 0)
    )
    const variableTotal = round2(
      lineItems.reduce((sum, li) => sum + li.total, 0)
    )
    const skuFee = round2(Math.max(0, skus - 1) * (skuFeeRate || 0))
    const facilityFee = cans < (facilityThreshold || 0) ? (facilityRental || 0) : 0
    const grandTotal = round2(variableTotal + skuFee + facilityFee)
    const effectiveCostPerCan = round2(grandTotal / cans)

    return {
      bucket,
      lineItems,
      perCanTotal,
      variableTotal,
      skuFee,
      facilityFee,
      grandTotal,
      effectiveCostPerCan,
    }
  }, [cans, skus, facilityRental, skuFeeRate, minCans, facilityThreshold])

  function handleReset() {
    setCans(0)
    setSkus(1)
    setFacilityRental(DEFAULT_FACILITY_RENTAL)
    setSkuFeeRate(DEFAULT_SKU_FEE)
    setMinCans(DEFAULT_MIN_CANS)
    setFacilityThreshold(DEFAULT_FACILITY_THRESHOLD)
  }

  function handleExport() {
    if (!estimate) return
    const lines = [
      'Untamed Beverage Cost Estimate',
      `Generated: ${new Date().toLocaleDateString()}`,
      `Pricing Tier: ${estimate.bucket.label}`,
      '',
      'INPUTS',
      `Number of Cans,${cans}`,
      `Number of SKUs,${skus}`,
      '',
      'PER-CAN BREAKDOWN',
      ...estimate.lineItems.map(
        (li) => `${li.name},${li.unitCost.toFixed(2)},${li.total.toFixed(2)}`
      ),
      '',
      'SUMMARY',
      `Per-Can Total,${estimate.perCanTotal.toFixed(2)}`,
      `Variable Production Total,${estimate.variableTotal.toFixed(2)}`,
      `Additional SKU Fee,${estimate.skuFee.toFixed(2)}`,
      `Facility Rental,${estimate.facilityFee.toFixed(2)}`,
      '',
      `GRAND TOTAL,${estimate.grandTotal.toFixed(2)}`,
      `Effective Cost Per Can,${estimate.effectiveCostPerCan.toFixed(2)}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `beverage-estimate-${cans}-cans-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-condensed uppercase tracking-wide">
            Beverage Cost Estimator
          </h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Production cost estimates from BevpackLA pricing sheets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A] hover:border-[#444] bg-[#141414] transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleExport}
            disabled={!estimate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white bg-[#9B30FF] hover:bg-[#8526DB] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: inputs */}
        <div className="space-y-6">
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
                <Package className="w-[18px] h-[18px] text-[#9B30FF]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                Production Inputs
              </h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-[#A0A0A0] mb-1.5">
                  Number of Cans
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={cans || ''}
                  onChange={(e) =>
                    setCans(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  placeholder="e.g. 25000"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white text-sm outline-none tabular-nums placeholder:text-[#333] focus:border-[#9B30FF]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {cans > 0 && cans < (minCans || 1) && (
                  <p className="text-xs mt-1.5 text-[#FF0040]">
                    Minimum supported quantity is {formatNumber(minCans || 1)} cans
                  </p>
                )}
                {estimate && cans < (facilityThreshold || 0) && (
                  <p className="text-xs mt-1.5 text-[#E87511]">
                    Under {formatNumber(facilityThreshold)} — {formatCurrency(facilityRental)} facility rental applies
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-[#A0A0A0] mb-1.5">
                  Number of SKUs
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={skus || ''}
                  onChange={(e) =>
                    setSkus(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  placeholder="1"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white text-sm outline-none tabular-nums placeholder:text-[#333] focus:border-[#9B30FF]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {skus > 1 && (
                  <p className="text-xs mt-1.5 text-[#D4D700]">
                    {skus - 1} extra SKU(s) — {formatCurrency((skus - 1) * (skuFeeRate || 0))} fee
                  </p>
                )}
              </div>
            </div>

            {/* Active tier indicator */}
            {estimate && (
              <div className="mt-6 pt-5 border-t border-[#2A2A2A]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#9B30FF] animate-pulse" />
                  <span className="text-xs text-[#A0A0A0] uppercase tracking-wider">
                    Active Pricing Tier
                  </span>
                </div>
                <p className="text-sm font-medium text-white">
                  {estimate.bucket.label}
                </p>
                <p className="text-xs text-[#666] mt-0.5">
                  {cans < (facilityThreshold || DEFAULT_FACILITY_THRESHOLD)
                    ? `Source: less than ${formatNumber(facilityThreshold || DEFAULT_FACILITY_THRESHOLD)} cans workbook`
                    : 'Source: BevpackLA pricing workbook'}
                </p>
              </div>
            )}
          </div>

          {/* Fee settings */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#E87511]/15 flex items-center justify-center">
                <Warehouse className="w-[18px] h-[18px] text-[#E87511]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                Fee Settings
              </h2>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1">Minimum order (cans)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={minCans || ''}
                  onChange={(e) => setMinCans(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="1000"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-white text-sm outline-none tabular-nums placeholder:text-[#333] focus:border-[#E87511]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1">Facility rental threshold (cans)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={facilityThreshold || ''}
                  onChange={(e) => setFacilityThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="40000"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-white text-sm outline-none tabular-nums placeholder:text-[#333] focus:border-[#E87511]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1">Facility rental fee ($)</label>
                <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 focus-within:border-[#E87511]/50 transition-colors">
                  <span className="text-xs text-[#666]">$</span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={facilityRental || ''}
                    onChange={(e) => setFacilityRental(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="12500"
                    className="flex-1 bg-transparent text-white text-sm outline-none tabular-nums placeholder:text-[#333] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1">Additional SKU fee ($ / SKU)</label>
                <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 focus-within:border-[#E87511]/50 transition-colors">
                  <span className="text-xs text-[#666]">$</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={skuFeeRate || ''}
                    onChange={(e) => setSkuFeeRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="1500"
                    className="flex-1 bg-transparent text-white text-sm outline-none tabular-nums placeholder:text-[#333] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-[#666]">/ SKU</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center + Right: results */}
        <div className="lg:col-span-2 space-y-6">
          {!estimate ? (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-[#9B30FF]/10 flex items-center justify-center mb-4">
                <Calculator className="w-8 h-8 text-[#9B30FF]/40" />
              </div>
              <p className="text-[#A0A0A0] text-sm">
                Enter a quantity of at least {formatNumber(minCans || 1)} cans to see your estimate
              </p>
            </div>
          ) : (
            <>
              {/* Line items */}
              <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#4A7C0F]/15 flex items-center justify-center">
                    <DollarSign className="w-[18px] h-[18px] text-[#4A7C0F]" />
                  </div>
                  <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                    Per-Can Breakdown
                  </h2>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[1fr_120px_120px] gap-4 pb-3 border-b border-[#2A2A2A] text-xs text-[#666] uppercase tracking-wider">
                  <span>Item</span>
                  <span className="text-right">Unit Cost</span>
                  <span className="text-right">Line Total</span>
                </div>

                {/* Line items */}
                <div className="divide-y divide-[#1A1A1A]">
                  {estimate.lineItems.map((li) => (
                    <div
                      key={li.name}
                      className="grid grid-cols-[1fr_120px_120px] gap-4 py-3 items-center"
                    >
                      <span className="text-sm text-white">{li.name}</span>
                      <span className="text-sm text-[#A0A0A0] text-right tabular-nums">
                        {formatCurrency(li.unitCost)}
                      </span>
                      <span className="text-sm text-white text-right tabular-nums font-medium">
                        {formatCurrency(li.total)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Per-can total */}
                <div className="grid grid-cols-[1fr_120px_120px] gap-4 pt-3 mt-1 border-t border-[#2A2A2A]">
                  <span className="text-sm font-semibold text-white">
                    Per-Can Total
                  </span>
                  <span className="text-sm text-[#9B30FF] text-right tabular-nums font-semibold">
                    {formatCurrency(estimate.perCanTotal)}
                  </span>
                  <span className="text-sm text-white text-right tabular-nums font-semibold">
                    {formatCurrency(estimate.variableTotal)}
                  </span>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PerCanDonut lineItems={estimate.lineItems} />
                <CostBreakdownBar estimate={estimate} />
              </div>

              {/* Fees + Grand total */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fees */}
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-[#D4D700]/15 flex items-center justify-center">
                      <Tags className="w-[18px] h-[18px] text-[#D4D700]" />
                    </div>
                    <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                      Additional Fees
                    </h2>
                  </div>
                  <div className="space-y-3">
                    <div className={`flex justify-between py-2.5 border-b border-[#1A1A1A] ${estimate.skuFee === 0 ? 'opacity-40' : ''}`}>
                      <div>
                        <span className="text-sm text-white">SKU Fee</span>
                        <p className="text-xs text-[#666] mt-0.5">
                          {skus > 1
                            ? `(${skus} - 1) x ${formatCurrency(skuFeeRate || 0)}`
                            : 'No additional SKUs'}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-white tabular-nums">
                        {formatCurrency(estimate.skuFee)}
                      </span>
                    </div>
                    <div className={`flex justify-between py-2.5 ${estimate.facilityFee === 0 ? 'opacity-40' : ''}`}>
                      <div>
                        <span className="text-sm text-white">
                          Facility Rental
                        </span>
                        <p className="text-xs text-[#666] mt-0.5">
                          {estimate.facilityFee > 0
                            ? `Required for runs under ${formatNumber(facilityThreshold)}`
                            : `Waived for ${formatNumber(facilityThreshold)}+ cans`}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-white tabular-nums">
                        {formatCurrency(estimate.facilityFee)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grand total */}
                <div className="bg-[#141414] border-2 border-[#9B30FF]/40 rounded-2xl p-6 relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-5"
                    style={{
                      background:
                        'radial-gradient(ellipse at top right, #9B30FF, transparent 70%)',
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
                        <TrendingUp className="w-[18px] h-[18px] text-[#9B30FF]" />
                      </div>
                      <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                        Grand Total
                      </h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-[#A0A0A0] mb-1">
                          Total Production Cost
                        </p>
                        <p className="text-3xl font-bold text-white tabular-nums">
                          {formatCurrency(estimate.grandTotal)}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#2A2A2A]">
                        <p className="text-sm text-[#A0A0A0] mb-1">
                          Effective Cost Per Can
                        </p>
                        <p className="text-xl font-semibold text-[#9B30FF] tabular-nums">
                          {formatCurrency(estimate.effectiveCostPerCan)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Full pricing table toggle */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowPricingTable(!showPricingTable)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-[#1A1A1A] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00BFFF]/15 flex items-center justify-center">
                  <Info className="w-[18px] h-[18px] text-[#00BFFF]" />
                </div>
                <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                  Full Pricing Tables
                </h2>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-[#666] transition-transform duration-200 ${showPricingTable ? 'rotate-180' : ''}`}
              />
            </button>

            {showPricingTable && (
              <div className="px-6 pb-6 space-y-8">
                {/* Under 40k table */}
                <div>
                  <h3 className="text-sm font-medium text-[#E87511] mb-3 uppercase tracking-wider">
                    Under 40,000 Cans (+ $12,500 facility rental)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2A2A2A]">
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Item
                          </th>
                          {UNDER_40K_BUCKETS.map((b) => (
                            <th
                              key={b.label}
                              className={`text-right text-xs uppercase tracking-wider py-2 px-3 ${
                                estimate?.bucket.label === b.label
                                  ? 'text-[#9B30FF]'
                                  : 'text-[#666]'
                              }`}
                            >
                              {b.label.replace(' cans', '')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1A1A]">
                        {LINE_ITEM_ORDER.filter((name) =>
                          UNDER_40K_BUCKETS[0].items[name] !== undefined
                        ).map((name) => (
                          <tr key={name}>
                            <td className="text-white py-2 pr-4">{name}</td>
                            {UNDER_40K_BUCKETS.map((b) => (
                              <td
                                key={b.label}
                                className={`text-right tabular-nums py-2 px-3 ${
                                  estimate?.bucket.label === b.label
                                    ? 'text-white font-medium'
                                    : 'text-[#A0A0A0]'
                                }`}
                              >
                                {b.items[name] !== undefined
                                  ? formatCurrency(b.items[name])
                                  : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Over 40k table */}
                <div>
                  <h3 className="text-sm font-medium text-[#4A7C0F] mb-3 uppercase tracking-wider">
                    40,000+ Cans (no facility rental)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2A2A2A]">
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Item
                          </th>
                          {OVER_40K_BUCKETS.map((b) => (
                            <th
                              key={b.label}
                              className={`text-right text-xs uppercase tracking-wider py-2 px-3 ${
                                estimate?.bucket.label === b.label
                                  ? 'text-[#9B30FF]'
                                  : 'text-[#666]'
                              }`}
                            >
                              {b.label.replace(' cans', '')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1A1A]">
                        {LINE_ITEM_ORDER.map((name) => (
                          <tr key={name}>
                            <td className="text-white py-2 pr-4">{name}</td>
                            {OVER_40K_BUCKETS.map((b) => (
                              <td
                                key={b.label}
                                className={`text-right tabular-nums py-2 px-3 ${
                                  estimate?.bucket.label === b.label
                                    ? 'text-white font-medium'
                                    : 'text-[#A0A0A0]'
                                }`}
                              >
                                {b.items[name] !== undefined
                                  ? formatCurrency(b.items[name])
                                  : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
