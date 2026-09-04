import { appleMapsUrl, googleMapsUrl, type RetailLocation } from '@/lib/retail/locations'

type Loc = Pick<
  RetailLocation,
  'name' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code' | 'latitude' | 'longitude'
>

export function MapLinks({
  location,
  size = 'md',
}: {
  location: Loc
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={appleMapsUrl(location)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pad} inline-flex items-center rounded-full border border-untamed-white/20 text-untamed-white hover:border-untamed-white hover:bg-untamed-white/5 transition-colors`}
      >
        Apple Maps
      </a>
      <a
        href={googleMapsUrl(location)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pad} inline-flex items-center rounded-full border border-[#9B30FF]/40 text-[#C084FC] hover:border-[#9B30FF] hover:bg-[#9B30FF]/10 transition-colors`}
      >
        Google Maps
      </a>
    </div>
  )
}
