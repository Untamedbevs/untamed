import { drinks } from '@/lib/drinks'

/**
 * The four Untamed big cats as spirit animals: picked during Pack Rewards
 * onboarding, saved as the member's favorite drink, and used to theme their
 * pass. Copy and colors come from the drink pages.
 */

const ART: Record<string, string> = {
  'black-panther': '/images/referral-hq/trophies/panther-pack.webp',
  cheetah: '/images/referral-hq/trophies/cheetah-sprint.webp',
  cougar: '/images/referral-hq/trophies/cougar-crew.webp',
  lioness: '/images/referral-hq/trophies/lioness-pride.webp',
}

export interface SpiritAnimal {
  slug: string
  name: string
  tagline: string
  personality: string
  color: string
  colorGlow: string
  art: string
}

export const SPIRIT_ANIMALS: SpiritAnimal[] = drinks
  .filter((d) => ART[d.slug])
  .map((d) => ({
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    personality: d.personality,
    color: d.color,
    colorGlow: d.colorGlow,
    art: ART[d.slug],
  }))

export const isSpiritAnimal = (value: unknown): value is string =>
  typeof value === 'string' && SPIRIT_ANIMALS.some((a) => a.slug === value)

export const spiritAnimalFor = (slug: string | null | undefined): SpiritAnimal | null =>
  SPIRIT_ANIMALS.find((a) => a.slug === slug) ?? null
