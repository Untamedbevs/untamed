'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MapPin, Navigation } from 'lucide-react'
import { MapLinks } from '@/components/locations/MapLinks'
import { LocatorMap } from '@/components/locations/LocatorMap'
import { HeroBoxGrid } from '@/components/locations/HeroBoxGrid'
import {
  formatAddress,
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
      setData({
        locations: json.locations || [],
        origin: json.origin || null,
        originLabel: json.originLabel || null,
      })
      setSelectedId(json.locations?.[0]?.id || null)
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
            Where to buy
          </h1>
          <p className="text-untamed-white-muted text-lg max-w-2xl mx-auto mb-8">
            Look up a city or ZIP to find retailers carrying Untamed. Open directions in Apple Maps or Google Maps.
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
              Find stores
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
              Showing stores near {data.originLabel}
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
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

          <div className="space-y-3">
            {data.locations.length === 0 && !loading && (
              <p className="text-untamed-white-muted text-sm">
                No published locations yet. Check back soon, or carry Untamed in your store.
              </p>
            )}
            {data.locations.map((loc) => {
              const selected = loc.id === selectedId
              return (
                <div
                  key={loc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(loc.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedId(loc.id)
                  }}
                  className={`w-full text-left rounded-2xl border p-4 transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#9B30FF] bg-[#9B30FF]/10'
                      : 'border-card-border bg-untamed-black-card hover:border-untamed-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-untamed-white">{loc.name}</p>
                      <p className="text-sm text-untamed-white-muted mt-1">{formatAddress(loc)}</p>
                      <p className="text-xs uppercase tracking-wider text-[#888] mt-2">
                        {LOCATION_TYPE_LABELS[loc.location_type]}
                      </p>
                    </div>
                    {loc.distanceMiles != null && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-[#FFD700]">
                        <MapPin className="w-3.5 h-3.5" />
                        {loc.distanceMiles < 10
                          ? loc.distanceMiles.toFixed(1)
                          : Math.round(loc.distanceMiles)}{' '}
                        mi
                      </span>
                    )}
                  </div>
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <MapLinks location={loc} size="sm" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
