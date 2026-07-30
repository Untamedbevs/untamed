'use client'

/**
 * Lightweight branded SVG charts for the investor deck.
 * No chart library — everything is hand-drawn SVG scaled via viewBox.
 */

interface Series {
  name: string
  color: string
  values: number[]
}

const W = 800
const H = 420
const PAD = { top: 28, right: 96, bottom: 44, left: 64 }

function xAt(i: number, n: number) {
  return PAD.left + (i * (W - PAD.left - PAD.right)) / (n - 1)
}

function yScale(v: number, min: number, max: number) {
  return PAD.top + ((max - v) / (max - min)) * (H - PAD.top - PAD.bottom)
}

function ChartLegend({ series }: { series: Series[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 print:mt-2">
      {series.map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="font-condensed text-xs uppercase tracking-widest text-untamed-white-muted md:text-sm">
            {s.name}
          </span>
        </div>
      ))}
    </div>
  )
}

interface LineChartProps {
  series: Series[]
  categories: string[]
  yMin: number
  yMax: number
  yTicks: number[]
  formatTick?: (v: number) => string
  formatEnd?: (v: number) => string
  zeroLineLabel?: string
}

export function ScenarioLineChart({
  series,
  categories,
  yMin,
  yMax,
  yTicks,
  formatTick = (v) => `$${v}M`,
  formatEnd = (v) => `$${v}M`,
  zeroLineLabel,
}: LineChartProps) {
  const n = categories.length

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto max-h-[48vh] w-full print:max-h-none" role="img" aria-label="Scenario chart">
        {/* gridlines + y labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(t, yMin, yMax)}
              y2={yScale(t, yMin, yMax)}
              stroke="#2A2A2A"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 12}
              y={yScale(t, yMin, yMax) + 4}
              textAnchor="end"
              fill="#8E8E8E"
              fontSize={13}
            >
              {formatTick(t)}
            </text>
          </g>
        ))}

        {/* emphasized zero / break-even line */}
        {zeroLineLabel && yMin < 0 && (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(0, yMin, yMax)}
              y2={yScale(0, yMin, yMax)}
              stroke="#FAFAFA"
              strokeWidth={1.5}
              strokeDasharray="6 6"
            />
            <text
              x={W - PAD.right}
              y={yScale(0, yMin, yMax) - 8}
              textAnchor="end"
              fill="#FAFAFA"
              fontSize={12}
              opacity={0.8}
            >
              {zeroLineLabel}
            </text>
          </g>
        )}

        {/* x labels */}
        {categories.map((c, i) => (
          <text key={c} x={xAt(i, n)} y={H - 14} textAnchor="middle" fill="#8E8E8E" fontSize={13}>
            {c}
          </text>
        ))}

        {/* series */}
        {series.map((s) => {
          const points = s.values.map((v, i) => `${xAt(i, n)},${yScale(v, yMin, yMax)}`).join(' ')
          const last = s.values[s.values.length - 1]
          return (
            <g key={s.name}>
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.values.map((v, i) => (
                <circle
                  key={i}
                  cx={xAt(i, n)}
                  cy={yScale(v, yMin, yMax)}
                  r={5}
                  fill={s.color}
                  stroke="#0A0A0A"
                  strokeWidth={2}
                />
              ))}
              <text
                x={xAt(n - 1, n) + 14}
                y={yScale(last, yMin, yMax) + 5}
                fill={s.color}
                fontSize={15}
                fontWeight={700}
              >
                {formatEnd(last)}
              </text>
            </g>
          )
        })}
      </svg>
      <ChartLegend series={series} />
    </div>
  )
}

interface RevenueBarChartProps {
  data: { year: string; revenue: number; revenueLabel: string; doors: number }[]
}

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  const max = Math.max(...data.map((d) => d.revenue)) * 1.15
  const innerW = W - PAD.left - PAD.right
  const barW = Math.min(88, (innerW / data.length) * 0.55)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto max-h-[42vh] w-full print:max-h-none" role="img" aria-label="Base case revenue by year">
      <defs>
        <linearGradient id="goldBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const cx = PAD.left + (i + 0.5) * (innerW / data.length)
        const y = yScale(d.revenue, 0, max)
        const barH = H - PAD.bottom - y
        return (
          <g key={d.year}>
            <rect x={cx - barW / 2} y={y} width={barW} height={barH} rx={8} fill="url(#goldBar)" />
            <text x={cx} y={y - 12} textAnchor="middle" fill="#FAFAFA" fontSize={17} fontWeight={700}>
              {d.revenueLabel}
            </text>
            <text x={cx} y={H - 22} textAnchor="middle" fill="#FAFAFA" fontSize={13}>
              {d.year}
            </text>
            <text x={cx} y={H - 4} textAnchor="middle" fill="#8E8E8E" fontSize={12}>
              {d.doors.toLocaleString()} doors
            </text>
          </g>
        )
      })}
    </svg>
  )
}

interface BreakEvenChartProps {
  data: { margin: string; revenue: number; label: string; isBase?: boolean }[]
}

export function BreakEvenChart({ data }: BreakEvenChartProps) {
  const max = Math.max(...data.map((d) => d.revenue)) * 1.25
  const innerW = W - PAD.left - PAD.right
  const barW = Math.min(96, (innerW / data.length) * 0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto max-h-[42vh] w-full print:max-h-none" role="img" aria-label="Break-even revenue by gross margin">
      <defs>
        <linearGradient id="goldBarBE" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const cx = PAD.left + (i + 0.5) * (innerW / data.length)
        const y = yScale(d.revenue, 0, max)
        const barH = H - PAD.bottom - y
        return (
          <g key={d.margin}>
            <rect
              x={cx - barW / 2}
              y={y}
              width={barW}
              height={barH}
              rx={8}
              fill={d.isBase ? 'url(#goldBarBE)' : '#2E2E2E'}
              stroke={d.isBase ? 'none' : '#3E3E3E'}
            />
            <text
              x={cx}
              y={y - 12}
              textAnchor="middle"
              fill={d.isBase ? '#FFD700' : '#FAFAFA'}
              fontSize={17}
              fontWeight={700}
            >
              {d.label}
            </text>
            <text x={cx} y={H - 22} textAnchor="middle" fill="#FAFAFA" fontSize={14} fontWeight={600}>
              {d.margin}
            </text>
            <text x={cx} y={H - 4} textAnchor="middle" fill="#8E8E8E" fontSize={12}>
              gross margin{d.isBase ? ' (base)' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
