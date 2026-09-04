import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeOrigin } from '@/lib/retail/geocode'
import {
  toPublicLocation,
  type GeoPoint,
  type RetailLocation,
} from '@/lib/retail/locations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const near = searchParams.get('near')?.trim() || ''
    const latRaw = searchParams.get('lat')
    const lngRaw = searchParams.get('lng')
    const lat = latRaw ? Number(latRaw) : Number.NaN
    const lng = lngRaw ? Number(lngRaw) : Number.NaN

    let origin: GeoPoint | null = null
    let originLabel: string | null = null

    if (
      latRaw &&
      lngRaw &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      origin = { lat, lng }
      originLabel = 'Your location'
    } else if (near.length >= 2) {
      const hit = await geocodeOrigin(near)
      if (hit) {
        origin = { lat: hit.latitude, lng: hit.longitude }
        originLabel = hit.label
      }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('retail_locations')
      .select(
        'id, name, chain, location_type, address_line1, address_line2, city, state, postal_code, latitude, longitude, phone, published, notes, created_at, updated_at'
      )
      .eq('published', true)
      .order('city', { ascending: true })

    if (error) throw error

    const locations = ((data || []) as RetailLocation[])
      .map((row) => toPublicLocation(row, origin))
      .sort((a, b) => {
        const da = a.distanceMiles ?? Number.POSITIVE_INFINITY
        const db = b.distanceMiles ?? Number.POSITIVE_INFINITY
        if (da !== db) return da - db
        return a.city.localeCompare(b.city)
      })

    return NextResponse.json({
      locations,
      origin,
      originLabel,
      nearestMiles: locations[0]?.distanceMiles ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load locations' }, { status: 500 })
  }
}
