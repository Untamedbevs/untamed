export const POINTS = {
  SIGNUP_BONUS: 10,
  PER_RECEIPT: 25,
  PER_UGC_APPROVED: 50,
  PER_UGC_FEATURED: 150,
} as const

export const REWARDS = [
  {
    id: 'sticker-pack',
    name: 'Untamed Sticker Pack',
    description: 'A set of premium die-cut stickers featuring all four big cats.',
    pointsCost: 50,
    image: '/images/rewards/stickers.png',
  },
  {
    id: 'coasters',
    name: 'Untamed Coasters',
    description: 'Set of 4 cork-backed coasters, one per big cat.',
    pointsCost: 100,
    image: '/images/rewards/coasters.png',
  },
  {
    id: 'koozie',
    name: 'Untamed Koozie',
    description: 'Neoprene can koozie with the Untamed claw logo.',
    pointsCost: 150,
    image: '/images/rewards/koozie.png',
  },
  {
    id: 'branded-glass',
    name: 'Untamed Martini Glass',
    description: 'A sleek 6 oz martini glass with the Untamed claw logo.',
    pointsCost: 200,
    image: '/images/rewards/glass.png',
  },
  {
    id: 'tote-bag',
    name: 'Untamed Tote Bag',
    description: 'Heavy-duty canvas tote with the full Untamed pride logo.',
    pointsCost: 350,
    image: '/images/rewards/tote-bag.png',
  },
  {
    id: 'merch-bundle',
    name: 'Untamed Merch Bundle',
    description: 'Hat, T-shirt, koozie, and stickers in your favorite animal\'s colorway.',
    pointsCost: 500,
    image: '/images/rewards/merch-bundle.png',
  },
] as const

export type Reward = (typeof REWARDS)[number]
