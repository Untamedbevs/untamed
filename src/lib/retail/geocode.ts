export interface GeocodeCandidate {
  label: string
  name: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  latitude: number
  longitude: number
  source: 'nominatim' | 'census'
  kind: string
}

const NOMINATIM_UA = 'UntamedBeverages/1.0 (https://untamedbevs.com; locations lookup)'

interface NominatimHit {
  lat: string
  lon: string
  display_name: string
  class?: string
  type?: string
  addresstype?: string
  name?: string
  address?: {
    house_number?: string
    road?: string
    pedestrian?: string
    suburb?: string
    city?: string
    town?: string
    village?: string
    hamlet?: string
    county?: string
    state?: string
    'ISO3166-2-lvl4'?: string
    postcode?: string
  }
}

function streetFromNominatim(hit: NominatimHit): string | null {
  const house = hit.address?.house_number
  const road = hit.address?.road || hit.address?.pedestrian
  if (house && road) return `${house} ${road}`
  return road || null
}

function cityFromNominatim(hit: NominatimHit): string | null {
  return (
    hit.address?.city ||
    hit.address?.town ||
    hit.address?.village ||
    hit.address?.hamlet ||
    hit.address?.suburb ||
    null
  )
}

function stateFromNominatim(hit: NominatimHit): string | null {
  const iso = hit.address?.['ISO3166-2-lvl4']
  if (iso && iso.includes('-')) return iso.split('-')[1]
  const raw = hit.address?.state
  if (raw === 'Florida') return 'FL'
  return raw && raw.length === 2 ? raw.toUpperCase() : null
}

function kindScore(kind: string): number {
  if (kind.includes('shop') || kind.includes('alcohol') || kind.includes('amenity')) return 3
  if (kind.includes('building') || kind.includes('place')) return 2
  if (kind.includes('road') || kind.includes('highway')) return 0
  return 1
}

function toNominatimCandidate(hit: NominatimHit): GeocodeCandidate {
  const kind = [hit.class, hit.type, hit.addresstype].filter(Boolean).join('/')
  return {
    label: hit.display_name,
    name: hit.name || null,
    addressLine1: streetFromNominatim(hit),
    city: cityFromNominatim(hit),
    state: stateFromNominatim(hit),
    postalCode: hit.address?.postcode?.split(';')[0] || null,
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    source: 'nominatim',
    kind,
  }
}

async function nominatimSearch(query: string): Promise<GeocodeCandidate[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '5')
  url.searchParams.set('countrycodes', 'us')
  url.searchParams.set('q', query)

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const hits = (await res.json()) as NominatimHit[]
  return hits
    .map(toNominatimCandidate)
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
}

interface CensusMatch {
  matchedAddress?: string
  coordinates?: { x: number; y: number }
  addressComponents?: {
    fromAddress?: string
    toAddress?: string
    preDirection?: string
    streetName?: string
    suffixType?: string
    city?: string
    state?: string
    zip?: string
  }
}

function streetFromCensus(match: CensusMatch): string | null {
  const parts = match.addressComponents
  if (!parts) return null
  const number = parts.fromAddress
  const street = [parts.preDirection, parts.streetName, parts.suffixType]
    .filter(Boolean)
    .join(' ')
  if (number && street) return `${number} ${street}`
  return match.matchedAddress?.split(',')[0] || null
}

async function censusSearch(query: string): Promise<GeocodeCandidate[]> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
  url.searchParams.set('address', query)
  url.searchParams.set('benchmark', '4')
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) return []
  const data = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } }
  const matches = data.result?.addressMatches || []
  return matches
    .filter((m) => m.coordinates && Number.isFinite(m.coordinates.x) && Number.isFinite(m.coordinates.y))
    .map((m) => ({
      label: m.matchedAddress || query,
      name: null,
      addressLine1: streetFromCensus(m),
      city: m.addressComponents?.city
        ? m.addressComponents.city.replace(/\w\S*/g, (w) => w.charAt(0) + w.slice(1).toLowerCase())
        : null,
      state: m.addressComponents?.state || null,
      postalCode: m.addressComponents?.zip || null,
      latitude: m.coordinates!.y,
      longitude: m.coordinates!.x,
      source: 'census' as const,
      kind: 'address',
    }))
}

function dedupe(candidates: GeocodeCandidate[]): GeocodeCandidate[] {
  const seen = new Set<string>()
  const out: GeocodeCandidate[] = []
  for (const c of candidates) {
    const key = `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

function rank(candidates: GeocodeCandidate[], query: string): GeocodeCandidate[] {
  const q = query.toLowerCase()
  return [...candidates].sort((a, b) => {
    const aName = a.name?.toLowerCase().includes('total wine') ? 4 : 0
    const bName = b.name?.toLowerCase().includes('total wine') ? 4 : 0
    const aQ = a.label.toLowerCase().includes(q.slice(0, 20)) ? 1 : 0
    const bQ = b.label.toLowerCase().includes(q.slice(0, 20)) ? 1 : 0
    return bName + kindScore(b.kind) + bQ - (aName + kindScore(a.kind) + aQ)
  })
}

export async function geocodeQuery(query: string): Promise<GeocodeCandidate[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const queries = [trimmed]
  const looksLikeStreet = /\d/.test(trimmed) && !/total wine/i.test(trimmed)
  if (looksLikeStreet) queries.push(`Total Wine ${trimmed}`)

  const collected: GeocodeCandidate[] = []
  for (const q of queries) {
    collected.push(...(await nominatimSearch(q)))
    await new Promise((r) => setTimeout(r, 1100))
  }

  const hasBuilding = collected.some((c) => kindScore(c.kind) >= 2)
  if (!hasBuilding && looksLikeStreet) {
    collected.push(...(await censusSearch(trimmed)))
  }

  return rank(dedupe(collected), trimmed).slice(0, 6)
}

export async function geocodeOrigin(query: string): Promise<GeocodeCandidate | null> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return null
  const hits = rank(await nominatimSearch(trimmed), trimmed)
  if (hits[0]) return hits[0]
  const census = await censusSearch(trimmed)
  return census[0] || null
}
