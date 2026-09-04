'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint, PublicRetailLocation } from '@/lib/retail/locations'
import { formatAddress } from '@/lib/retail/locations'

interface LocatorMapProps {
  locations: PublicRetailLocation[]
  selectedId: string | null
  origin: GeoPoint | null
  onSelect: (id: string) => void
}

const FLORIDA: [number, number] = [27.8, -81.7]

function pinHtml(selected: boolean) {
  const fill = selected ? '#FFD700' : '#9B30FF'
  return `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${fill};border:2px solid #FAFAFA;box-shadow:0 0 0 4px rgba(155,48,255,0.25)"></span>`
}

export function LocatorMap({ locations, selectedId, origin, onSelect }: LocatorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false
    let map: import('leaflet').Map | null = null
    let resizeObserver: ResizeObserver | null = null

    async function setup() {
      const L = (await import('leaflet')).default
      if (cancelled || !el) return

      map = L.map(el, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView(FLORIDA, 7)

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
          attribution: 'Tiles &copy; Esri',
        }
      ).addTo(map)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      ).addTo(map)

      const bounds = L.latLngBounds([])
      for (const loc of locations) {
        const selected = loc.id === selectedId
        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: L.divIcon({
            className: 'untamed-map-pin',
            html: pinHtml(selected),
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(map)
        marker.bindPopup(
          `<strong>${loc.name}</strong><br/>${formatAddress(loc)}`,
          { className: 'untamed-map-popup' }
        )
        marker.on('click', () => onSelectRef.current(loc.id))
        if (selected) marker.openPopup()
        bounds.extend([loc.latitude, loc.longitude])
      }

      if (origin) {
        L.circleMarker([origin.lat, origin.lng], {
          radius: 7,
          color: '#FFD700',
          weight: 2,
          fillColor: '#FFD700',
          fillOpacity: 0.35,
        }).addTo(map)
        bounds.extend([origin.lat, origin.lng])
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.35), { maxZoom: 11 })
      }

      resizeObserver = new ResizeObserver(() => map?.invalidateSize())
      resizeObserver.observe(el)
    }

    void setup()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      map?.remove()
    }
  }, [locations, selectedId, origin])

  return <div ref={containerRef} className="h-full w-full min-h-[280px] bg-[#111]" />
}
