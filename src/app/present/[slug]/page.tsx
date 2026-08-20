import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocationDeck, LOCATION_SLUGS } from '../decks'
import { LocationDeck } from '../LocationDeck'

export function generateStaticParams() {
  return LOCATION_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const deck = getLocationDeck(slug)
  if (!deck) return { title: 'Untamed Beverages' }
  return {
    title: `${deck.title} | Untamed Beverages`,
    description: deck.description,
    robots: { index: false, follow: false },
  }
}

export default async function LocationPresentPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const deck = getLocationDeck(slug)
  if (!deck) notFound()
  return <LocationDeck deck={deck} />
}
