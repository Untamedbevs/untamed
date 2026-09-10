'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin, Navigation } from 'lucide-react'
import { MapLinks } from '@/components/locations/MapLinks'
import { LocatorMap } from '@/components/locations/LocatorMap'
import { HeroBoxGrid } from '@/components/locations/HeroBoxGrid'
import {
  formatAddress,
  isOnPremiseLocation,
  LOCATION_TYPE_LABELS,
  type GeoPoint,
  type PublicRetailLocation,
} from '@/lib/retail/locations'

interface LocatorResponse {
  locations: PublicRetailLocation[]
  origin: GeoPoint | null
  originLabel: string | null
}

export function StoreLocator() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<LocatorResponse>({
    locations: [],
    origin: null,
    originLabel: null,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (params: URLSearchParams) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/locations?${params.toString()}`)
      const json = (await res.json()) as LocatorResponse & { error?: string }
      if (!res.ok) throw new Error(json.error || 'Could not load locations')
      const locations = json.locations || []
      const origin = json.origin || null
      setData({
        locations,
        origin,
        originLabel: json.originLabel || null,
      })
      setSelectedId(pickMostRelevantId(locations, origin))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load locations')
    } finally {
      setLoading(false)
      setLocating(false)
    }
  }, [])

  useEffect(() => {
    void load(new URLSearchParams())
  }, [load])

  function search(e: React.FormEvent) {
    e.preventDefault()
    const near = query.trim()
    const params = new URLSearchParams()
    if (near) params.set('near', near)
    void load(params)
  }

  const retailLocations = useMemo(
    () => data.locations.filter((loc) => !isOnPremiseLocation(loc.location_type)),
    [data.locations]
  )
  const onPremiseLocations = useMemo(
    () => data.locations.filter((loc) => isOnPremiseLocation(loc.location_type)),
    [data.locations]
  )
  const closestBuy = data.origin ? retailLocations[0] || null : null
  const closestTry = data.origin ? onPremiseLocations[0] || null : null
  const moreRetail = closestBuy
    ? retailLocations.filter((loc) => loc.id !== closestBuy.id)
    : retailLocations
  const moreTry = closestTry
    ? onPremiseLocations.filter((loc) => loc.id !== closestTry.id)
    : onPremiseLocations

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams({
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
        })
        void load(params)
      },
      () => {
        setLocating(false)
        setError('Could not read your location. Try a city or ZIP instead.')
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden pt-8 md:pt-10 pb-6">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[180px] opacity-15 bg-panther" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-[160px] opacity-10 bg-lioness" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#C084FC] mb-3">Find Untamed</p>
          <h1 className="font-condensed text-4xl md:text-5xl lg:text-6xl font-bold uppercase text-untamed-white mb-4">
            Buy or Try Untamed
          </h1>
          <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto mb-8">
            Look up a city or ZIP to buy Untamed at retail or try it on-premise. Open directions in Apple Maps or Google Maps.
          </p>

          <div className="mb-8">
            <HeroBoxGrid />
          </div>

          <form onSubmit={search} className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="City or ZIP — Fort Myers, 32803"
              className="flex-1 rounded-full border border-untamed-white/15 bg-untamed-black-card px-5 py-3 text-untamed-white placeholder:text-[#666] focus:outline-none focus:border-[#9B30FF]"
            />
            <button
              type="submit"
              className="rounded-full bg-untamed-white text-untamed-black font-semibold px-6 py-3 hover:bg-panther-light hover:text-white transition-colors"
            >
              Find locations
            </button>
            <button
              type="button"
              onClick={useMyLocation}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-untamed-white/20 text-untamed-white px-5 py-3 hover:border-untamed-white transition-colors"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Near me
            </button>
          </form>
          {data.originLabel && (
            <p className="mt-3 text-sm text-untamed-white-muted">
              Closest buy and try spots near {data.originLabel}
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
          <div>
            <div className="overflow-hidden rounded-2xl border border-card-border h-[320px] md:h-[520px]">
              {loading && data.locations.length === 0 ? (
                <div className="h-full flex items-center justify-center text-untamed-white-muted">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <LocatorMap
                  locations={data.locations}
                  selectedId={selectedId}
                  origin={data.origin}
                  onSelect={setSelectedId}
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-untamed-white-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#9B30FF]" />
                Retail
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF8C2A]" />
                On-premise
              </span>
            </div>
          </div>

          <div className="space-y-6 lg:max-h-[520px] lg:overflow-y-auto lg:pr-1">
            {data.locations.length === 0 && !loading && (
              <p className="text-untamed-white-muted text-sm">
                No published locations yet. Check back soon, or carry Untamed in your store.
              </p>
            )}
            {data.origin && (closestBuy || closestTry) && (
              <div>
                <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-untamed-white">
                  Closest to you
                </h2>
                <p className="text-sm text-untamed-white-muted mt-1 mb-3">
                  The nearest place to buy and the nearest place to try
                </p>
                <div className="space-y-3">
                  {closestBuy && (
                    <LocationCard
                      loc={closestBuy}
                      selected={closestBuy.id === selectedId}
                      badge="Closest buy"
                      onSelect={setSelectedId}
                    />
                  )}
                  {closestTry && (
                    <LocationCard
                      loc={closestTry}
                      selected={closestTry.id === selectedId}
                      badge="Closest try"
                      onSelect={setSelectedId}
                    />
                  )}
                </div>
              </div>
            )}
            <LocationGroup
              title={data.origin ? 'More retail' : 'Retail locations'}
              subtitle="Buy Untamed to take home"
              locations={data.origin ? moreRetail : retailLocations}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <LocationGroup
              title={data.origin ? 'More on-premise' : 'On-premise locations'}
              subtitle="Stop in and try Untamed"
              locations={data.origin ? moreTry : onPremiseLocations}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function LocationGroup({
  title,
  subtitle,
  locations,
  selectedId,
  onSelect,
}: {
  title: string
  subtitle: string
  locations: PublicRetailLocation[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (locations.length === 0) return null

  return (
    <div>
      <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-untamed-white">
        {title}
      </h2>
      <p className="text-sm text-untamed-white-muted mt-1 mb-3">{subtitle}</p>
      <div className="space-y-3">
        {locations.map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            selected={loc.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function pickMostRelevantId(
  locations: PublicRetailLocation[],
  origin: GeoPoint | null
): string | null {
  if (!locations.length) return null
  if (!origin) return locations[0].id

  const closestBuy = locations.find((loc) => !isOnPremiseLocation(loc.location_type))
  const closestTry = locations.find((loc) => isOnPremiseLocation(loc.location_type))
  const featured = [closestBuy, closestTry].filter(
    (loc): loc is PublicRetailLocation => Boolean(loc)
  )
  featured.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity))
  return featured[0]?.id || locations[0].id
}

function formatMiles(miles: number): string {
  return miles < 10 ? miles.toFixed(1) : String(Math.round(miles))
}

function LocationCard({
  loc,
  selected,
  onSelect,
  badge,
}: {
  loc: PublicRetailLocation
  selected: boolean
  onSelect: (id: string) => void
  badge?: string
}) {
  const onPremise = isOnPremiseLocation(loc.location_type)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(loc.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(loc.id)
      }}
      className={`w-full text-left rounded-2xl border p-4 transition-colors cursor-pointer ${
        selected
          ? onPremise
            ? 'border-[#FF8C2A] bg-[#FF8C2A]/10'
            : 'border-[#9B30FF] bg-[#9B30FF]/10'
          : 'border-card-border bg-untamed-black-card hover:border-untamed-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {badge && (
            <p
              className="text-[11px] uppercase tracking-[0.16em] mb-1.5"
              style={{ color: onPremise ? '#FF8C2A' : '#C084FC' }}
            >
              {badge}
            </p>
          )}
          <p className="font-semibold text-untamed-white">{loc.name}</p>
          <p className="text-sm text-untamed-white-muted mt-1">{formatAddress(loc)}</p>
          <p className="text-xs uppercase tracking-wider text-[#888] mt-2">
            {LOCATION_TYPE_LABELS[loc.location_type]}
          </p>
        </div>
        {loc.distanceMiles != null && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs text-[#FFD700]">
            <MapPin className="w-3.5 h-3.5" />
            {formatMiles(loc.distanceMiles)} mi
          </span>
        )}
      </div>
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <MapLinks location={loc} size="sm" />
      </div>
    </div>
  )
}
