/**
 * Art staff can pick for milestones, rewards and promotions. Every key maps to
 * a transparent WebP under /images/referral-hq/. Masters live in
 * docs/referral-hq/art/.
 */

const BASE = '/images/referral-hq'

export interface ArtOption {
  key: string
  label: string
  group: 'Milestones' | 'Hunts' | 'Ranks' | 'Badges' | 'Rewards'
  src: string
}

const group = (g: ArtOption['group'], dir: string, items: [string, string][]): ArtOption[] =>
  items.map(([key, label]) => ({ key, label, group: g, src: `${BASE}/${dir}/${key}.webp` }))

export const ART_OPTIONS: ArtOption[] = [
  ...group('Milestones', 'milestones', [
    ['first-tracks', 'First tracks'],
    ['gift-bronze', 'Bronze gift card'],
    ['gift-silver', 'Silver gift card'],
    ['gift-gold', 'Gold gift card'],
    ['gift-platinum', 'Platinum gift card'],
    ['obsidian-vault', 'Treasure vault'],
    ['gift-haul', 'Gift card haul'],
    ['summit-crest', 'Summit flag'],
  ]),
  ...group('Hunts', 'hunts', [
    ['social-spotlight', 'Megaphone'],
    ['like-storm', 'Likes'],
    ['snapshot', 'Camera'],
    ['link-trail', 'Link'],
    ['pack-call', 'Roaring cheetah'],
    ['verified-claw', 'Verified shield'],
    ['last-call', 'Hourglass'],
    ['bullseye', 'Target'],
  ]),
  ...group('Ranks', 'ranks', [
    ['cub', 'Cub'],
    ['prowler', 'Prowler'],
    ['stalker', 'Stalker'],
    ['hunter', 'Hunter'],
    ['alpha', 'Alpha'],
    ['apex', 'Apex'],
    ['legend', 'Legend'],
    ['wild-credit', 'Coin'],
  ]),
  ...group('Badges', 'trophies', [
    ['panther-pack', 'Panther'],
    ['cheetah-sprint', 'Cheetah'],
    ['cougar-crew', 'Cougar'],
    ['lioness-pride', 'Lioness'],
    ['full-pride', 'Four cats'],
    ['hot-streak', 'Flame paw'],
    ['pack-builder', 'Paw ring'],
  ]),
  ...group('Rewards', 'rewards', [
    ['coins', 'Coins'],
    ['hat', 'Hat'],
    ['hoodie', 'Hoodie'],
    ['key', 'Key'],
    ['vip', 'VIP pass'],
  ]),
]

const BY_KEY = new Map(ART_OPTIONS.map((a) => [a.key, a]))

export const isArtKey = (key: unknown): key is string => typeof key === 'string' && BY_KEY.has(key)

/** Image path for an art key, with a fallback for missing or retired keys. */
export function artSrc(key: string | null | undefined, fallback = 'gift-gold'): string {
  return (key && BY_KEY.get(key)?.src) || BY_KEY.get(fallback)!.src
}
