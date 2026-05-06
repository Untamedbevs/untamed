'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Play } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

interface GalleryItem {
  type: 'video' | 'image'
  src: string
  alt: string
  label: string
  thumb?: string
}

interface ProductGalleryProps {
  drink: Drink
}

function cdnUrl(path: string): string {
  return siteAssetAbsoluteUrl(path)
}

function getGalleryItems(drink: Drink): GalleryItem[] {
  return [
    { type: 'video', src: cdnUrl(drink.productVideo), alt: `${drink.name} Product Video`, label: 'Video', thumb: cdnUrl(drink.productVideoThumb) },
    { type: 'image', src: cdnUrl(drink.canImage), alt: `${drink.name} Can Front`, label: 'Can Front' },
    { type: 'image', src: cdnUrl(drink.canImageBack), alt: `${drink.name} Can Back`, label: 'Can Back' },
    { type: 'image', src: cdnUrl(drink.canImageFrontAndBack), alt: `${drink.name} Front & Back`, label: 'Both Sides' },
    { type: 'image', src: cdnUrl(drink.boxImageFront), alt: `${drink.name} Box Front`, label: 'Box Front' },
    { type: 'image', src: cdnUrl(drink.boxImageBack), alt: `${drink.name} Box Back`, label: 'Box Back' },
  ]
}

export function ProductGallery({ drink }: ProductGalleryProps) {
  const items = getGalleryItems(drink)
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleSelect(index: number) {
    setDirection(index > activeIndex ? 1 : -1)
    setActiveIndex(index)
    if (index === 0 && videoRef.current) {
      videoRef.current.muted = false
      videoRef.current.play()
    } else if (videoRef.current) {
      videoRef.current.pause()
    }
  }

  const activeItem = items[activeIndex]

  return (
    <div className="flex flex-col items-center gap-4 lg:sticky lg:top-28">
      {/* Main Display */}
      <div className="relative w-full aspect-square max-w-md overflow-hidden">

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {activeItem.type === 'video' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <video
                  ref={videoRef}
                  src={activeItem.src}
                  className="max-w-full max-h-[calc(100%-1.5rem)] rounded-xl object-contain cursor-pointer"
                  style={{ clipPath: 'inset(0 round 0.75rem)' }}
                  autoPlay
                  muted
                  loop
                  playsInline
                  onClick={(e) => {
                    e.preventDefault()
                    const video = videoRef.current
                    if (video) {
                      video.muted = !video.muted
                    }
                  }}
                />
                <span className="text-[10px] text-untamed-white-muted tracking-wide">
                  Tap for sound
                </span>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <Image
                  src={activeItem.src}
                  alt={activeItem.alt}
                  fill
                  className="object-contain drop-shadow-[0_0_40px_rgba(0,0,0,0.5)]"
                  priority={activeIndex === 0}
                  unoptimized
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1 max-w-full px-1">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(idx)}
            className="relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all duration-300 bg-untamed-black-card"
            style={{
              borderColor: idx === activeIndex ? drink.color : 'rgba(255,255,255,0.1)',
              boxShadow: idx === activeIndex ? `0 0 12px ${drink.colorGlow}` : 'none',
            }}
          >
            {item.type === 'video' ? (
              <div className="absolute inset-0">
                {item.thumb && (
                  <Image
                    src={item.thumb}
                    alt={item.label}
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="w-5 h-5 fill-current" style={{ color: drink.color }} />
                </div>
              </div>
            ) : (
              <Image
                src={item.src}
                alt={item.label}
                fill
                className="object-contain p-1"
                sizes="80px"
                unoptimized
              />
            )}
          </button>
        ))}
      </div>

      {/* Label */}
      <p
        className="text-xs tracking-wider uppercase font-medium"
        style={{ color: drink.color }}
      >
        {activeItem.label}
      </p>
    </div>
  )
}
