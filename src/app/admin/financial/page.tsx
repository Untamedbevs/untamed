'use client'

import { useState, useMemo } from 'react'
import {
  Calculator,
  Package,
  Boxes,
  DollarSign,
  Warehouse,
  Tags,
  TrendingUp,
  RotateCcw,
  Download,
} from 'lucide-react'

interface CostInputs {
  numberOfCans: number
  numberOfSKUs: number
  ingredients: number
  tolling: number
  bundling: number
  packaging: number
  other: number
}

const DEFAULT_INPUTS: CostInputs = {
  numberOfCans: 0,
  numberOfSKUs: 1,
  ingredients: 0,
  tolling: 0,
  bundling: 0,
  packaging: 0,
  other: 0,
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

export default function FinancialPage() {
  const [inputs, setInputs] = useState<CostInputs>(DEFAULT_INPUTS)

  const calculations = useMemo(() => {
    const totalPerCanCost =
      inputs.ingredients +
      inputs.tolling +
      inputs.bundling +
      inputs.packaging +
      inputs.other

    const variableProductionCost = inputs.numberOfCans * totalPerCanCost

    const additionalSKUFee =
      inputs.numberOfSKUs > 1 ? (inputs.numberOfSKUs - 1) * 1500 : 0

    const facilityRental = inputs.numberOfCans < 40000 ? 12500 : 0

    const totalCost = variableProductionCost + additionalSKUFee + facilityRental

    const costPerCan = inputs.numberOfCans > 0 ? totalCost / inputs.numberOfCans : 0

    return {
      totalPerCanCost,
      variableProductionCost,
      additionalSKUFee,
      facilityRental,
      totalCost,
      costPerCan,
    }
  }, [inputs])

  function updateInput(field: keyof CostInputs, value: string) {
    const parsed = parseFloat(value)
    setInputs((prev) => ({
      ...prev,
      [field]: isNaN(parsed) ? 0 : parsed,
    }))
  }

  function handleReset() {
    setInputs(DEFAULT_INPUTS)
  }

  function handleExport() {
    const lines = [
      'Untamed Beverage Cost Calculator',
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'INPUTS',
      `Number of Cans,${inputs.numberOfCans}`,
      `Number of SKUs,${inputs.numberOfSKUs}`,
      '',
      'PER CAN COSTS',
      `Ingredients ($/can),${inputs.ingredients.toFixed(2)}`,
      `Tolling ($/can),${inputs.tolling.toFixed(2)}`,
      `Bundling ($/can),${inputs.bundling.toFixed(2)}`,
      `Packaging ($/can),${inputs.packaging.toFixed(2)}`,
      `Other ($/can),${inputs.other.toFixed(2)}`,
      '',
      'CALCULATIONS',
      `Total Per Can Cost,${calculations.totalPerCanCost.toFixed(2)}`,
      `Variable Production Cost,${calculations.variableProductionCost.toFixed(2)}`,
      `Additional SKU Fee,${calculations.additionalSKUFee.toFixed(2)}`,
      `Facility Rental (<40k cans),${calculations.facilityRental.toFixed(2)}`,
      '',
      `TOTAL COST,${calculations.totalCost.toFixed(2)}`,
      `Effective Cost Per Can,${calculations.costPerCan.toFixed(4)}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `beverage-cost-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-[var(--font-oswald)] uppercase tracking-wide">
            Beverage Cost Calculator
          </h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Estimate production costs per run
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white bg-[#9B30FF] hover:bg-[#8526DB] transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs Section */}
        <div className="space-y-6">
          {/* Production Inputs */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
                <Boxes className="w-4.5 h-4.5 text-[#9B30FF]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-[var(--font-oswald)]">
                Production Inputs
              </h2>
            </div>
            <div className="space-y-4">
              <InputField
                label="Number of Cans"
                icon={Package}
                value={inputs.numberOfCans}
                onChange={(v) => updateInput('numberOfCans', v)}
                type="integer"
                hint={
                  inputs.numberOfCans > 0 && inputs.numberOfCans < 40000
                    ? 'Below 40,000 — facility rental applies'
                    : undefined
                }
                hintColor="#E87511"
              />
              <InputField
                label="Number of SKUs"
                icon={Tags}
                value={inputs.numberOfSKUs}
                onChange={(v) => updateInput('numberOfSKUs', v)}
                type="integer"
                hint={
                  inputs.numberOfSKUs > 1
                    ? `${inputs.numberOfSKUs - 1} extra SKU(s) — $1,500 each`
                    : undefined
                }
                hintColor="#D4D700"
              />
            </div>
          </div>

          {/* Per Can Costs */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#4A7C0F]/15 flex items-center justify-center">
                <DollarSign className="w-4.5 h-4.5 text-[#4A7C0F]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-[var(--font-oswald)]">
                Per Can Costs
              </h2>
            </div>
            <div className="space-y-4">
              <InputField
                label="Ingredients"
                prefix="$"
                suffix="/can"
                value={inputs.ingredients}
                onChange={(v) => updateInput('ingredients', v)}
                type="currency"
              />
              <InputField
                label="Tolling"
                prefix="$"
                suffix="/can"
                value={inputs.tolling}
                onChange={(v) => updateInput('tolling', v)}
                type="currency"
              />
              <InputField
                label="Bundling"
                prefix="$"
                suffix="/can"
                value={inputs.bundling}
                onChange={(v) => updateInput('bundling', v)}
                type="currency"
              />
              <InputField
                label="Packaging"
                prefix="$"
                suffix="/can"
                value={inputs.packaging}
                onChange={(v) => updateInput('packaging', v)}
                type="currency"
              />
              <InputField
                label="Other"
                prefix="$"
                suffix="/can"
                value={inputs.other}
                onChange={(v) => updateInput('other', v)}
                type="currency"
              />
            </div>
          </div>
        </div>

        {/* Calculations Section */}
        <div className="space-y-6">
          {/* Breakdown */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#D4D700]/15 flex items-center justify-center">
                <Calculator className="w-4.5 h-4.5 text-[#D4D700]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-[var(--font-oswald)]">
                Cost Breakdown
              </h2>
            </div>
            <div className="space-y-3">
              <CalcRow
                label="Total Per Can Cost"
                value={formatCurrency(calculations.totalPerCanCost)}
                sublabel="Sum of all per-can costs"
              />
              <CalcRow
                label="Variable Production Cost"
                value={formatCurrency(calculations.variableProductionCost)}
                sublabel={`${formatNumber(inputs.numberOfCans)} cans × ${formatCurrency(calculations.totalPerCanCost)}/can`}
              />
              <CalcRow
                label="Additional SKU Fee"
                value={formatCurrency(calculations.additionalSKUFee)}
                sublabel={
                  inputs.numberOfSKUs > 1
                    ? `(${inputs.numberOfSKUs} - 1) SKUs × $1,500`
                    : 'No additional SKUs'
                }
                dimmed={calculations.additionalSKUFee === 0}
              />
              <CalcRow
                label="Facility Rental"
                value={formatCurrency(calculations.facilityRental)}
                sublabel={
                  inputs.numberOfCans < 40000
                    ? 'Applies for runs under 40,000 cans'
                    : 'Waived for 40,000+ cans'
                }
                dimmed={calculations.facilityRental === 0}
              />
            </div>
          </div>

          {/* Total */}
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
                  <TrendingUp className="w-4.5 h-4.5 text-[#9B30FF]" />
                </div>
                <h2 className="text-base font-semibold text-white uppercase tracking-wide font-[var(--font-oswald)]">
                  Total
                </h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-[#A0A0A0]">
                    Total Production Cost
                  </span>
                  <span className="text-3xl font-bold text-white tabular-nums">
                    {formatCurrency(calculations.totalCost)}
                  </span>
                </div>
                {inputs.numberOfCans > 0 && (
                  <div className="flex items-end justify-between pt-3 border-t border-[#2A2A2A]">
                    <span className="text-sm text-[#A0A0A0]">
                      Effective Cost Per Can
                    </span>
                    <span className="text-xl font-semibold text-[#9B30FF] tabular-nums">
                      {formatCurrency(calculations.costPerCan)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Reference */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#E87511]/15 flex items-center justify-center">
                <Warehouse className="w-4.5 h-4.5 text-[#E87511]" />
              </div>
              <h2 className="text-base font-semibold text-white uppercase tracking-wide font-[var(--font-oswald)]">
                Fee Reference
              </h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-[#1A1A1A]">
                <span className="text-[#A0A0A0]">Facility rental threshold</span>
                <span className="text-white tabular-nums">40,000 cans</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1A1A1A]">
                <span className="text-[#A0A0A0]">Facility rental fee</span>
                <span className="text-white tabular-nums">$12,500</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#A0A0A0]">Additional SKU fee</span>
                <span className="text-white tabular-nums">$1,500 / SKU</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InputField({
  label,
  icon: Icon,
  prefix,
  suffix,
  value,
  onChange,
  type,
  hint,
  hintColor,
}: {
  label: string
  icon?: typeof Package
  prefix?: string
  suffix?: string
  value: number
  onChange: (value: string) => void
  type: 'integer' | 'currency'
  hint?: string
  hintColor?: string
}) {
  return (
    <div>
      <label className="block text-sm text-[#A0A0A0] mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 focus-within:border-[#9B30FF]/50 transition-colors">
        {Icon && <Icon className="w-4 h-4 text-[#666] shrink-0" />}
        {prefix && (
          <span className="text-sm text-[#666] shrink-0">{prefix}</span>
        )}
        <input
          type="number"
          step={type === 'currency' ? '0.01' : '1'}
          min="0"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="flex-1 bg-transparent text-white text-sm outline-none tabular-nums placeholder:text-[#333] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="text-xs text-[#666] shrink-0">{suffix}</span>
        )}
      </div>
      {hint && (
        <p className="text-xs mt-1.5" style={{ color: hintColor || '#A0A0A0' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function CalcRow({
  label,
  value,
  sublabel,
  dimmed,
}: {
  label: string
  value: string
  sublabel?: string
  dimmed?: boolean
}) {
  return (
    <div
      className={`flex items-start justify-between py-3 border-b border-[#1A1A1A] last:border-0 ${dimmed ? 'opacity-50' : ''}`}
    >
      <div>
        <span className="text-sm text-white">{label}</span>
        {sublabel && (
          <p className="text-xs text-[#666] mt-0.5">{sublabel}</p>
        )}
      </div>
      <span className="text-sm font-medium text-white tabular-nums shrink-0 ml-4">
        {value}
      </span>
    </div>
  )
}
