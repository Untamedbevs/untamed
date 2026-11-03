import Image from 'next/image'
import { FLAVORS, type Flavor } from '@/lib/referral-hq/program'

const CAN_ART: Record<Flavor, string> = {
  'black-panther': '/images/can-black-panther.png',
  cheetah: '/images/can-cheetah.png',
  cougar: '/images/can-cougar.png',
  lioness: '/images/can-lioness.png',
}

/**
 * Lifetime 4-packs by flavor. Each row carries its flavor name, so the brand
 * colors (which aren't colorblind-separable) are never the only identifier.
 */
export function FlavorMix({ packsByFlavor }: { packsByFlavor: Record<Flavor, number> }) {
  const rows = (Object.keys(FLAVORS) as Flavor[])
    .map((f) => ({ flavor: f, packs: packsByFlavor[f] }))
    .sort((a, b) => b.packs - a.packs)
  const max = Math.max(1, ...rows.map((r) => r.packs))

  return (
    <section className="rounded-3xl border border-[#2A2A2A] bg-[#141414] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">4-packs by flavor</h2>
      <ul className="mt-4 space-y-3">
        {rows.map(({ flavor, packs }) => (
          <li key={flavor} className="flex items-center gap-3">
            <Image src={CAN_ART[flavor]} alt="" width={20} height={52} className="h-11 w-auto shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-white">{FLAVORS[flavor].name}</span>
                <span className="font-display font-bold text-white tabular-nums">{packs}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-[#222] overflow-hidden">
                <div
                  className="h-full rounded-r-[4px] transition-[width] duration-500"
                  style={{ width: `${(packs / max) * 100}%`, backgroundColor: FLAVORS[flavor].color }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-[#666]">{FLAVORS[flavor].drink}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
