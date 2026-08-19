export const ORANGE = '#FF8C2A'

export type SellIcon =
  | 'dollar'
  | 'shield'
  | 'trending'
  | 'package'
  | 'target'
  | 'store'
  | 'chart'
  | 'sparkles'
  | 'zap'
  | 'users'
  | 'wine'
  | 'clock'
  | 'heart'
  | 'truck'

export type Advantage = {
  icon: SellIcon
  title: string
  description: string
}

export const RETAILER_ADVANTAGES: Advantage[] = [
  {
    icon: 'dollar',
    title: 'Premium Ring + Trade-Up',
    description:
      'Spirit-forward vodka martinis give retailers a premium RTS option that lifts average ticket versus lighter, lower-ABV RTSs. The martini cue carries "night-out" equity that justifies a higher price point without extensive shopper education.',
  },
  {
    icon: 'shield',
    title: 'Value Without Discounting',
    description:
      'The "1-2-3 Advantage" makes the purchase feel smart (2 martinis in one can / $3 per cocktail) without relying on price promotions. It\'s simple math a shopper can do in seconds at shelf.',
  },
  {
    icon: 'trending',
    title: 'Multi-Serve Velocity',
    description:
      'A 12 oz, two-pour can fits hosting and shareable occasions, encouraging stock-up purchases and faster depletion — supporting repeat trips and replenishment behavior.',
  },
  {
    icon: 'package',
    title: 'Higher Basket + Repeat',
    description:
      'The four "wild spirits" framework ("Pick Your Spirit") makes it easy to buy multiple SKUs at once and come back for the next archetype. A built-in antidote to one-and-done trial.',
  },
  {
    icon: 'target',
    title: 'Clear Shelf Navigation',
    description:
      'Big-cat naming and archetypes simplify decision-making, reducing shopper friction in a crowded set. Names are more memorable than generic flavor descriptors.',
  },
  {
    icon: 'store',
    title: 'Merchandising Flexibility',
    description:
      'Performs in cold box for immediate occasions and on shelf for stock-up. The on-pack serving ritual helps communicate quality at point of sale without external signage.',
  },
  {
    icon: 'chart',
    title: 'Simpler Assortment',
    description:
      'A tight, high-clarity four-SKU lineup supports strong blocking, easier replenishment, and cleaner planograms than sprawling flavor portfolios.',
  },
  {
    icon: 'sparkles',
    title: 'Brand-Driven Demand',
    description:
      'Untamed invests in DTC marketing, social content, and a loyalty program that drives brand-aware shoppers into retail. You benefit from built-in consumer pull without funding awareness yourself.',
  },
]

export const ON_PREMISE_ADVANTAGES: Advantage[] = [
  {
    icon: 'zap',
    title: 'Speed of Service',
    description:
      'Chill, shake, and pour — serve a martini quickly during rush periods, reducing ticket times and supporting more rounds per hour. Faster execution means more beverage revenue per shift.',
  },
  {
    icon: 'shield',
    title: 'Consistent Quality',
    description:
      'Each can delivers the same martini profile every time, helping maintain standards across shifts, locations, and varying bartender experience levels. Protects your reputation.',
  },
  {
    icon: 'users',
    title: 'Lower Labor + Training',
    description:
      'Offer martini-style cocktails without complex recipes, measuring, or extensive spirit-and-modifier training — ideal for high-turnover teams and seasonal staffing.',
  },
  {
    icon: 'package',
    title: 'Inventory Control',
    description:
      'A sealed, multi-serve can reduces over-pouring and spoilage from open bottles or perishable mixers, while making pour costs easier to forecast and manage.',
  },
  {
    icon: 'wine',
    title: 'Menu Versatility',
    description:
      'Maps to recognizable martini favorites (Espresso, Dirty, Lemon Drop, Peach & Rosemary) so you can build a premium "Martini Menu" with clear guest navigation.',
  },
  {
    icon: 'clock',
    title: 'Event & Banquet Efficiency',
    description:
      'For weddings, pool bars, rooftops, and VIP service — batching-like execution with consistent results. Serve premium cocktails quickly with minimal equipment.',
  },
  {
    icon: 'dollar',
    title: 'Premium Upsell + Margin',
    description:
      'Premium positioning supports premium pricing while the two-pour format improves operational efficiency per served cocktail. Faster build time, predictable portioning, reduced waste.',
  },
  {
    icon: 'heart',
    title: 'Built-In Guest Engagement',
    description:
      '"Pick Your Spirit" creates a conversation starter — guests can order by vibe, try a different spirit next round, and return to explore the lineup. Increases second-drink orders.',
  },
]

export const DISTRIBUTOR_ADVANTAGES: Advantage[] = [
  {
    icon: 'trending',
    title: 'Explosive Category Growth',
    description:
      'Ready-to-serve cocktails are the #1 growth segment in beverage alcohol. Untamed sits at the premium end with a clear differentiation story.',
  },
  {
    icon: 'sparkles',
    title: 'Brand That Earns Preference',
    description:
      '"Live Life Untamed" creates an emotional connection beyond taste. Identity-driven, not flavor-driven — turns purchase into a statement that builds loyalty.',
  },
  {
    icon: 'package',
    title: '4-SKU Simplicity',
    description:
      'Tight lineup is easy to stock, easy to explain, and easy to merchandise. Each SKU has a distinct personality that drives multi-unit baskets.',
  },
  {
    icon: 'truck',
    title: 'Full Launch Support',
    description:
      'Marketing materials, POS displays, staff training guides, and activation support for your accounts. We help you sell it in.',
  },
]

export const ACTIVATION_IDEAS = [
  '"Pick Your Spirit Martini Night" — let guests order by personality',
  'Flight of mini pours — sample all four spirits',
  'Pair Espresso with dessert, Dirty with appetizers',
  'Seasonal spotlight (e.g., "Lioness Week") to drive repeat visits',
  'In-room celebration packages for hotels',
  'Pool and rooftop features with a "shake-and-pour" moment',
  'VIP add-on or fast-serve premium option for venues',
]

export const PROMISE_PARAGRAPHS = [
  'Great businesses are not built on excitement alone. They are built on repeat purchase, healthy margins, thoughtful distribution, and decisions that create lasting enterprise value.',
  'At the shelf, clarity wins. A $24 four-pack price point, paired with the simple math of eight total cocktails at $3 per cocktail, gives Untamed a message that is easy to merchandise, easy for consumers to understand, and easy for retail teams to repeat.',
  'It shortens the decision. It strengthens perceived value. It helps the product do what great shelf brands do: stop people, make sense immediately, and earn the sale.',
]

export const PROMISE_ITEMS = [
  { label: 'Shelf Clarity', desc: 'Premium packaging with a value story that communicates itself in seconds.' },
  { label: 'Consumer Pull', desc: 'DTC marketing, social content, and a loyalty program that drives brand-aware shoppers into retail.' },
  { label: 'Repeat Purchase', desc: 'Identity-driven lineup where each spirit gives consumers a reason to come back and explore.' },
  { label: 'Sustainable Economics', desc: 'Pricing that protects margins while delivering unmistakable value at the shelf.' },
]

export const WHY_DIFFERENT = [
  {
    title: 'Premium, Spirit-Forward Positioning',
    desc: 'Untamed competes as a premium ready-to-serve vodka martini — clean vodka backbone, martini-style builds, and a bar-worthy serve. Not a "lite" RTS.',
  },
  {
    title: 'Format Advantage: Bigger Can + True Multi-Serve',
    desc: 'Each 12 fl oz can contains the equivalent of (2) 6 oz vodka martinis at 15% ALC/VOL. The "two pours" proposition drives value, shareability, and fewer units needed per occasion.',
  },
  {
    title: 'Brand Differentiation That Earns Preference',
    desc: '"Live Life Untamed" creates an emotional reason to choose: freedom, authenticity, and courage. In a crowded RTS set, Untamed competes on meaning — turning a purchase into a statement.',
  },
  {
    title: 'Culture-Driven Lineup: Four Wild Spirits',
    desc: 'Black Panther, Cheetah, Cougar, and Lioness are identity cues. Each represents an archetype, giving people a way to see themselves and signal their vibe — driving repeat purchase through self-identification.',
  },
  {
    title: 'On-Pack Ritual That Upgrades the Occasion',
    desc: '"Chill it. Shake it. Unleash it!" gives consumers a premium serving cue that bridges canned convenience and cocktail ceremony. Reduces RTS skepticism.',
  },
  {
    title: 'Distinct, Bar-Relevant Flavor Builds',
    desc: 'Espresso Martini (caramel & vanilla), Lemon Drop, Classic Dirty, and Peach & Rosemary — balancing "order-it-anywhere" classics with differentiated cues.',
  },
]

export const ONE_TWO_THREE = {
  items: [
    { num: '1', label: 'Can', detail: '12 oz, 15% ABV' },
    { num: '2', label: 'Martinis', detail: 'Full 6 oz pours' },
    { num: '$3', label: 'Per Cocktail', detail: 'Luxury meets logic' },
  ],
  footnote:
    'Luxury meets logic. At just $0.50/oz, Untamed outperforms the market average by 45% on every pour. While others compromise on scale or strength, we lead the industry in delivering maximum impact and exceptional value in a single, superior package.',
}

export const ADVANTAGE_SETS = {
  retailer: RETAILER_ADVANTAGES,
  on_premise: ON_PREMISE_ADVANTAGES,
  distributor: DISTRIBUTOR_ADVANTAGES,
} as const

export type AdvantageSet = keyof typeof ADVANTAGE_SETS
