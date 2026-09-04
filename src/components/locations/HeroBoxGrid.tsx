'use client'

import Image from 'next/image'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

export function HeroBoxGrid() {
  return (
    <div className="grid grid-cols-4 gap-2 md:gap-3 w-full">
      {drinks.map((drink, index) => (
        <a
          key={drink.slug}
          href={`/drinks/${drink.slug}`}
          className="group relative aspect-[5/4] rounded-xl border border-card-border bg-untamed-black-card transition-transform duration-300 hover:scale-[1.02]"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = drink.color
            e.currentTarget.style.boxShadow = `0 0 28px ${drink.colorGlow}`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = ''
            e.currentTarget.style.boxShadow = ''
          }}
        >
          <div className="absolute inset-2">
            <Image
              src={siteAssetAbsoluteUrl(drink.boxWithCanImage)}
              alt={`${drink.name} ${drink.flavor} box and can`}
              fill
              className="object-contain"
              sizes="(min-width: 1024px) 18vw, 25vw"
              priority
              unoptimized
            />
          </div>
          <span className="sr-only">{drink.name}</span>
        </a>
      ))}
    </div>
  )
}
