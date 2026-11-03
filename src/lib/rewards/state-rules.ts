import { SHIPPING_STATES } from '@/lib/shipping-states'
import { US_STATES, normalizeStateCode, type UsStateCode } from './states'

/**
 * Per-state switches for Untamed Pack Rewards.
 *
 * - `ships`: Untamed ships to this state (src/lib/shipping-states.ts). The
 *   Program is only offered where people can buy Untamed online.
 * - `engagement`: enrollment, the enrollment bonus, content points, referral
 *   rewards for friends who enroll, and redeeming points for merchandise.
 *   No purchase involved, so it is on in every state we ship to.
 * - `purchasePoints`: points for online orders and retail receipts. These are
 *   supplier rebates/premiums on spirits, which some states ban and many
 *   restrict. Off unless the research found it allowed; a lawyer should
 *   confirm each state before it is switched on.
 * - `cashBack`: PREVIEW ONLY, nothing pays out. Cash back is a rebate Untamed
 *   would pay members directly (PayPal, Venmo or gift card) against a purchase
 *   they already made, never a discount at checkout. `launch` is the first
 *   state shown as "coming soon"; `candidate` means the research found
 *   supplier-paid consumer rebates allowed there, pending a lawyer.
 *
 * Sources and confidence: docs/rewards/legal-research-2026-10-30.md, section 5.
 * To switch a state on after legal review, update its switch, `note`,
 * `confidence` and `reviewed`. The Program Rules page reads this table.
 */

export type FeatureSwitch = 'on' | 'off'
export type CashBackStatus = 'launch' | 'candidate' | 'off'

export interface StateRule {
  code: UsStateCode
  ships: boolean
  engagement: FeatureSwitch
  purchasePoints: FeatureSwitch
  cashBack: CashBackStatus
  /** Plain-language reason, shown to staff. */
  note: string
  confidence: 'high' | 'medium' | 'low' | 'not researched'
  /** Date of the research or legal review behind this row. */
  reviewed: string
}

const RESEARCHED = '2026-10-30'

const DEFAULT_NOTE =
  'Not researched for purchase-linked rewards or rebates. Off until a lawyer confirms supplier rebates and premiums on spirits are allowed here.'

const NOT_SHIPPED_NOTE =
  'Untamed does not ship here, so the Program is not offered. Revisit if shipping is added.'

type Override = Partial<Pick<StateRule, 'purchasePoints' | 'cashBack' | 'note' | 'confidence'>>

/** States where the research found a specific reason; everything else uses the defaults. */
const OVERRIDES: Partial<Record<UsStateCode, Override>> = {
  FL: {
    purchasePoints: 'on',
    cashBack: 'launch',
    note:
      'Premium offers for merchandise are allowed to consumers who show proof of purchase (Fla. Admin. Code r. 61A-1.0103). No Florida law bans rebates Untamed pays directly to consumers; checkout coupons are unsettled, so cash back would be paid after purchase. Receipts from any licensed retailer earn equally; retailers never redeem anything.',
    confidence: 'high',
  },
  CA: {
    cashBack: 'candidate',
    note:
      'Premiums "in connection with the sale" of spirits are capped (about $5 per item) and purchase-based contest points are barred (B&P 25600, 25600.1). Supplier coupons are banned, but mail-in and electronic rebates paid by the supplier are allowed (B&P 25600.3).',
    confidence: 'medium',
  },
  NY: {
    cashBack: 'candidate',
    note:
      'A supplier receipt-rebate app was approved with conditions (SLA ruling 2022-01703). Needs review against those conditions.',
    confidence: 'medium',
  },
  NJ: {
    cashBack: 'candidate',
    note: 'Mail-in rebates paid directly to 21+ consumers are allowed, including electronic payment (N.J.A.C. 13:2-24.11).',
    confidence: 'high',
  },
  VA: {
    cashBack: 'candidate',
    note:
      'Control state. Mail-in rebates only, at most 50% of retail price, 15 days notice to Virginia ABC.',
    confidence: 'high',
  },
  OH: {
    cashBack: 'candidate',
    note:
      'Control state. Mail-in rebates allowed if a purchase is required and the rebate is below the retail price. Merchandise given with a purchase is barred unless authorized (OAC 4301:1-1-45).',
    confidence: 'medium',
  },
  IL: {
    cashBack: 'candidate',
    note: 'Rebates and digital coupons paid directly to consumers are allowed; scan-backs are banned; no naming retailers or using "free".',
    confidence: 'medium',
  },
  CO: {
    cashBack: 'candidate',
    note: 'Supplier consumer rebates are allowed if they do not assist retailers (Reg. 47-316, 2025 rulemaking).',
    confidence: 'medium',
  },
  KY: {
    cashBack: 'candidate',
    note: 'Rebate coupons for spirits are allowed for off-premises sales (KRS 244.461).',
    confidence: 'medium',
  },
  TN: {
    cashBack: 'candidate',
    note: 'Supplier coupons to consumers are governed by Rule 0100-06-.03(14). Needs review.',
    confidence: 'medium',
  },
  GA: {
    cashBack: 'candidate',
    note: 'Manufacturer rebates may be redeemed only by the manufacturer, never a retailer (Ga. r. 560-2-2-.14).',
    confidence: 'high',
  },
  LA: {
    cashBack: 'candidate',
    note: 'Spirits mail-in rebates are allowed; excluded from some national spirits rebates in 2025. Needs review.',
    confidence: 'medium',
  },
  AZ: {
    cashBack: 'candidate',
    note: 'Supplier rebates are run here in practice (a 2025–26 Arizona-only spirits rebate). Needs review.',
    confidence: 'low',
  },
  MO: {
    cashBack: 'candidate',
    note: 'Spirits rebates reportedly allowed; excluded from some national spirits rebates in 2025. Needs review.',
    confidence: 'low',
  },
  IN: {
    note:
      'Rebates need ATC approval; points redeemable for discounted alcohol are treated as price discrimination (Adv. Op. 22-04).',
    confidence: 'medium',
  },
  PA: {
    note: 'Control state. Rebates limited to PLCB-store purchases.',
    confidence: 'low',
  },
  NC: {
    note: 'Control state. Spirits rebates restricted or unclear.',
    confidence: 'low',
  },
  WA: {
    note:
      'Washington CEMA is being used against refer-a-friend texts. The program never sends or pre-writes texts.',
    confidence: 'medium',
  },
  TX: {
    note: `${NOT_SHIPPED_NOTE} Texas also prohibits supplier rebates, coupons, and inducements with an alcohol purchase (16 TAC 45.101, 45.102).`,
    confidence: 'high',
  },
  UT: {
    note: `${NOT_SHIPPED_NOTE} Control state; commonly excluded from spirits rebates.`,
    confidence: 'low',
  },
  HI: {
    note: `${NOT_SHIPPED_NOTE} Commonly excluded from spirits rebates.`,
    confidence: 'low',
  },
}

export const STATE_RULES: Record<UsStateCode, StateRule> = Object.fromEntries(
  US_STATES.map(([code]) => {
    const ships = SHIPPING_STATES.has(code)
    const override = OVERRIDES[code] || {}
    const rule: StateRule = {
      code,
      ships,
      engagement: ships ? 'on' : 'off',
      purchasePoints: ships ? override.purchasePoints || 'off' : 'off',
      cashBack: ships ? override.cashBack || 'off' : 'off',
      note: override.note || (ships ? DEFAULT_NOTE : NOT_SHIPPED_NOTE),
      confidence: override.confidence || 'not researched',
      reviewed: RESEARCHED,
    }
    return [code, rule]
  })
) as Record<UsStateCode, StateRule>

export function stateRule(state: string | null | undefined): StateRule | null {
  const code = normalizeStateCode(state)
  return code ? STATE_RULES[code] : null
}

export function engagementAllowed(state: string | null | undefined): boolean {
  return stateRule(state)?.engagement === 'on'
}

export function purchasePointsAllowed(state: string | null | undefined): boolean {
  return stateRule(state)?.purchasePoints === 'on'
}

export function cashBackStatus(state: string | null | undefined): CashBackStatus {
  return stateRule(state)?.cashBack || 'off'
}

function statesWhere(test: (rule: StateRule) => boolean): UsStateCode[] {
  return US_STATES.map(([code]) => code).filter((code) => test(STATE_RULES[code]))
}

/** States (and DC) where members can enroll: the states Untamed ships to. */
export const programStates = () => statesWhere((r) => r.engagement === 'on')
export const purchasePointStates = () => statesWhere((r) => r.purchasePoints === 'on')
export const cashBackLaunchStates = () => statesWhere((r) => r.cashBack === 'launch')
export const cashBackCandidateStates = () => statesWhere((r) => r.cashBack === 'candidate')
