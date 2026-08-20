'use client'

import { DeckShell } from '@/components/deck/DeckShell'
import { slidesFor } from './slides'
import type { LocationPitch } from './decks'

export function LocationDeck({ deck }: { deck: LocationPitch }) {
  return <DeckShell slides={slidesFor(deck)} chromeLabel={deck.chromeLabel} />
}
