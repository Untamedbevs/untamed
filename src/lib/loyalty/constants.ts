export const POINTS = {
  SIGNUP_BONUS: 10,
  PER_RECEIPT: 25,
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
    id: 'branded-glass',
    name: 'Untamed Branded Glass',
    description: 'A sleek 6 oz martini glass with the Untamed claw logo.',
    pointsCost: 150,
    image: '/images/rewards/glass.png',
  },
  {
    id: 'variety-4pack',
    name: 'Untamed 4-Pack',
    description: 'One can of each flavor: Black Panther, Cheetah, Cougar, and Lioness.',
    pointsCost: 300,
    image: '/images/rewards/variety-pack.png',
  },
  {
    id: 'merch-bundle',
    name: 'Untamed Merch Bundle',
    description: 'Hat, T-shirt, and koozie in your favorite animal\'s colorway.',
    pointsCost: 500,
    image: '/images/rewards/merch-bundle.png',
  },
] as const

export type Reward = (typeof REWARDS)[number]
