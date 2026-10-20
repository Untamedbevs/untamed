/**
 * Holiday Blast promotion — single source of truth.
 *
 * Every holiday banner, container and shipping-tier override on the site reads
 * from here. Flip `enabled` to false (or let `endsAt` pass) and the whole
 * promotion disappears and shipping copy reverts to the standard tiers.
 *
 * NOTE: the actual shipping charge is calculated by AccelPay, not this repo.
 * The free-shipping rule ($89+ subtotal) must be configured in the AccelPay
 * brand dashboard for checkout to match what these banners promise.
 */

export const HOLIDAY_PROMO = {
  enabled: true,
  /** End of Dec 31, 2026 (Eastern). */
  endsAt: '2027-01-01T05:00:00Z',
  freeShippingThreshold: 89,
  boxPrice: 24,
  /** Smallest box count whose subtotal clears the threshold (4 × $24 = $96). */
  freeShippingBoxes: 4,
  /** Matches the coverage shown by ShippingRates / ShippingStates. */
  shippingRegion: '42 states + DC',
  /** Free shipping applies itself at checkout; say so wherever the offer appears. */
  autoApplyNote: 'Auto-applied in cart. No code needed.',
}

export function isHolidayPromoActive(now: Date = new Date()): boolean {
  return HOLIDAY_PROMO.enabled && now < new Date(HOLIDAY_PROMO.endsAt)
}

export type HolidayMoment = {
  key: string
  eyebrow: string
  headline: string
  body: string
  cta: string
  color: string
}

export const HOLIDAY_MOMENTS: HolidayMoment[] = [
  {
    key: 'parties',
    eyebrow: 'Holiday Parties',
    headline: 'Holiday season is martini season.',
    body: 'Bring a wild side to your holiday party with award-winning craft martinis. Four flavors. Ready to serve. Made with vodka & natural flavors.',
    cta: 'Shop Now',
    color: '#9B30FF',
  },
  {
    key: 'gifts',
    eyebrow: 'Holiday Gifts',
    headline: 'Wrap up something wild.',
    body: 'Give the martini lover on your list a new favorite. Explore four flavors of award-winning craft martinis — from rich Espresso to bright Lemon Drop.',
    cta: 'Shop Gifts',
    color: '#E6D800',
  },
  {
    key: 'host',
    eyebrow: 'Host Gifts',
    headline: 'You bring the martinis. They’ll bring the glasses.',
    body: 'Make your entrance with something worth sharing. Award-winning craft martinis in Espresso, Lemon Drop, Classic Dirty, and Peach & Rosemary.',
    cta: 'Find Your Flavor',
    color: '#8DB33A',
  },
  {
    key: 'entertaining',
    eyebrow: 'Holiday Entertaining',
    headline: 'Less mixing. More mingling.',
    body: 'Spend more time with your guests this holiday season. Untamed’s ready-to-serve, award-winning craft martinis make the cocktail menu easy.',
    cta: 'Shop Now',
    color: '#FF8C2A',
  },
  {
    key: 'nye',
    eyebrow: 'New Year’s Eve',
    headline: 'Make midnight a martini moment.',
    body: 'Ring in the new year with award-winning craft martinis and your favorite people. Four distinctive flavors, ready for the celebration.',
    cta: 'Shop Now',
    color: '#FFD700',
  },
]
