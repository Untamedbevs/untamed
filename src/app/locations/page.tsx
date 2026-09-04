import type { Metadata } from 'next'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { StoreLocator } from '@/components/locations/StoreLocator'

export const metadata: Metadata = {
  title: 'Find Untamed | Untamed Beverages',
  description:
    'Find retailers carrying Untamed ready-to-serve vodka martinis. Look up a city or ZIP and open directions in Apple Maps or Google Maps.',
}

export default function LocationsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-untamed-black">
      <Navigation />
      <StoreLocator />
      <Footer />
    </div>
  )
}
