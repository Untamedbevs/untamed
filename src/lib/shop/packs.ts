/**
 * Build Your Pack: preset box combinations for the pack builder landing page.
 * A "box" is one 4-can box of a single flavor; a pack is PACK_SIZE boxes, which
 * is the count that clears the free-shipping threshold (see lib/promo/holiday).
 * `boxes` lists drink slugs from lib/drinks, one entry per box.
 */

export const PACK_SIZE = 4
/** AccelPay minimum order (matches ShippingRates copy). */
export const MIN_BOXES = 2
export const MAX_BOXES = 12

export interface PackPreset {
  slug: string
  name: string
  pitch: string
  boxes: string[]
}

export const MIXED_PACKS: PackPreset[] = [
  {
    slug: 'full-pride',
    name: 'The Full Pride',
    pitch: 'One of each. Meet all four cats.',
    boxes: ['black-panther', 'cheetah', 'cougar', 'lioness'],
  },
  {
    slug: 'sweet-and-sour',
    name: 'Sweet & Sour',
    pitch: 'Peach against lemon. The bright, fruity one.',
    boxes: ['lioness', 'lioness', 'cheetah', 'cheetah'],
  },
  {
    slug: 'dark-and-dirty',
    name: 'Dark & Dirty',
    pitch: 'Espresso and classic dirty. No fruit, all martini.',
    boxes: ['black-panther', 'black-panther', 'cougar', 'cougar'],
  },
  {
    slug: 'day-and-night',
    name: 'Day & Night',
    pitch: 'Peach for the afternoon, espresso for after dark.',
    boxes: ['lioness', 'lioness', 'black-panther', 'black-panther'],
  },
  {
    slug: 'after-party',
    name: 'The After Party',
    pitch: 'Lemon drop to get it going, espresso to keep it going.',
    boxes: ['cheetah', 'cheetah', 'black-panther', 'black-panther'],
  },
  {
    slug: 'ladies-night',
    name: 'Ladies’ Night',
    pitch: 'Cougar and Lioness. The two queens of the lineup.',
    boxes: ['cougar', 'cougar', 'lioness', 'lioness'],
  },
  {
    slug: 'salt-and-citrus',
    name: 'Salt & Citrus',
    pitch: 'Briny and bright. Nothing sweet, nothing creamy.',
    boxes: ['cougar', 'cougar', 'cheetah', 'cheetah'],
  },
]

/** Four boxes of one flavor, keyed by drink slug. */
export const SOLO_PACKS: Record<string, PackPreset> = {
  lioness: {
    slug: 'pride-of-lioness',
    name: 'A Pride of Lioness',
    pitch: 'All Peach & Rosemary.',
    boxes: ['lioness', 'lioness', 'lioness', 'lioness'],
  },
  cheetah: {
    slug: 'coalition-of-cheetah',
    name: 'A Coalition of Cheetah',
    pitch: 'All Lemon Drop.',
    boxes: ['cheetah', 'cheetah', 'cheetah', 'cheetah'],
  },
  'black-panther': {
    slug: 'shadow-of-panther',
    name: 'A Shadow of Panther',
    pitch: 'All Espresso.',
    boxes: ['black-panther', 'black-panther', 'black-panther', 'black-panther'],
  },
  cougar: {
    slug: 'prowl-of-cougar',
    name: 'A Prowl of Cougar',
    pitch: 'All Classic Dirty.',
    boxes: ['cougar', 'cougar', 'cougar', 'cougar'],
  },
}

export const ALL_PACKS: PackPreset[] = [...MIXED_PACKS, ...Object.values(SOLO_PACKS)]

export function getPackBySlug(slug: string | null | undefined): PackPreset | undefined {
  if (!slug) return undefined
  return ALL_PACKS.find((p) => p.slug === slug)
}

function signature(boxes: string[]): string {
  return [...boxes].sort().join('|')
}

/** The preset whose contents equal `boxes` (order-insensitive), if any. */
export function matchPack(boxes: string[]): PackPreset | undefined {
  if (boxes.length !== PACK_SIZE) return undefined
  const sig = signature(boxes)
  return ALL_PACKS.find((p) => signature(p.boxes) === sig)
}
