import {
  ACTIVATION_IDEAS,
  ON_PREMISE_ADVANTAGES,
  PROMISE_ITEMS,
  RETAILER_ADVANTAGES,
  type Advantage,
} from '@/lib/retail/sell'

export const LOCATION_SLUGS = ['on-premise', 'off-premise'] as const
export type LocationSlug = (typeof LOCATION_SLUGS)[number]

export const OPENING_CASES = 2

export interface LocationPitch {
  slug: LocationSlug
  chromeLabel: string
  title: string
  description: string
  coverEyebrow: string
  coverLine: string
  coverSub: string
  problemTitle: string
  problemIntro: string
  problems: { title: string; body: string }[]
  winTitle: string
  winIntro: string
  advantages: Advantage[]
  runTitle: string
  runIntro: string
  runItems: { title: string; body: string }[]
  askIntro: string
  askItems: string[]
  ctaHref: string
  ctaLabel: string
}

export const LOCATION_DECKS: Record<LocationSlug, LocationPitch> = {
  'on-premise': {
    slug: 'on-premise',
    chromeLabel: 'On-Premise',
    title: 'Untamed for Bars & Restaurants',
    description: 'A martini program without the weeds — for bar and restaurant owners.',
    coverEyebrow: 'For bars & restaurants',
    coverLine: 'A martini that keeps up with the ticket printer.',
    coverSub: 'Premium vodka martinis. Chill, shake, pour. Same drink every shift.',
    problemTitle: 'Martinis lose money in the weeds',
    problemIntro:
      'The guest wants a martini. The ticket is already six deep. What happens next is why most programs never stick.',
    problems: [
      { title: 'Too slow', body: 'A real martini loses to beer and well drinks the second the rail fills up.' },
      { title: 'Too uneven', body: 'Quality depends on who is on. One shift is a signature. The next is a liability.' },
      { title: 'Too trained', body: 'Recipes, modifiers, and measuring do not survive high turnover.' },
      { title: 'Pour cost is a guess', body: 'Open bottles, over-pours, and perishable mixers hide the real number.' },
    ],
    winTitle: 'What changes behind the bar',
    winIntro: 'You keep the martini on the menu. You stop paying for the ceremony on every ticket.',
    advantages: ON_PREMISE_ADVANTAGES.slice(0, 4),
    runTitle: 'How you run it',
    runIntro: 'Four recognizable martinis. Guests order by name or by spirit. You feature it without adding a station.',
    runItems: [
      ...ON_PREMISE_ADVANTAGES.slice(4).map((a) => ({ title: a.title, body: a.description })),
      { title: 'Activation', body: ACTIVATION_IDEAS[0] },
    ].slice(0, 5),
    askIntro: 'Not a reset of your bar. A two-case test so you can see it on a Friday.',
    askItems: [
      `Start with ${OPENING_CASES} cases — enough for a martini night, a rooftop, or a banquet.`,
      'Put it on as a featured martini. Guests order by vibe. You pour in seconds.',
      'We follow up within 48 hours. Samples available.',
    ],
    ctaHref: '/lp/retail/bars',
    ctaLabel: 'Add Untamed to your menu',
  },
  'off-premise': {
    slug: 'off-premise',
    chromeLabel: 'Off-Premise',
    title: 'Untamed for Liquor Stores',
    description: 'A shelf story shoppers understand in three seconds — for liquor store owners.',
    coverEyebrow: 'For liquor stores',
    coverLine: 'A shelf story that sells itself.',
    coverSub: '1 can. 2 martinis. About $3 a cocktail. Shoppers do the math at the cold box.',
    problemTitle: 'The RTS wall is noise',
    problemIntro:
      'Shoppers give you three seconds. If the pack does not make sense, they buy the thing they already know — or the thing on deal.',
    problems: [
      { title: 'No story in three seconds', body: 'Flavor names and 40-SKU walls do not stop a shopper who is already late.' },
      { title: 'Discounting to move it', body: 'If value is not obvious, the only lever left is a sale that eats your margin.' },
      { title: 'One-and-done flavors', body: 'They try it once. They do not come back for the next SKU.' },
      { title: 'You fund the awareness', body: 'Most brands leave you to educate the shopper alone.' },
    ],
    winTitle: 'What changes at the shelf',
    winIntro: 'Premium ring without a lecture. A value story the shopper can repeat to the next person in line.',
    advantages: RETAILER_ADVANTAGES.slice(0, 4),
    runTitle: 'How you merchandise it',
    runIntro: 'Four SKUs. Cold box or shelf. Identity, not a flavor wall.',
    runItems: [
      ...RETAILER_ADVANTAGES.slice(4).map((a) => ({ title: a.title, body: a.description })),
      { title: PROMISE_ITEMS[1].label, body: PROMISE_ITEMS[1].desc },
    ].slice(0, 5),
    askIntro: 'Not a reset of your set. A two-case test so you can watch it deplete.',
    askItems: [
      `Start with ${OPENING_CASES} cases — cold box for now, shelf for stock-up.`,
      'Put 1-2-3 on the price tag. Shoppers do the math themselves.',
      'We follow up within 48 hours with sell-in support.',
    ],
    ctaHref: '/lp/retail/liquor',
    ctaLabel: 'Carry Untamed in your store',
  },
}

export function getLocationDeck(slug: string): LocationPitch | undefined {
  if (slug === 'on-premise' || slug === 'off-premise') return LOCATION_DECKS[slug]
  return undefined
}
