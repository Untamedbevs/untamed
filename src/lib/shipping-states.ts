/**
 * States (plus DC) Untamed can legally ship to through the online shop.
 * Update this list when coverage changes: the shop's state checker and the
 * rewards program's state rules (src/lib/rewards/state-rules.ts) both read it.
 */
export const SHIPPING_STATES: ReadonlySet<string> = new Set([
  'AL', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY',
  'LA', 'MA', 'MD', 'ME', 'MN', 'MO', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
])
