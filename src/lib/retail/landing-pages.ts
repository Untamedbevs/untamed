export interface RetailLandingPage {
  slug: string
  title: string
  eyebrow: string
  headline: string
  subhead: string
  audience: string
  defaultBusinessType: 'bar_restaurant' | 'liquor_store' | 'distributor'
  proof: string[]
  cta: string
}

export const RETAIL_LANDING_PAGES: RetailLandingPage[] = [
  {
    slug: 'bars',
    title: 'Carry Untamed | Bars & Restaurants',
    eyebrow: 'On-premise',
    headline: 'A martini that keeps up with the ticket printer.',
    subhead:
      'Chill. Shake. Pour. Premium RTS vodka martinis that cut ticket time, hold quality across shifts, and give guests a reason to order a second round.',
    audience: 'Bar managers, beverage directors, and owners',
    defaultBusinessType: 'bar_restaurant',
    proof: [
      'Four SKUs. Recognizable martinis. No 40-flavor wall.',
      'Two pours per can — faster service, predictable pour cost.',
      'We follow up within 48 hours. Samples available.',
    ],
    cta: 'Request a wholesale conversation',
  },
  {
    slug: 'liquor',
    title: 'Carry Untamed | Liquor Stores',
    eyebrow: 'Off-premise',
    headline: 'Premium ring. Simple set. Shoppers who already know the cats.',
    subhead:
      'Spirit-forward vodka martinis that earn a higher ticket without a discount war. Tight four-SKU lineup, cold box or shelf, and brand demand from DTC and loyalty.',
    audience: 'Liquor store owners and buyers',
    defaultBusinessType: 'liquor_store',
    proof: [
      '1-2-3 story at shelf: 2 martinis, about $3 a cocktail.',
      'DTC, social, and loyalty send brand-aware shoppers into retail.',
      'We follow up within 48 hours with sell-in support.',
    ],
    cta: 'Request a wholesale conversation',
  },
  {
    slug: 'distributors',
    title: 'Carry Untamed | Distributors',
    eyebrow: 'Wholesale',
    headline: 'The RTS martini that is actually a martini.',
    subhead:
      'Ready-to-serve is the growth lane. Untamed sits at the premium end with a four-SKU story your sales team can tell in one sentence.',
    audience: 'Distributor principals and chain managers',
    defaultBusinessType: 'distributor',
    proof: [
      'Launch support: POS, staff guides, account activations.',
      'Referral program credits partners who open doors.',
      'We follow up within 48 hours.',
    ],
    cta: 'Start a distribution conversation',
  },
]

export function getRetailLandingPage(slug: string): RetailLandingPage | undefined {
  return RETAIL_LANDING_PAGES.find((p) => p.slug === slug)
}

export const RETAIL_LP_SLUGS = RETAIL_LANDING_PAGES.map((p) => p.slug)
