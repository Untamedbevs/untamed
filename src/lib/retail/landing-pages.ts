import type { AdvantageSet } from '@/lib/retail/sell'
import type { DistributorBusinessType } from '@/lib/referral/types'

export interface RetailLandingPage {
  slug: string
  title: string
  eyebrow: string
  headline: { pre: string; highlight: string; post?: string; style?: 'brand' | 'orange' }
  subhead: string
  audience: string
  defaultBusinessType: DistributorBusinessType
  proof: string[]
  cta: string
  advantageSet: AdvantageSet
  sectionEyebrow: string
  sectionHeadline: { pre: string; highlight: string; post?: string; style?: 'brand' | 'orange' }
  sectionSubhead: string
  finalHeadline: { pre: string; highlight: string; post?: string }
  finalSubhead: string
  showActivationIdeas?: boolean
}

export const RETAIL_LANDING_PAGES: RetailLandingPage[] = [
  {
    slug: 'bars',
    title: 'Carry Untamed | Bars & Restaurants',
    eyebrow: 'On-premise',
    headline: { pre: 'Premium Martinis, ', highlight: 'Simplified' },
    subhead:
      'Deliver a premium martini program with faster execution, tighter cost control, and consistent guest experience — without adding complexity behind the bar.',
    audience: 'Bar managers, beverage directors, and owners',
    defaultBusinessType: 'bar_restaurant',
    proof: [
      'Chill, shake, pour — a martini that keeps up with the ticket printer.',
      'Four recognizable SKUs. No 40-flavor wall. Same profile every shift.',
      'Two pours per can. Predictable pour cost. Samples available.',
    ],
    cta: 'Add Untamed to Your Menu',
    advantageSet: 'on_premise',
    sectionEyebrow: 'For Bars & Restaurants',
    sectionHeadline: { pre: 'What Changes Behind the ', highlight: 'Bar' },
    sectionSubhead:
      'Faster tickets, tighter pour cost, and a martini guests will order a second time — without adding complexity for the team.',
    finalHeadline: { pre: 'Ready to put ', highlight: 'Untamed', post: ' on the menu?' },
    finalSubhead: 'Tell us about your bar or restaurant. We reach out within 48 hours — samples available.',
    showActivationIdeas: true,
  },
  {
    slug: 'liquor',
    title: 'Carry Untamed | Liquor Stores',
    eyebrow: 'Off-premise',
    headline: { pre: 'Carry ', highlight: 'Untamed', post: ' in Your Store', style: 'brand' },
    subhead:
      'Premium cocktail credentials with a clear value story and a culture-led lineup that supports repeat purchasing — without a discount war.',
    audience: 'Liquor store owners and buyers',
    defaultBusinessType: 'liquor_store',
    proof: [
      '1-2-3 at shelf: 1 can, 2 martinis, about $3 a cocktail.',
      'Tight four-SKU set. Cold box or shelf. Shoppers who already know the cats.',
      'DTC, social, and loyalty send brand-aware shoppers into retail.',
    ],
    cta: 'Carry Untamed in Your Store',
    advantageSet: 'retailer',
    sectionEyebrow: 'For Retailers',
    sectionHeadline: { pre: 'Why Retailers Win With ', highlight: 'Untamed', style: 'brand' },
    sectionSubhead:
      'Premium cocktail credentials with a clear value story and a culture-led lineup that supports repeat purchasing.',
    finalHeadline: { pre: 'Ready to bring ', highlight: 'Untamed', post: ' to the shelf?' },
    finalSubhead: 'Tell us about your store. We follow up within 48 hours with sell-in support.',
  },
  {
    slug: 'distributors',
    title: 'Carry Untamed | Distributors',
    eyebrow: 'Wholesale',
    headline: { pre: 'A Brand That ', highlight: 'Sells Itself' },
    subhead:
      'Premium margins, explosive category growth, and a four-SKU story your sales team can tell in one sentence. Ready-to-serve is the growth lane — Untamed sits at the premium end.',
    audience: 'Distributor principals and chain managers',
    defaultBusinessType: 'distributor',
    proof: [
      'The RTS martini that is actually a martini — spirit-forward, 15% ABV, two pours.',
      'Launch support: POS, staff guides, account activations.',
      'Referral program credits partners who open doors.',
    ],
    cta: 'Become a Distribution Partner',
    advantageSet: 'distributor',
    sectionEyebrow: 'For Distributors',
    sectionHeadline: { pre: 'Why Houses Pick Up ', highlight: 'Untamed', style: 'brand' },
    sectionSubhead: 'Premium margins, explosive category growth, and a brand that retailers ask for by name.',
    finalHeadline: { pre: 'Ready to put ', highlight: 'Untamed', post: ' on the truck?' },
    finalSubhead: 'Tell us about your house. We reach out within 48 hours.',
  },
]

export function getRetailLandingPage(slug: string): RetailLandingPage | undefined {
  return RETAIL_LANDING_PAGES.find((p) => p.slug === slug)
}

export const RETAIL_LP_SLUGS = RETAIL_LANDING_PAGES.map((p) => p.slug)
