import type { Metadata } from 'next'
import { getDrinkBySlug } from '@/lib/drinks'
import { DrinkDetailPage } from '@/components/DrinkDetailPage'

const drink = getDrinkBySlug('black-panther')!

export const metadata: Metadata = {
  title: `${drink.name} ${drink.flavor} | Untamed Beverages`,
  description: `${drink.name} ${drink.flavor} - ${drink.subtitle}. ${drink.tagline} ${drink.servings}, ${drink.abv} ALC/VOL. Chill it. Shake it. Unleash it!`,
  openGraph: {
    title: `${drink.name} ${drink.flavor} | Untamed Beverages`,
    description: `${drink.tagline} ${drink.servings} at ${drink.abv} ALC/VOL.`,
    images: [drink.canImage],
  },
}

export default function BlackPantherPage() {
  return <DrinkDetailPage drink={drink} />
}
