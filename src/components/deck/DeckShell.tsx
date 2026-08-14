'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, LayoutGrid, Printer, X } from 'lucide-react'

export interface DeckSlide {
  id: string
  section: string
  title: string
  render: () => ReactNode
}

export function DeckShell({
  slides,
  chromeLabel,
}: {
  slides: DeckSlide[]
  chromeLabel: string
}) {
  const sections = Array.from(new Set(slides.map((s) => s.section)))
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const indexRef = useRef(0)

  const slideIndexFromHash = useCallback(() => {
    if (typeof window === 'undefined') return 0
    const hash = window.location.hash.replace('#', '')
    if (!hash) return 0
    const byId = slides.findIndex((s) => s.id === hash)
    if (byId >= 0) return byId
    const num = parseInt(hash, 10)
    if (!Number.isNaN(num) && num >= 1 && num <= slides.length) return num - 1
    return 0
  }, [slides])

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next))
      setDirection(clamped >= indexRef.current ? 1 : -1)
      indexRef.current = clamped
      setIndex(clamped)
      window.history.replaceState(null, '', `#${slides[clamped].id}`)
      setOverviewOpen(false)
    },
    [slides]
  )

  useEffect(() => {
    const syncFromHash = () => {
      const next = slideIndexFromHash()
      setDirection(next >= indexRef.current ? 1 : -1)
      indexRef.current = next
      setIndex(next)
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [slideIndexFromHash])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        setOverviewOpen(false)
        return
      }
      if (overviewOpen) return
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault()
          goTo(indexRef.current + 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          goTo(indexRef.current - 1)
          break
        case 'Home':
          goTo(0)
          break
        case 'End':
          goTo(slides.length - 1)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, overviewOpen, slides.length])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 60) goTo(index + (delta < 0 ? 1 : -1))
    touchStartX.current = null
  }

  const slide = slides[index]
  const progress = ((index + 1) / slides.length) * 100

  return (
    <div className="bg-untamed-black text-untamed-white">
      <div className="deck-screen relative h-dvh w-full overflow-hidden print:hidden">
        <div className="absolute inset-x-0 top-0 z-40 h-0.5 bg-untamed-black-light">
          <div
            className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 opacity-80 transition-opacity hover:opacity-100">
            <Image src="/images/logo-mark.png" alt="Untamed Beverages" width={32} height={32} className="h-8 w-8" />
            <span className="hidden font-condensed text-xs font-bold uppercase tracking-[0.25em] text-untamed-white-muted sm:inline">
              {chromeLabel}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-card-border text-untamed-white-muted transition-colors duration-300 hover:border-untamed-silver hover:text-untamed-white sm:flex"
              aria-label="Print or save as PDF"
              title="Print / save as PDF"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOverviewOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border text-untamed-white-muted transition-colors duration-300 hover:border-untamed-silver hover:text-untamed-white"
              aria-label={overviewOpen ? 'Close overview' : 'Open overview'}
              title="All slides"
            >
              {overviewOpen ? <X className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="h-full w-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={slide.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full w-full overflow-y-auto"
            >
              {slide.render()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-4 pb-4 sm:px-6">
          <p className="font-condensed text-[11px] uppercase tracking-[0.25em] text-muted">{slide.section}</p>
          <div className="flex items-center gap-3">
            <span className="font-condensed text-xs tracking-widest text-untamed-white-muted">
              {index + 1} / {slides.length}
            </span>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border text-untamed-white transition-colors duration-300 enabled:hover:border-untamed-silver disabled:opacity-30"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === slides.length - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border text-untamed-white transition-colors duration-300 enabled:hover:border-untamed-silver disabled:opacity-30"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {overviewOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-50 overflow-y-auto bg-untamed-black/95 px-6 py-16 backdrop-blur-md sm:px-10 md:px-16"
            >
              <button
                type="button"
                onClick={() => setOverviewOpen(false)}
                className="fixed right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-card-border text-untamed-white-muted transition-colors duration-300 hover:border-untamed-silver hover:text-untamed-white sm:right-6"
                aria-label="Close overview"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto max-w-5xl">
                {sections.map((section) => (
                  <div key={section} className="mb-10">
                    <p className="font-condensed text-xs font-bold uppercase tracking-[0.35em] text-gradient-wild">
                      {section}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {slides.map((s, i) =>
                        s.section === section ? (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => goTo(i)}
                            className={`rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                              i === index
                                ? 'border-[#FFD700]/50 bg-[#FFD700]/5'
                                : 'border-card-border bg-untamed-black-card hover:border-untamed-silver/40'
                            }`}
                          >
                            <p className="font-condensed text-[11px] uppercase tracking-widest text-muted">
                              {String(i + 1).padStart(2, '0')}
                            </p>
                            <p className="mt-1 font-condensed text-base font-bold uppercase tracking-wide">
                              {s.title}
                            </p>
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="deck-print hidden print:block">
        {slides.map((s) => (
          <div key={s.id} className="deck-print-slide relative overflow-hidden bg-untamed-black">
            {s.render()}
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page {
            size: 11in 8.5in;
            margin: 0;
          }
          html, body {
            background: #0A0A0A !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .deck-print-slide {
            width: 100%;
            height: 100vh;
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  )
}
