'use client'

import { DeckShell } from '@/components/deck/DeckShell'
import { SLIDES } from './slides'

export function BriefingDeck() {
  return <DeckShell slides={SLIDES} chromeLabel="Owner Briefing" />
}
