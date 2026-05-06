'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import {
  Beaker,
  Package,
  ClipboardList,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  BarChart3,
  PieChart,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Overage tiers — from the spreadsheet's ISBETWEEN formula
// ---------------------------------------------------------------------------

const OVERAGE_TIERS: { min: number; max: number | null; factor: number }[] = [
  { min: 0, max: 999, factor: 2 },
  { min: 1000, max: 1999, factor: 1.5 },
  { min: 2000, max: 4999, factor: 1.35 },
  { min: 5000, max: 9999, factor: 1.3 },
  { min: 10000, max: 24999, factor: 1.25 },
  { min: 25000, max: 49999, factor: 1.15 },
  { min: 50000, max: 100000, factor: 1.1 },
  { min: 100001, max: null, factor: 1.05 },
]

function getOverage(cans: number): number {
  const tier = OVERAGE_TIERS.find(
    (t) => cans >= t.min && (t.max === null || cans <= t.max)
  )
  return tier?.factor ?? 1.05
}

// ---------------------------------------------------------------------------
// Drink formula data — extracted from the Excel "Formula" sheet
// ---------------------------------------------------------------------------

interface Ingredient {
  name: string
  supplier: string
  code: string
  percent: number
}

interface DrinkFormula {
  id: string
  name: string
  subtitle: string
  color: string
  servingOz: number
  density: number
  brix: number
  ingredients: Ingredient[]
}

const DRINKS: DrinkFormula[] = [
  {
    id: 'dirty-martini',
    name: 'Dirty Martini',
    subtitle: 'Cougar',
    color: '#4A7C0F',
    servingOz: 12,
    density: 8.3291,
    brix: 1.1,
    ingredients: [
      { name: 'Filtered Water', supplier: 'Plant', code: 'n/a', percent: 74.15 },
      { name: '190 Proof Grain Ethyl Alcohol', supplier: 'Ultrapure', code: 'n/a', percent: 12.7 },
      { name: 'Cane Sugar', supplier: 'IFPC', code: '202789', percent: 3 },
      { name: 'Dirty Martini Olive Juice (Main and Geary)', supplier: 'The Olive Packing Company', code: 'n/a', percent: 10 },
      { name: 'Citric Acid', supplier: 'IFPC', code: '202661', percent: 0.15 },
    ],
  },
  {
    id: 'espresso',
    name: 'Espresso',
    subtitle: 'Black Panther',
    color: '#9B30FF',
    servingOz: 12,
    density: 8.4969,
    brix: 1.0,
    ingredients: [
      { name: 'Filtered Water', supplier: 'Plant', code: 'n/a', percent: 73.7 },
      { name: '190 Proof Grain Ethyl Alcohol', supplier: 'Ultrapure', code: 'n/a', percent: 12.7 },
      { name: 'Cane Sugar', supplier: 'IFPC', code: '202789', percent: 8 },
      { name: 'Espresso Coffee Extract #1592', supplier: 'Finlays', code: '1592', percent: 5 },
      { name: 'Vanilla Caramel Flavor Natural Type', supplier: 'Sapphire Flavors', code: 'SFF-257076', percent: 0.2 },
      { name: 'Cocoa Flavor Natural WONF', supplier: 'Sapphire Flavors', code: 'SFF-257072', percent: 0.2 },
      { name: 'Citric Acid', supplier: 'IFPC', code: '202661', percent: 0.2 },
    ],
  },
  {
    id: 'lemon-drop',
    name: 'Lemon Drop',
    subtitle: 'Cheetah',
    color: '#D4D700',
    servingOz: 12,
    density: 8.5244,
    brix: 1.2,
    ingredients: [
      { name: 'Filtered Water', supplier: 'Plant', code: 'n/a', percent: 73.98 },
      { name: '190 Proof Grain Ethyl Alcohol', supplier: 'Ultrapure', code: 'n/a', percent: 12.7 },
      { name: 'Cane Sugar', supplier: 'IFPC', code: '202789', percent: 8.8 },
      { name: 'Lemon Juice Concentrate 400 GPL', supplier: 'Greenwood Associates', code: 'LEJC40F-0001-PA51', percent: 4 },
      { name: 'Lemon Flavor Natural WONF', supplier: 'Sapphire Flavors', code: 'SFF-257074', percent: 0.4 },
      { name: 'Juicy Enhancer Flavor Natural Type', supplier: 'Sapphire Flavors', code: 'SFF-257073', percent: 0.1 },
      { name: 'EXBERRY Shade "Bright Yellow"', supplier: 'GNT', code: '23000001', percent: 0.02 },
    ],
  },
  {
    id: 'peach-rosemary',
    name: 'Peach Rosemary',
    subtitle: 'Lioness',
    color: '#E87511',
    servingOz: 12,
    density: 8.456,
    brix: 1.2,
    ingredients: [
      { name: 'Filtered Water', supplier: 'Plant', code: 'n/a', percent: 75.8 },
      { name: '190 Proof Grain Ethyl Alcohol', supplier: 'Ultrapure', code: 'n/a', percent: 12.7 },
      { name: 'Cane Sugar', supplier: 'IFPC', code: '202789', percent: 7 },
      { name: 'Peach Juice Concentrate 68 Brix', supplier: 'Greenwood Associates', code: 'PCJC68F-L001-DR00', percent: 4 },
      { name: 'Yellow Peach Flavor Natural Type', supplier: 'Sapphire Flavors', code: 'SFF-257077', percent: 0.3 },
      { name: 'Rosemary Flavor Natural WONF', supplier: 'Sapphire Flavors', code: 'SFF-257075', percent: 0.05 },
      { name: 'EXBERRY Shade "Mandarin"', supplier: 'GNT', code: '429340', percent: 0.05 },
      { name: 'Citric Acid', supplier: 'IFPC', code: '202661', percent: 0.1 },
    ],
  },
]

const COMMON_INGREDIENT_NAMES = [
  '190 Proof Grain Ethyl Alcohol',
  'Cane Sugar',
  'Citric Acid',
]

// ---------------------------------------------------------------------------
// Calculation engine — mirrors the spreadsheet formulas
// ---------------------------------------------------------------------------

interface IngredientCalc {
  name: string
  supplier: string
  code: string
  percent: number
  lbsPer1000Gal: number
  totalLbs: number
}

interface DrinkCalc {
  drink: DrinkFormula
  cans: number
  overage: number
  gallons: number
  roundedGallons: number
  ingredients: IngredientCalc[]
  totalLbs: number
}

interface ProcurementItem {
  name: string
  supplier: string
  code: string
  totalLbs: number
  drinks: string[]
}

function calculateDrink(drink: DrinkFormula, cans: number): DrinkCalc {
  const overage = getOverage(cans)
  const gallons = (cans * drink.servingOz * overage) / 128
  const roundedGallons = Math.ceil(gallons)

  const ingredients: IngredientCalc[] = drink.ingredients.map((ing) => {
    const lbsPer1000Gal = ing.percent * drink.density * 10
    const totalLbs = (lbsPer1000Gal / 1000) * roundedGallons
    return {
      ...ing,
      lbsPer1000Gal,
      totalLbs,
    }
  })

  const totalLbs = ingredients.reduce((sum, i) => sum + i.totalLbs, 0)

  return { drink, cans, overage, gallons, roundedGallons, ingredients, totalLbs }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLbs(value: number): string {
  if (value === 0) return '0 lb'
  if (value < 1) return `${value.toFixed(4)} lb`
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} lb`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatGallons(value: number): string {
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} gal`
}

function csvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function IngredientBarChart({ drinkCalcs }: { drinkCalcs: DrinkCalc[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    text: string
    x: number
    y: number
  } | null>(null)

  const activeDrinks = drinkCalcs.filter((dc) => dc.cans > 0)

  const ingredientData = useMemo(() => {
    const map = new Map<string, { name: string; byDrink: { drinkName: string; color: string; lbs: number }[] }>()

    for (const dc of activeDrinks) {
      for (const ing of dc.ingredients) {
        if (ing.name === 'Filtered Water') continue
        let entry = map.get(ing.name)
        if (!entry) {
          entry = { name: ing.name, byDrink: [] }
          map.set(ing.name, entry)
        }
        entry.byDrink.push({
          drinkName: dc.drink.name,
          color: dc.drink.color,
          lbs: ing.totalLbs,
        })
      }
    }

    return Array.from(map.values())
      .map((e) => ({
        ...e,
        total: e.byDrink.reduce((s, d) => s + d.lbs, 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [activeDrinks])

  if (activeDrinks.length === 0 || ingredientData.length === 0) return null

  const maxTotal = Math.max(...ingredientData.map((d) => d.total))

  const shortName = (name: string) => {
    if (name.length <= 20) return name
    return name.slice(0, 18) + '...'
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#00BFFF]/15 flex items-center justify-center">
          <BarChart3 className="w-[18px] h-[18px] text-[#00BFFF]" />
        </div>
        <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
          Ingredient Volume
        </h2>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-5">
        {activeDrinks.map((dc) => (
          <div key={dc.drink.id} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: dc.drink.color }}
            />
            <span className="text-[11px] text-[#A0A0A0]">{dc.drink.name}</span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="space-y-2.5 relative">
        {ingredientData.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span
              className="text-xs text-[#A0A0A0] w-[140px] shrink-0 truncate text-right"
              title={item.name}
            >
              {shortName(item.name)}
            </span>
            <div className="flex-1 flex items-center h-7 bg-[#0A0A0A] rounded-lg overflow-hidden">
              {item.byDrink.map((seg, i) => {
                const widthPct = (seg.lbs / maxTotal) * 100
                return (
                  <div
                    key={seg.drinkName}
                    className="h-full transition-all duration-300 cursor-pointer relative"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: seg.color,
                      opacity: 0.85,
                      borderRight:
                        i < item.byDrink.length - 1
                          ? '1px solid #0A0A0A'
                          : undefined,
                    }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (!rect) return
                      setTooltip({
                        text: `${seg.drinkName}: ${formatLbs(seg.lbs)}`,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top - 32,
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
            <span className="text-xs text-[#666] w-[80px] shrink-0 text-right tabular-nums">
              {formatLbs(item.total)}
            </span>
          </div>
        ))}

        {tooltip && (
          <div
            className="absolute pointer-events-none bg-[#1A1A1A] border border-[#333] text-xs text-white px-2.5 py-1.5 rounded-lg shadow-lg z-10 whitespace-nowrap"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductionPieChart({ drinkCalcs }: { drinkCalcs: DrinkCalc[] }) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)
  const activeDrinks = drinkCalcs.filter((dc) => dc.cans > 0)

  if (activeDrinks.length === 0) return null

  const totalCans = activeDrinks.reduce((s, dc) => s + dc.cans, 0)
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const radius = 80
  const innerRadius = 50

  const slices = useMemo(() => {
    let startAngle = -Math.PI / 2
    return activeDrinks.map((dc) => {
      const fraction = dc.cans / totalCans
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
      const labelRadius = (radius + innerRadius) / 2
      const labelX = cx + labelRadius * Math.cos(midAngle)
      const labelY = cy + labelRadius * Math.sin(midAngle)

      let path: string
      if (activeDrinks.length === 1) {
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

      const result = {
        dc,
        path,
        fraction,
        labelX,
        labelY,
        showLabel: fraction >= 0.08,
      }

      startAngle = endAngle
      return result
    })
  }, [activeDrinks, totalCans, cx, cy, radius, innerRadius])

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
          <PieChart className="w-[18px] h-[18px] text-[#9B30FF]" />
        </div>
        <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
          Production Mix
        </h2>
      </div>

      <div className="flex items-center justify-center gap-8 flex-wrap">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="shrink-0"
        >
          {slices.map(({ dc, path, fraction, labelX, labelY, showLabel }) => (
            <g key={dc.drink.id}>
              <path
                d={path}
                fill={dc.drink.color}
                fillRule="evenodd"
                opacity={
                  hoveredSlice === null || hoveredSlice === dc.drink.id
                    ? 0.9
                    : 0.3
                }
                stroke="#141414"
                strokeWidth="2"
                className="transition-opacity duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredSlice(dc.drink.id)}
                onMouseLeave={() => setHoveredSlice(null)}
              />
              {showLabel && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="11"
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
            y={cy - 6}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="16"
            fontWeight="700"
          >
            {formatNumber(totalCans)}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#666"
            fontSize="10"
          >
            total cans
          </text>
        </svg>

        <div className="space-y-2.5">
          {activeDrinks.map((dc) => {
            const pct = ((dc.cans / totalCans) * 100).toFixed(1)
            return (
              <div
                key={dc.drink.id}
                className={`flex items-center gap-3 transition-opacity duration-200 cursor-pointer ${
                  hoveredSlice !== null && hoveredSlice !== dc.drink.id
                    ? 'opacity-40'
                    : ''
                }`}
                onMouseEnter={() => setHoveredSlice(dc.drink.id)}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: dc.drink.color }}
                />
                <div>
                  <p className="text-sm text-white font-medium">
                    {dc.drink.name}
                  </p>
                  <p className="text-xs text-[#666] tabular-nums">
                    {formatNumber(dc.cans)} cans ({pct}%)
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

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProductProcurementPage() {
  const [canCounts, setCanCounts] = useState<Record<string, number>>(
    Object.fromEntries(DRINKS.map((d) => [d.id, 0]))
  )
  const [expandedDrinks, setExpandedDrinks] = useState<Record<string, boolean>>({})

  const drinkCalcs = useMemo(() => {
    return DRINKS.map((drink) => calculateDrink(drink, canCounts[drink.id] || 0))
  }, [canCounts])

  const activeDrinks = useMemo(
    () => drinkCalcs.filter((dc) => dc.cans > 0),
    [drinkCalcs]
  )

  const procurement = useMemo<{
    common: ProcurementItem[]
    individual: ProcurementItem[]
  }>(() => {
    const itemMap = new Map<string, ProcurementItem>()

    for (const dc of activeDrinks) {
      for (const ing of dc.ingredients) {
        if (ing.name === 'Filtered Water') continue
        const existing = itemMap.get(ing.name)
        if (existing) {
          existing.totalLbs += ing.totalLbs
          if (!existing.drinks.includes(dc.drink.name)) {
            existing.drinks.push(dc.drink.name)
          }
        } else {
          itemMap.set(ing.name, {
            name: ing.name,
            supplier: ing.supplier,
            code: ing.code,
            totalLbs: ing.totalLbs,
            drinks: [dc.drink.name],
          })
        }
      }
    }

    const common: ProcurementItem[] = []
    const individual: ProcurementItem[] = []

    for (const item of itemMap.values()) {
      if (COMMON_INGREDIENT_NAMES.includes(item.name)) {
        common.push(item)
      } else {
        individual.push(item)
      }
    }

    common.sort(
      (a, b) =>
        COMMON_INGREDIENT_NAMES.indexOf(a.name) -
        COMMON_INGREDIENT_NAMES.indexOf(b.name)
    )

    return { common, individual }
  }, [activeDrinks])

  const setCansForDrink = useCallback((drinkId: string, value: string) => {
    const parsed = parseInt(value) || 0
    setCanCounts((prev) => ({ ...prev, [drinkId]: Math.max(0, parsed) }))
  }, [])

  function toggleDrink(drinkId: string) {
    setExpandedDrinks((prev) => ({ ...prev, [drinkId]: !prev[drinkId] }))
  }

  function handleReset() {
    setCanCounts(Object.fromEntries(DRINKS.map((d) => [d.id, 0])))
    setExpandedDrinks({})
  }

  function handleExport() {
    if (activeDrinks.length === 0) return
    const lines: string[] = [
      'Untamed Bevs - Product Procurement',
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'PRODUCTION INPUTS',
      'Drink,Cans,Overage,Gallons (rounded)',
      ...activeDrinks.map(
        (dc) =>
          `${csvField(dc.drink.name)},${dc.cans},${dc.overage}x,${dc.roundedGallons}`
      ),
      '',
      'PROCUREMENT LIST',
      'Ingredient,Supplier,Product Code,Total Amount (lb),Used In',
    ]
    if (procurement.common.length > 0) {
      lines.push('--- Common Ingredients ---')
      for (const item of procurement.common) {
        lines.push(
          `${csvField(item.name)},${csvField(item.supplier)},${csvField(item.code)},${item.totalLbs.toFixed(2)},${csvField(item.drinks.join(', '))}`
        )
      }
    }
    if (procurement.individual.length > 0) {
      lines.push('--- Individual Ingredients ---')
      for (const item of procurement.individual) {
        lines.push(
          `${csvField(item.name)},${csvField(item.supplier)},${csvField(item.code)},${item.totalLbs.toFixed(2)},${csvField(item.drinks.join(', '))}`
        )
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `procurement-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalCans = Object.values(canCounts).reduce((s, v) => s + v, 0)

  return (
    <div className="space-y-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-condensed uppercase tracking-wide">
            Product Procurement Tool
          </h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Calculate ingredient quantities across all drink formulas
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
            disabled={activeDrinks.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white bg-[#9B30FF] hover:bg-[#8526DB] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Drink quantity inputs — 4 across */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {drinkCalcs.map((dc) => (
          <div
            key={dc.drink.id}
            className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 transition-all duration-200"
            style={{
              borderColor: dc.cans > 0 ? `${dc.drink.color}40` : undefined,
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: dc.drink.color }}
              />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">
                  {dc.drink.name}
                </h3>
                <p className="text-xs text-[#666]">{dc.drink.subtitle}</p>
              </div>
            </div>

            <label className="block text-xs text-[#A0A0A0] mb-1">Cans</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={canCounts[dc.drink.id] || ''}
              onChange={(e) => setCansForDrink(dc.drink.id, e.target.value)}
              placeholder="0"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-white text-sm outline-none tabular-nums placeholder:text-[#333] focus:border-[#9B30FF]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />

            {dc.cans > 0 && (
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between text-[#A0A0A0]">
                  <span>Overage</span>
                  <span className="text-white tabular-nums">{dc.overage}x</span>
                </div>
                <div className="flex justify-between text-[#A0A0A0]">
                  <span>Gallons</span>
                  <span className="text-white tabular-nums">
                    {formatGallons(dc.roundedGallons)}
                  </span>
                </div>
                <div className="flex justify-between text-[#A0A0A0]">
                  <span>Density</span>
                  <span className="text-white tabular-nums">
                    {dc.drink.density} lb/gal
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary bar */}
      {totalCans > 0 && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <span className="text-xs text-[#666] uppercase tracking-wider">
              Total Cans
            </span>
            <p className="text-lg font-bold text-white tabular-nums">
              {formatNumber(totalCans)}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#666] uppercase tracking-wider">
              Active SKUs
            </span>
            <p className="text-lg font-bold text-white tabular-nums">
              {activeDrinks.length}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#666] uppercase tracking-wider">
              Ingredients to Order
            </span>
            <p className="text-lg font-bold text-white tabular-nums">
              {procurement.common.length + procurement.individual.length}
            </p>
          </div>
        </div>
      )}

      {/* Charts row */}
      {activeDrinks.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <IngredientBarChart drinkCalcs={drinkCalcs} />
          </div>
          <div>
            <ProductionPieChart drinkCalcs={drinkCalcs} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Per-drink formula breakdowns */}
        <div className="xl:col-span-1 space-y-4">
          <h2 className="flex items-center gap-3 text-base font-semibold text-white uppercase tracking-wide font-condensed">
            <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
              <Beaker className="w-[18px] h-[18px] text-[#9B30FF]" />
            </div>
            Formula Breakdowns
          </h2>

          {activeDrinks.length === 0 ? (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 text-center">
              <p className="text-sm text-[#666]">
                Set can quantities above to see formula breakdowns
              </p>
            </div>
          ) : (
            activeDrinks.map((dc) => (
              <div
                key={dc.drink.id}
                className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => toggleDrink(dc.drink.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dc.drink.color }}
                    />
                    <span className="text-sm font-medium text-white">
                      {dc.drink.name}
                    </span>
                    <span className="text-xs text-[#666] tabular-nums">
                      {formatNumber(dc.cans)} cans
                    </span>
                  </div>
                  {expandedDrinks[dc.drink.id] ? (
                    <ChevronDown className="w-4 h-4 text-[#666]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#666]" />
                  )}
                </button>

                {expandedDrinks[dc.drink.id] && (
                  <div className="px-4 pb-4 border-t border-[#1A1A1A]">
                    <div className="grid grid-cols-[1fr_80px] gap-2 pt-3 pb-2 text-[10px] text-[#666] uppercase tracking-wider">
                      <span>Ingredient</span>
                      <span className="text-right">Amount</span>
                    </div>
                    <div className="divide-y divide-[#1A1A1A]">
                      {dc.ingredients.map((ing) => (
                        <div
                          key={ing.name}
                          className="grid grid-cols-[1fr_80px] gap-2 py-2 items-start"
                        >
                          <div>
                            <span className="text-xs text-white block">
                              {ing.name}
                            </span>
                            <span className="text-[10px] text-[#666]">
                              {ing.percent}% &middot; {ing.supplier}
                            </span>
                          </div>
                          <span className="text-xs text-white text-right tabular-nums">
                            {formatLbs(ing.totalLbs)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right: Procurement summary */}
        <div className="xl:col-span-2 space-y-6">
          <h2 className="flex items-center gap-3 text-base font-semibold text-white uppercase tracking-wide font-condensed">
            <div className="w-9 h-9 rounded-xl bg-[#4A7C0F]/15 flex items-center justify-center">
              <ClipboardList className="w-[18px] h-[18px] text-[#4A7C0F]" />
            </div>
            Procurement Summary
          </h2>

          {activeDrinks.length === 0 ? (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="w-16 h-16 rounded-2xl bg-[#4A7C0F]/10 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-[#4A7C0F]/40" />
              </div>
              <p className="text-[#A0A0A0] text-sm">
                Enter can quantities to generate your procurement list
              </p>
            </div>
          ) : (
            <>
              {/* Common ingredients */}
              {procurement.common.length > 0 && (
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
                  <h3 className="text-sm font-medium text-[#D4D700] mb-4 uppercase tracking-wider">
                    Common Ingredients (shared across drinks)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2A2A2A]">
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Ingredient
                          </th>
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Supplier
                          </th>
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Code
                          </th>
                          <th className="text-right text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Total (lb)
                          </th>
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2">
                            Used In
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1A1A]">
                        {procurement.common.map((item) => (
                          <tr key={item.name}>
                            <td className="text-white py-3 pr-4 font-medium">
                              {item.name}
                            </td>
                            <td className="text-[#A0A0A0] py-3 pr-4">
                              {item.supplier}
                            </td>
                            <td className="text-[#A0A0A0] py-3 pr-4 font-mono text-xs">
                              {item.code}
                            </td>
                            <td className="text-white py-3 pr-4 text-right tabular-nums font-medium">
                              {formatLbs(item.totalLbs)}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-1">
                                {item.drinks.map((d) => {
                                  const drink = DRINKS.find(
                                    (dr) => dr.name === d
                                  )
                                  return (
                                    <span
                                      key={d}
                                      className="text-[10px] px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: `${drink?.color || '#666'}20`,
                                        color: drink?.color || '#666',
                                      }}
                                    >
                                      {d}
                                    </span>
                                  )
                                })}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Individual ingredients */}
              {procurement.individual.length > 0 && (
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
                  <h3 className="text-sm font-medium text-[#E87511] mb-4 uppercase tracking-wider">
                    Individual Ingredients (drink-specific)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2A2A2A]">
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Ingredient
                          </th>
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Supplier
                          </th>
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Code
                          </th>
                          <th className="text-right text-[#666] text-xs uppercase tracking-wider py-2 pr-4">
                            Total (lb)
                          </th>
                          <th className="text-left text-[#666] text-xs uppercase tracking-wider py-2">
                            Drink
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1A1A]">
                        {procurement.individual.map((item) => (
                          <tr key={item.name}>
                            <td className="text-white py-3 pr-4 font-medium">
                              {item.name}
                            </td>
                            <td className="text-[#A0A0A0] py-3 pr-4">
                              {item.supplier}
                            </td>
                            <td className="text-[#A0A0A0] py-3 pr-4 font-mono text-xs">
                              {item.code}
                            </td>
                            <td className="text-white py-3 pr-4 text-right tabular-nums font-medium">
                              {formatLbs(item.totalLbs)}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-1">
                                {item.drinks.map((d) => {
                                  const drink = DRINKS.find(
                                    (dr) => dr.name === d
                                  )
                                  return (
                                    <span
                                      key={d}
                                      className="text-[10px] px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: `${drink?.color || '#666'}20`,
                                        color: drink?.color || '#666',
                                      }}
                                    >
                                      {d}
                                    </span>
                                  )
                                })}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Overage reference */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <h3 className="text-sm font-medium text-[#00BFFF] mb-4 uppercase tracking-wider">
              Overage Factor Reference
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {OVERAGE_TIERS.map((tier) => (
                <div
                  key={tier.min}
                  className={`bg-[#0A0A0A] rounded-xl px-3 py-2.5 text-center ${
                    activeDrinks.some((dc) => dc.overage === tier.factor)
                      ? 'border border-[#9B30FF]/40'
                      : 'border border-transparent'
                  }`}
                >
                  <p className="text-xs text-[#666] mb-0.5">
                    {formatNumber(tier.min)}
                    {tier.max ? `–${formatNumber(tier.max)}` : '+'}
                  </p>
                  <p className="text-sm font-semibold text-white tabular-nums">
                    {tier.factor}x
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
