'use client'

import { useState, useMemo } from 'react'
import {
  Target,
  Plus,
  Trash2,
  DollarSign,
  BarChart3,
  TrendingUp,
  Award,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Package,
  Zap,
  Info,
  Store,
  Globe,
} from 'lucide-react'

type Channel = 'retail' | 'dtc'

type Brand = {
  name: string
  canOz: number
  retailPricePerOz: number
  dtcPricePerOz: number
  packQty: number
  abv: number
  isUntamed?: boolean
  color: string
}

type BrandMetrics = Brand & {
  activePricePerOz: number
  canPrice: number
  packPrice: number
  alcoholOz: number
  pricePerAlcoholOz: number
  standardDrinks: number
  pricePerStdDrink: number
  category: 'full' | 'mid' | 'cocktail'
}

const COMPETITORS: Brand[] = [
  { name: 'Social Hour', canOz: 8.45, retailPricePerOz: 0.592, dtcPricePerOz: 0, packQty: 4, abv: 0.11, color: '#6366F1' },
  { name: 'Night Owl', canOz: 6.8, retailPricePerOz: 0.74, dtcPricePerOz: 0, packQty: 4, abv: 0.125, color: '#8B5CF6' },
  { name: 'Post Meridiem', canOz: 3.4, retailPricePerOz: 1.32, dtcPricePerOz: 0, packQty: 8, abv: 0.22, color: '#EC4899' },
  { name: 'Top Dog', canOz: 6.8, retailPricePerOz: 0.53, dtcPricePerOz: 0, packQty: 4, abv: 0.125, color: '#14B8A6' },
  { name: 'Tip Top', canOz: 3.4, retailPricePerOz: 1.77, dtcPricePerOz: 0, packQty: 4, abv: 0.22, color: '#F97316' },
  { name: 'Gold Rush', canOz: 8.45, retailPricePerOz: 0.80, dtcPricePerOz: 0, packQty: 4, abv: 0.131, color: '#EAB308' },
  { name: 'Loverboy', canOz: 8.45, retailPricePerOz: 0.59, dtcPricePerOz: 0, packQty: 4, abv: 0.12, color: '#F472B6' },
  { name: 'Straightaway', canOz: 3.45, retailPricePerOz: 1.76, dtcPricePerOz: 0, packQty: 4, abv: 0.23, color: '#22D3EE' },
]

const CATEGORY_LABELS: Record<string, string> = {
  full: 'Full Size (8+ oz)',
  mid: 'Mid Size (5–8 oz)',
  cocktail: 'Cocktail Shot (< 5 oz)',
}

function getCategory(canOz: number): 'full' | 'mid' | 'cocktail' {
  if (canOz >= 8) return 'full'
  if (canOz >= 5) return 'mid'
  return 'cocktail'
}

function computeMetrics(brand: Brand, channel: Channel): BrandMetrics {
  const activePricePerOz = channel === 'dtc' && brand.dtcPricePerOz > 0
    ? brand.dtcPricePerOz
    : brand.retailPricePerOz
  const canPrice = brand.canOz * activePricePerOz
  const packPrice = canPrice * brand.packQty
  const alcoholOz = brand.canOz * brand.abv
  const pricePerAlcoholOz = alcoholOz > 0 ? canPrice / alcoholOz : 0
  const standardDrinks = alcoholOz / 0.6
  const pricePerStdDrink = standardDrinks > 0 ? canPrice / standardDrinks : 0
  return {
    ...brand,
    activePricePerOz,
    canPrice,
    packPrice,
    alcoholOz,
    pricePerAlcoholOz,
    standardDrinks,
    pricePerStdDrink,
    category: getCategory(brand.canOz),
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

type SortKey = 'name' | 'canOz' | 'activePricePerOz' | 'abv' | 'canPrice' | 'packPrice' | 'pricePerAlcoholOz' | 'pricePerStdDrink'
type SortDir = 'asc' | 'desc'

function HorizontalBarChart({
  data,
  valueKey,
  formatValue,
  title,
  icon: Icon,
  iconColor,
  iconBg,
  lowerIsBetter = false,
}: {
  data: BrandMetrics[]
  valueKey: keyof BrandMetrics
  formatValue: (v: number) => string
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  lowerIsBetter?: boolean
}) {
  const sorted = [...data].sort((a, b) => {
    const av = a[valueKey] as number
    const bv = b[valueKey] as number
    return lowerIsBetter ? av - bv : bv - av
  })

  const maxVal = Math.max(...sorted.map(d => d[valueKey] as number))
  const barHeight = 28
  const gap = 8
  const labelWidth = 120
  const valueWidth = 80
  const chartLeft = labelWidth + 10
  const chartRight = valueWidth + 10
  const svgWidth = 600
  const barAreaWidth = svgWidth - chartLeft - chartRight
  const svgHeight = sorted.length * (barHeight + gap) + gap

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${iconColor}`} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
            {title}
          </h2>
          {lowerIsBetter && (
            <p className="text-xs text-[#666] mt-0.5">Lower = better value</p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="min-w-[480px]">
          {sorted.map((brand, i) => {
            const val = brand[valueKey] as number
            const barW = maxVal > 0 ? (val / maxVal) * barAreaWidth : 0
            const y = gap + i * (barHeight + gap)
            return (
              <g key={brand.name}>
                <text
                  x={chartLeft - 10}
                  y={y + barHeight / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill={brand.isUntamed ? '#9B30FF' : '#A0A0A0'}
                  fontSize="11"
                  fontWeight={brand.isUntamed ? '600' : '400'}
                >
                  {brand.name.length > 14 ? brand.name.slice(0, 12) + '\u2026' : brand.name}
                </text>
                <rect x={chartLeft} y={y} width={barAreaWidth} height={barHeight} rx={6} fill="#0A0A0A" />
                <rect
                  x={chartLeft}
                  y={y}
                  width={Math.max(barW, 4)}
                  height={barHeight}
                  rx={6}
                  fill={brand.isUntamed ? '#9B30FF' : brand.color}
                  opacity={brand.isUntamed ? 1 : 0.75}
                />
                <text
                  x={chartLeft + barAreaWidth + 10}
                  y={y + barHeight / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fill={brand.isUntamed ? '#9B30FF' : 'white'}
                  fontSize="11"
                  fontWeight={brand.isUntamed ? '700' : '500'}
                >
                  {formatValue(val)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function MarketScatter({ data }: { data: BrandMetrics[] }) {
  const padding = { top: 30, right: 30, bottom: 45, left: 55 }
  const width = 600
  const height = 350
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const prices = data.map(d => d.canPrice)
  const abvs = data.map(d => d.abv * 100)

  const minPrice = Math.floor(Math.min(...prices) * 2) / 2 - 0.5
  const maxPrice = Math.ceil(Math.max(...prices) * 2) / 2 + 0.5
  const minAbv = Math.floor(Math.min(...abvs)) - 1
  const maxAbv = Math.ceil(Math.max(...abvs)) + 1

  function xScale(v: number) {
    return padding.left + ((v - minPrice) / (maxPrice - minPrice)) * plotW
  }
  function yScale(v: number) {
    return padding.top + plotH - ((v - minAbv) / (maxAbv - minAbv)) * plotH
  }

  const priceTicks: number[] = []
  for (let p = Math.ceil(minPrice); p <= Math.floor(maxPrice); p += 1) priceTicks.push(p)
  const abvTicks: number[] = []
  for (let a = Math.ceil(minAbv / 2) * 2; a <= Math.floor(maxAbv); a += 2) abvTicks.push(a)

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
          <Target className="w-[18px] h-[18px] text-[#9B30FF]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
            Market Position Map
          </h2>
          <p className="text-xs text-[#666] mt-0.5">Can Price vs ABV — bubble size = can volume</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="min-w-[480px]">
          {priceTicks.map(p => (
            <g key={`gp${p}`}>
              <line x1={xScale(p)} y1={padding.top} x2={xScale(p)} y2={padding.top + plotH} stroke="#1A1A1A" />
              <text x={xScale(p)} y={padding.top + plotH + 20} textAnchor="middle" fill="#666" fontSize="10">${p}</text>
            </g>
          ))}
          {abvTicks.map(a => (
            <g key={`ga${a}`}>
              <line x1={padding.left} y1={yScale(a)} x2={padding.left + plotW} y2={yScale(a)} stroke="#1A1A1A" />
              <text x={padding.left - 10} y={yScale(a)} textAnchor="end" dominantBaseline="central" fill="#666" fontSize="10">{a}%</text>
            </g>
          ))}
          <text x={padding.left + plotW / 2} y={height - 5} textAnchor="middle" fill="#A0A0A0" fontSize="11">Can Price</text>
          <text
            x={14}
            y={padding.top + plotH / 2}
            textAnchor="middle"
            fill="#A0A0A0"
            fontSize="11"
            transform={`rotate(-90, 14, ${padding.top + plotH / 2})`}
          >
            ABV %
          </text>

          {data.map(brand => {
            const cx = xScale(brand.canPrice)
            const cy = yScale(brand.abv * 100)
            const r = Math.max(6, Math.min(20, brand.canOz * 2))
            return (
              <g key={brand.name}>
                {brand.isUntamed && (
                  <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#9B30FF" strokeWidth="2" strokeDasharray="4 2" opacity="0.6" />
                )}
                <circle cx={cx} cy={cy} r={r} fill={brand.isUntamed ? '#9B30FF' : brand.color} opacity={brand.isUntamed ? 1 : 0.7} />
                <text
                  x={cx}
                  y={cy - r - 5}
                  textAnchor="middle"
                  fill={brand.isUntamed ? '#9B30FF' : '#A0A0A0'}
                  fontSize="9"
                  fontWeight={brand.isUntamed ? '700' : '400'}
                >
                  {brand.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default function CompetitivePricingPage() {
  const [channel, setChannel] = useState<Channel>('retail')

  const [untamedProducts, setUntamedProducts] = useState<Brand[]>([
    { name: 'Untamed', canOz: 12, retailPricePerOz: 0.50, dtcPricePerOz: 0, packQty: 4, abv: 0.15, isUntamed: true, color: '#9B30FF' },
  ])

  const [sortKey, setSortKey] = useState<SortKey>('canPrice')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'full' | 'mid' | 'cocktail'>('all')

  const allBrands = useMemo(() => {
    const validUntamed = untamedProducts.filter(p => {
      const price = channel === 'dtc' ? (p.dtcPricePerOz || p.retailPricePerOz) : p.retailPricePerOz
      return p.canOz > 0 && price > 0 && p.abv > 0
    })
    return [...COMPETITORS, ...validUntamed].map(b => computeMetrics(b, channel))
  }, [untamedProducts, channel])

  const filteredBrands = useMemo(() => {
    if (categoryFilter === 'all') return allBrands
    return allBrands.filter(b => b.category === categoryFilter)
  }, [allBrands, categoryFilter])

  const sortedBrands = useMemo(() => {
    return [...filteredBrands].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [filteredBrands, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function updateUntamed(index: number, updates: Partial<Brand>) {
    setUntamedProducts(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  function addUntamedProduct() {
    setUntamedProducts(prev => [
      ...prev,
      { name: `Untamed ${prev.length + 1}`, canOz: 0, retailPricePerOz: 0, dtcPricePerOz: 0, packQty: 4, abv: 0, isUntamed: true, color: '#9B30FF' },
    ])
  }

  function removeUntamedProduct(index: number) {
    setUntamedProducts(prev => prev.filter((_, i) => i !== index))
  }

  const untamedMetrics = useMemo(() => allBrands.filter(b => b.isUntamed), [allBrands])

  type Recommendation = {
    product: BrandMetrics
    categoryName: string
    competitorCount: number
    lowestPricePerOz: number
    highestPricePerOz: number
    averagePricePerOz: number
    rank: number
    totalInCategory: number
  }

  const recommendations = useMemo<Recommendation[]>(() => {
    const results: Recommendation[] = []
    for (const product of untamedMetrics) {
      const sameCategory = allBrands.filter(b => b.category === product.category && !b.isUntamed)
      if (sameCategory.length === 0) continue

      const pricesPerOz = sameCategory.map(b => b.activePricePerOz)
      const lowest = Math.min(...pricesPerOz)
      const highest = Math.max(...pricesPerOz)
      const average = pricesPerOz.reduce((s, p) => s + p, 0) / pricesPerOz.length

      const ranked = allBrands
        .filter(b => b.category === product.category)
        .sort((a, b) => a.canPrice - b.canPrice)
      const rank = ranked.findIndex(b => b.name === product.name) + 1

      results.push({
        product,
        categoryName: CATEGORY_LABELS[product.category],
        competitorCount: sameCategory.length,
        lowestPricePerOz: lowest,
        highestPricePerOz: highest,
        averagePricePerOz: average,
        rank,
        totalInCategory: ranked.length,
      })
    }
    return results
  }, [untamedMetrics, allBrands])

  function handleExport() {
    const headers = ['Brand', 'Can Size (oz)', 'Pack Qty', `$/oz (${channel})`, 'ABV', 'Can Price', 'Pack Price', 'Alcohol (oz)', '$/oz Alcohol', 'Std Drinks', '$/Std Drink', 'Category']
    const rows = sortedBrands.map(b => [
      b.name,
      b.canOz.toFixed(2),
      b.packQty,
      b.activePricePerOz.toFixed(3),
      (b.abv * 100).toFixed(1) + '%',
      b.canPrice.toFixed(2),
      b.packPrice.toFixed(2),
      b.alcoholOz.toFixed(3),
      b.pricePerAlcoholOz.toFixed(2),
      b.standardDrinks.toFixed(2),
      b.pricePerStdDrink.toFixed(2),
      CATEGORY_LABELS[b.category],
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `competitive-pricing-${channel}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const kpis = useMemo(() => {
    if (filteredBrands.length === 0) return []
    const sorted = {
      byPricePerOz: [...filteredBrands].sort((a, b) => a.activePricePerOz - b.activePricePerOz),
      byValue: [...filteredBrands].sort((a, b) => a.pricePerAlcoholOz - b.pricePerAlcoholOz),
      byAbv: [...filteredBrands].sort((a, b) => b.abv - a.abv),
    }
    return [
      {
        label: 'Lowest $/oz',
        value: `$${sorted.byPricePerOz[0].activePricePerOz.toFixed(3)}`,
        sub: sorted.byPricePerOz[0].name,
        color: '#4A7C0F',
      },
      {
        label: 'Avg Can Price',
        value: formatCurrency(filteredBrands.reduce((s, b) => s + b.canPrice, 0) / filteredBrands.length),
        sub: `${filteredBrands.length} brands`,
        color: '#D4D700',
      },
      {
        label: 'Best Value ($/alc oz)',
        value: formatCurrency(sorted.byValue[0].pricePerAlcoholOz),
        sub: sorted.byValue[0].name,
        color: '#00BFFF',
      },
      {
        label: 'Highest ABV',
        value: `${(sorted.byAbv[0].abv * 100).toFixed(1)}%`,
        sub: sorted.byAbv[0].name,
        color: '#E87511',
      },
    ]
  }, [filteredBrands])

  const synopses = useMemo(() => {
    if (untamedMetrics.length === 0) return []
    return untamedMetrics.map(product => {
      const competitors = allBrands.filter(b => !b.isUntamed)
      const total = allBrands.length

      const rankIn = (arr: BrandMetrics[], name: string) => arr.findIndex(b => b.name === name) + 1
      const r = {
        stdDrinkPrice: rankIn([...allBrands].sort((a, b) => a.pricePerStdDrink - b.pricePerStdDrink), product.name),
        pricePerOz: rankIn([...allBrands].sort((a, b) => a.activePricePerOz - b.activePricePerOz), product.name),
        canPrice: rankIn([...allBrands].sort((a, b) => a.canPrice - b.canPrice), product.name),
        abv: rankIn([...allBrands].sort((a, b) => b.abv - a.abv), product.name),
        canSize: rankIn([...allBrands].sort((a, b) => b.canOz - a.canOz), product.name),
        alcoholContent: rankIn([...allBrands].sort((a, b) => b.alcoholOz - a.alcoholOz), product.name),
        pricePerAlcOz: rankIn([...allBrands].sort((a, b) => a.pricePerAlcoholOz - b.pricePerAlcoholOz), product.name),
      }

      const channelLabel = channel === 'dtc' ? 'DTC' : 'retail'
      let text = `At $${product.activePricePerOz.toFixed(2)}/oz ${channelLabel} with a ${product.canOz} oz can, that's a ${formatCurrency(product.canPrice)} can / ${formatCurrency(product.packPrice)} ${product.packQty}-pack and ${formatCurrency(product.pricePerStdDrink)} per standard drink`
      if (r.stdDrinkPrice === 1) {
        text += ` \u2014 the lowest cost per standard drink on the entire board.`
      } else {
        text += ` (#${r.stdDrinkPrice} of ${total} for value per drink).`
      }

      const wins: string[] = []
      if (r.canSize === 1) wins.push('the biggest can')
      if (r.abv === 1) wins.push('the highest ABV')
      if (r.alcoholContent === 1) wins.push('the most alcohol per can')
      if (r.pricePerOz === 1) wins.push('the lowest price per ounce')
      if (r.pricePerAlcOz === 1) wins.push('the best value per oz of alcohol')
      if (r.canPrice === 1) wins.push('the lowest can price')

      if (wins.length >= 2) {
        text += ` You have ${wins.slice(0, -1).join(', ')} and ${wins[wins.length - 1]} in the market.`
      } else if (wins.length === 1) {
        text += ` You have ${wins[0]} in the market.`
      }

      const avgStdDrinkPrice = competitors.reduce((s, b) => s + b.pricePerStdDrink, 0) / competitors.length
      const pctVsAvg = ((product.pricePerStdDrink - avgStdDrinkPrice) / avgStdDrinkPrice) * 100
      if (pctVsAvg < -20) {
        text += ` At ${Math.abs(Math.round(pctVsAvg))}% below the competitor average on cost per drink, you're firmly in value-leader territory.`
      } else if (pctVsAvg < -5) {
        text += ` You're ${Math.abs(Math.round(pctVsAvg))}% below the competitor average on cost per drink \u2014 undercutting most of the field on value.`
      } else if (pctVsAvg <= 5) {
        text += ` Your cost per drink is roughly in line with the market average.`
      } else if (pctVsAvg <= 20) {
        text += ` You're ${Math.round(pctVsAvg)}% above the competitor average on cost per drink \u2014 moderate premium positioning.`
      } else {
        text += ` At ${Math.round(pctVsAvg)}% above the competitor average, you're positioned as a premium product.`
      }

      const closest = [...competitors]
        .map(b => ({ ...b, diff: Math.abs(b.pricePerStdDrink - product.pricePerStdDrink) }))
        .sort((a, b) => a.diff - b.diff)[0]
      if (closest) {
        text += ` Closest competitor by value: ${closest.name} at ${formatCurrency(closest.pricePerStdDrink)}/drink (${closest.canOz} oz, ${(closest.abv * 100).toFixed(1)}% ABV).`
      }

      return { name: product.name, text }
    })
  }, [untamedMetrics, allBrands, channel])

  const inputCls = "w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-white text-sm outline-none tabular-nums placeholder:text-[#333] focus:border-[#9B30FF]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

  return (
    <div className="space-y-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-condensed uppercase tracking-wide">
            Competitive Pricing Analysis
          </h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            {channel === 'retail'
              ? 'Comparing retail pricing across the canned cocktail market'
              : 'Comparing DTC pricing — competitor data shown at retail where DTC is unavailable'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Channel Toggle */}
          <div className="flex bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden">
            <button
              onClick={() => setChannel('retail')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all duration-200 ${
                channel === 'retail'
                  ? 'bg-[#9B30FF] text-white'
                  : 'text-[#A0A0A0] hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Retail
            </button>
            <button
              onClick={() => setChannel('dtc')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all duration-200 ${
                channel === 'dtc'
                  ? 'bg-[#9B30FF] text-white'
                  : 'text-[#A0A0A0] hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              DTC
            </button>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white bg-[#9B30FF] hover:bg-[#8526DB] transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Untamed Product Inputs */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
                  <Package className="w-[18px] h-[18px] text-[#9B30FF]" />
                </div>
                <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                  Your Products
                </h2>
              </div>
              <button
                onClick={addUntamedProduct}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#9B30FF] hover:bg-[#9B30FF]/10 border border-[#9B30FF]/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add SKU
              </button>
            </div>

            <div className="space-y-5">
              {untamedProducts.map((product, idx) => (
                <div key={idx} className="space-y-3">
                  {idx > 0 && <div className="border-t border-[#2A2A2A] pt-4" />}
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) => updateUntamed(idx, { name: e.target.value })}
                      className="bg-transparent text-sm text-white font-medium outline-none border-b border-transparent focus:border-[#9B30FF]/50 transition-colors"
                    />
                    {untamedProducts.length > 1 && (
                      <button onClick={() => removeUntamedProduct(idx)} className="text-[#666] hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#A0A0A0] mb-1">Can Size (oz)</label>
                      <input
                        type="number" min={0} step={0.1}
                        value={product.canOz || ''}
                        onChange={(e) => updateUntamed(idx, { canOz: parseFloat(e.target.value) || 0 })}
                        placeholder="12"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#A0A0A0] mb-1">Pack Qty</label>
                      <input
                        type="number" min={1} step={1}
                        value={product.packQty || ''}
                        onChange={(e) => updateUntamed(idx, { packQty: Math.max(1, parseInt(e.target.value) || 1) })}
                        placeholder="4"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#A0A0A0] mb-1">Retail $/oz</label>
                    <input
                      type="number" min={0} step={0.01}
                      value={product.retailPricePerOz || ''}
                      onChange={(e) => updateUntamed(idx, { retailPricePerOz: parseFloat(e.target.value) || 0 })}
                      placeholder="0.50"
                      className={inputCls}
                    />
                    {product.retailPricePerOz > 0 && product.canOz > 0 && (
                      <p className="text-[10px] text-[#666] mt-1 tabular-nums">
                        = {formatCurrency(product.canOz * product.retailPricePerOz)}/can &middot; {formatCurrency(product.canOz * product.retailPricePerOz * product.packQty)}/{product.packQty}-pack
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-[#A0A0A0] mb-1">DTC $/oz</label>
                    <input
                      type="number" min={0} step={0.01}
                      value={product.dtcPricePerOz || ''}
                      onChange={(e) => updateUntamed(idx, { dtcPricePerOz: parseFloat(e.target.value) || 0 })}
                      placeholder="0.65"
                      className={inputCls}
                    />
                    {product.dtcPricePerOz > 0 && product.canOz > 0 && (
                      <p className="text-[10px] text-[#666] mt-1 tabular-nums">
                        = {formatCurrency(product.canOz * product.dtcPricePerOz)}/can &middot; {formatCurrency(product.canOz * product.dtcPricePerOz * product.packQty)}/{product.packQty}-pack
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-[#A0A0A0] mb-1">ABV (%)</label>
                    <input
                      type="number" min={0} max={100} step={0.1}
                      value={product.abv ? product.abv * 100 : ''}
                      onChange={(e) => updateUntamed(idx, { abv: (parseFloat(e.target.value) || 0) / 100 })}
                      placeholder="15"
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Insights */}
          {recommendations.map((rec, idx) => (
            <div key={idx} className="bg-[#141414] border-2 border-[#9B30FF]/40 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(ellipse at top right, #9B30FF, transparent 70%)' }} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
                    <Award className="w-[18px] h-[18px] text-[#9B30FF]" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                      {rec.product.name}
                    </h2>
                    <p className="text-xs text-[#666]">{rec.categoryName} &middot; {channel === 'dtc' ? 'DTC' : 'Retail'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#A0A0A0]">Can Price</span>
                    <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(rec.product.canPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#A0A0A0]">{rec.product.packQty}-Pack Price</span>
                    <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(rec.product.packPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#A0A0A0]">Price Rank (low to high)</span>
                    <span className="text-sm font-semibold text-[#9B30FF] tabular-nums">#{rec.rank} of {rec.totalInCategory}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#A0A0A0]">Std Drinks / Can</span>
                    <span className="text-sm font-semibold text-white tabular-nums">{rec.product.standardDrinks.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-[#2A2A2A] pt-3 mt-2">
                    <p className="text-xs text-[#A0A0A0] mb-2 uppercase tracking-wider">Category $/oz Range</p>
                    <div className="relative h-8 bg-[#0A0A0A] rounded-lg overflow-visible">
                      <div className="absolute top-1 bottom-1 left-[5%] right-[5%] rounded bg-[#2A2A2A]" />
                      {allBrands
                        .filter(b => b.category === rec.product.category && !b.isUntamed)
                        .map(b => {
                          const range = rec.highestPricePerOz - rec.lowestPricePerOz
                          const pos = range > 0 ? ((b.activePricePerOz - rec.lowestPricePerOz) / range) * 90 + 5 : 50
                          return (
                            <div
                              key={b.name}
                              className="absolute top-1/2 -translate-y-1/2 w-2 h-4 rounded-sm"
                              style={{ left: `${pos}%`, backgroundColor: b.color, opacity: 0.6 }}
                              title={`${b.name}: $${b.activePricePerOz.toFixed(3)}/oz`}
                            />
                          )
                        })}
                      {(() => {
                        const range = rec.highestPricePerOz - rec.lowestPricePerOz
                        const raw = range > 0 ? ((rec.product.activePricePerOz - rec.lowestPricePerOz) / range) * 90 + 5 : 50
                        const pos = Math.min(95, Math.max(5, raw))
                        return (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-6 rounded-sm border-2 border-white"
                            style={{ left: `${pos}%`, backgroundColor: '#9B30FF' }}
                          />
                        )
                      })()}
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-[#666] tabular-nums">${rec.lowestPricePerOz.toFixed(3)}</span>
                      <span className="text-[10px] text-[#666] tabular-nums">${rec.highestPricePerOz.toFixed(3)}</span>
                    </div>
                  </div>

                  <div className="border-t border-[#2A2A2A] pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#A0A0A0]">Value Leader</span>
                      <span className="text-xs text-[#4A7C0F] tabular-nums font-medium">${rec.lowestPricePerOz.toFixed(3)}/oz</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#A0A0A0]">Category Average</span>
                      <span className="text-xs text-[#D4D700] tabular-nums font-medium">${rec.averagePricePerOz.toFixed(3)}/oz</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#A0A0A0]">Premium Position</span>
                      <span className="text-xs text-[#E87511] tabular-nums font-medium">${rec.highestPricePerOz.toFixed(3)}/oz</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Category Filter */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#00BFFF]/15 flex items-center justify-center">
                <Filter className="w-[18px] h-[18px] text-[#00BFFF]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                Size Category
              </h2>
            </div>
            <div className="space-y-2">
              {(['all', 'full', 'mid', 'cocktail'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    categoryFilter === cat
                      ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                      : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  {cat === 'all' ? 'All Sizes' : CATEGORY_LABELS[cat]}
                  <span className="text-xs ml-2 text-[#666]">
                    ({cat === 'all' ? allBrands.length : allBrands.filter(b => b.category === cat).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPI cards */}
          {kpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.map(kpi => (
                <div key={kpi.label} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">
                  <p className="text-[10px] text-[#A0A0A0] uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-xs text-[#666] mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {synopses.length > 0 && (
            <div className="space-y-4">
              {synopses.map(s => (
                <div key={s.name} className="bg-[#141414] border-2 border-[#9B30FF]/40 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(ellipse at top left, #9B30FF, transparent 70%)' }} />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
                        <Zap className="w-[18px] h-[18px] text-[#9B30FF]" />
                      </div>
                      <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                        {untamedMetrics.length > 1 ? s.name : 'Market'} Synopsis
                      </h2>
                    </div>
                    <p className="text-sm text-[#C0C0C0] leading-relaxed">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comparison Table */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#4A7C0F]/15 flex items-center justify-center">
                <BarChart3 className="w-[18px] h-[18px] text-[#4A7C0F]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-condensed">
                Competitive Comparison
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    {([
                      { key: 'name' as SortKey, label: 'Brand', align: 'left' as const },
                      { key: 'canOz' as SortKey, label: 'Size', align: 'right' as const },
                      { key: 'activePricePerOz' as SortKey, label: '$/oz', align: 'right' as const },
                      { key: 'abv' as SortKey, label: 'ABV', align: 'right' as const },
                      { key: 'canPrice' as SortKey, label: 'Can', align: 'right' as const },
                      { key: 'packPrice' as SortKey, label: 'Pack', align: 'right' as const },
                      { key: 'pricePerAlcoholOz' as SortKey, label: '$/oz Alc', align: 'right' as const, tip: '1 std drink = 0.6 oz pure alcohol (NIAAA)' },
                      { key: 'pricePerStdDrink' as SortKey, label: '$/Std Drink', align: 'right' as const, tip: '1 std drink = 0.6 oz pure alcohol (NIAAA)' },
                    ]).map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        title={col.tip}
                        className={`text-xs uppercase tracking-wider py-2.5 px-2 cursor-pointer hover:text-white transition-colors whitespace-nowrap ${
                          col.align === 'left' ? 'text-left' : 'text-right'
                        } ${sortKey === col.key ? 'text-[#9B30FF]' : 'text-[#666]'}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {sortedBrands.map(brand => (
                    <tr key={brand.name} className={`transition-colors ${brand.isUntamed ? 'bg-[#9B30FF]/5' : 'hover:bg-[#1A1A1A]'}`}>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: brand.color }} />
                          <span className={`font-medium whitespace-nowrap ${brand.isUntamed ? 'text-[#9B30FF]' : 'text-white'}`}>
                            {brand.name}
                          </span>
                          {brand.isUntamed && (
                            <span className="text-[9px] uppercase tracking-wider bg-[#9B30FF]/20 text-[#9B30FF] px-1.5 py-0.5 rounded">You</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-2 text-[#A0A0A0] tabular-nums">{brand.canOz} oz</td>
                      <td className={`text-right py-2.5 px-2 tabular-nums ${brand.isUntamed ? 'text-[#9B30FF] font-medium' : 'text-white'}`}>
                        ${brand.activePricePerOz.toFixed(3)}
                      </td>
                      <td className="text-right py-2.5 px-2 text-[#A0A0A0] tabular-nums">{(brand.abv * 100).toFixed(1)}%</td>
                      <td className={`text-right py-2.5 px-2 tabular-nums font-medium ${brand.isUntamed ? 'text-[#9B30FF]' : 'text-white'}`}>
                        {formatCurrency(brand.canPrice)}
                      </td>
                      <td className="text-right py-2.5 px-2 text-[#A0A0A0] tabular-nums">
                        {formatCurrency(brand.packPrice)}
                        <span className="text-[10px] text-[#666] ml-1">/{brand.packQty}pk</span>
                      </td>
                      <td className="text-right py-2.5 px-2 text-[#A0A0A0] tabular-nums">{formatCurrency(brand.pricePerAlcoholOz)}</td>
                      <td className="text-right py-2.5 px-2 text-[#A0A0A0] tabular-nums">{formatCurrency(brand.pricePerStdDrink)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2A2A2A] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#666] shrink-0 mt-0.5" />
              <div className="text-xs text-[#666] leading-relaxed">
                <p>
                  <span className="text-[#A0A0A0] font-medium">Standard drink</span> = 0.6 oz of pure alcohol (NIAAA definition). That&apos;s equivalent to 12 oz of beer (5% ABV), 5 oz of wine (12% ABV), or 1.5 oz of spirits (40% ABV). Calculated as: <span className="text-[#A0A0A0]">can size &times; ABV &divide; 0.6</span>.
                </p>
                <p className="mt-1">
                  <span className="text-[#A0A0A0] font-medium">$/oz Alc</span> = can price &divide; oz of pure alcohol in the can. <span className="text-[#A0A0A0] font-medium">$/Std Drink</span> = can price &divide; standard drinks per can. <span className="text-[#A0A0A0] font-medium">Pack</span> = can price &times; pack quantity.
                </p>
                {channel === 'dtc' && (
                  <p className="mt-1 text-[#E87511]">
                    Competitor prices shown at retail — DTC data not available. Your products use DTC pricing (falls back to retail if DTC is blank).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bar Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <HorizontalBarChart
              data={filteredBrands}
              valueKey="canPrice"
              formatValue={v => formatCurrency(v)}
              title="Can Price"
              icon={DollarSign}
              iconColor="text-[#4A7C0F]"
              iconBg="bg-[#4A7C0F]/15"
            />
            <HorizontalBarChart
              data={filteredBrands}
              valueKey="pricePerAlcoholOz"
              formatValue={v => formatCurrency(v)}
              title="Price per oz Alcohol"
              icon={TrendingUp}
              iconColor="text-[#E87511]"
              iconBg="bg-[#E87511]/15"
              lowerIsBetter
            />
          </div>

          {/* Market Position Scatter */}
          <MarketScatter data={filteredBrands} />
        </div>
      </div>
    </div>
  )
}
