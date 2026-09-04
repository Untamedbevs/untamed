export const LOCATION_TYPES = [
  'liquor_store',
  'bar',
  'restaurant',
  'grocery',
  'other',
] as const

export type RetailLocationType = (typeof LOCATION_TYPES)[number]

export const LOCATION_TYPE_LABELS: Record<RetailLocationType, string> = {
  liquor_store: 'Liquor store',
  bar: 'Bar',
  restaurant: 'Restaurant',
  grocery: 'Grocery',
  other: 'Other',
}

export interface RetailLocation {
  id: string
  name: string
  chain: string | null
  location_type: RetailLocationType
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
  latitude: number
  longitude: number
  phone: string | null
  published: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type PublicRetailLocation = Omit<RetailLocation, 'notes' | 'published'> & {
  distanceMiles?: number | null
}

export interface GeoPoint {
  lat: number
  lng: number
}

export function formatAddress(loc: Pick<
  RetailLocation,
  'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
>): string {
  const street = [loc.address_line1, loc.address_line2].filter(Boolean).join(', ')
  return `${street}, ${loc.city}, ${loc.state} ${loc.postal_code}`
}

export function mapsQuery(loc: Pick<
  RetailLocation,
  'name' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
>): string {
  return `${loc.name}, ${formatAddress(loc)}`
}

/** Deep-link that opens Apple Maps. No API key. */
export function appleMapsUrl(loc: Pick<
  RetailLocation,
  'name' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code' | 'latitude' | 'longitude'
>): string {
  const params = new URLSearchParams({
    q: mapsQuery(loc),
    ll: `${loc.latitude},${loc.longitude}`,
    address: formatAddress(loc),
  })
  return `https://maps.apple.com/?${params.toString()}`
}

/** Deep-link that opens Google Maps. No API key. */
export function googleMapsUrl(loc: Pick<
  RetailLocation,
  'name' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code' | 'latitude' | 'longitude'
>): string {
  const params = new URLSearchParams({
    api: '1',
    query: mapsQuery(loc),
  })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export function milesBetween(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.8
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function isLocationType(value: string): value is RetailLocationType {
  return (LOCATION_TYPES as readonly string[]).includes(value)
}

export function toPublicLocation(
  row: RetailLocation,
  origin?: GeoPoint | null
): PublicRetailLocation {
  const { notes: _notes, published: _published, ...rest } = row
  return {
    ...rest,
    distanceMiles: origin
      ? milesBetween(origin, { lat: row.latitude, lng: row.longitude })
      : null,
  }
}

function emptyToNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function parseLocationWrite(
  body: Record<string, unknown>,
  partial: boolean
): { error: string } | { row: Record<string, unknown> } {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const address = typeof body.address_line1 === 'string' ? body.address_line1.trim() : ''
  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const state = typeof body.state === 'string' ? body.state.trim().toUpperCase() : ''
  const postal = typeof body.postal_code === 'string' ? body.postal_code.trim() : ''
  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)
  const locationType = typeof body.location_type === 'string' ? body.location_type : 'liquor_store'

  if (!partial) {
    if (!name) return { error: 'Name is required' }
    if (!address) return { error: 'Street address is required' }
    if (!city) return { error: 'City is required' }
    if (!/^[A-Z]{2}$/.test(state)) return { error: 'State must be a 2-letter code' }
    if (!postal) return { error: 'ZIP is required' }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { error: 'Look up the address so we can place it on the map' }
    }
    if (!isLocationType(locationType)) return { error: 'Invalid location type' }
  }

  const row: Record<string, unknown> = {}
  if (!partial || body.name !== undefined) row.name = name
  if (!partial || body.chain !== undefined) row.chain = emptyToNull(body.chain)
  if (!partial || body.location_type !== undefined) {
    row.location_type = isLocationType(locationType) ? locationType : 'liquor_store'
  }
  if (!partial || body.address_line1 !== undefined) row.address_line1 = address
  if (!partial || body.address_line2 !== undefined) row.address_line2 = emptyToNull(body.address_line2)
  if (!partial || body.city !== undefined) row.city = city
  if (!partial || body.state !== undefined) row.state = state
  if (!partial || body.postal_code !== undefined) row.postal_code = postal
  if (!partial || body.latitude !== undefined) row.latitude = latitude
  if (!partial || body.longitude !== undefined) row.longitude = longitude
  if (!partial || body.phone !== undefined) row.phone = emptyToNull(body.phone)
  if (!partial || body.published !== undefined) row.published = body.published !== false
  if (!partial || body.notes !== undefined) row.notes = emptyToNull(body.notes)
  return { row }
}
