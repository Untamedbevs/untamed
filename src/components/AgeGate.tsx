'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

export function AgeGate() {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('untamed-age-verified')
    if (stored === 'true') {
      setVerified(true)
    } else {
      setVerified(false)
    }
  }, [])

  const handleYes = () => {
    localStorage.setItem('untamed-age-verified', 'true')
    setVerified(true)
  }

  const handleNo = () => {
    setDeclined(true)
  }

  // Still loading from localStorage
  if (verified === null) {
    return (
      <div className="fixed inset-0 z-[9999] bg-untamed-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-untamed-white-muted border-t-untamed-white rounded-full animate-spin" />
      </div>
    )
  }

  // Already verified
  if (verified) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-untamed-black flex items-center justify-center overflow-hidden"
      >
        {/* Decorative claw scratch background */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: 'url(/images/scratch-panther.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </div>

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-[120px] opacity-20 bg-panther" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-[120px] opacity-20 bg-lioness" />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative z-10 text-center px-6 max-w-md"
        >
          {/* Brand Logo */}
          <div className="flex flex-col items-center mb-12">
            <Image
              src="/images/logo-mark.png"
              alt="Untamed Beverages"
              width={120}
              height={120}
              className="w-24 h-24 md:w-32 md:h-32 mb-4"
              priority
            />
            <Image
              src="/images/logo-text.png"
              alt="Untamed Beverages"
              width={280}
              height={56}
              className="h-8 md:h-12 w-auto"
              priority
            />
          </div>

          {!declined ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-untamed-white text-xl md:text-2xl font-light mb-2">
                Are you 21 or older?
              </p>
              <p className="text-untamed-white-muted text-sm mb-8">
                You must be of legal drinking age to enter this site.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleYes}
                  className="px-10 py-3 bg-untamed-white text-untamed-black font-semibold text-lg rounded-full
                    hover:bg-panther-light hover:text-white transition-all duration-300
                    hover:shadow-[0_0_30px_rgba(155,48,255,0.4)] active:scale-95"
                >
                  Yes, I&apos;m 21+
                </button>
                <button
                  onClick={handleNo}
                  className="px-10 py-3 border border-untamed-white-muted/30 text-untamed-white-muted font-medium text-lg rounded-full
                    hover:border-untamed-white-muted hover:text-untamed-white transition-all duration-300
                    active:scale-95"
                >
                  No
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <p className="text-untamed-white text-xl mb-4">
                We&apos;re sorry, you must be 21 or older to visit this site.
              </p>
              <p className="text-untamed-white-muted text-sm mb-8">
                Please drink responsibly.
              </p>
              <a
                href="https://www.responsibility.org"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 border border-untamed-white-muted/30 text-untamed-white-muted font-medium rounded-full
                  hover:border-untamed-white hover:text-untamed-white transition-all duration-300 inline-block"
              >
                Learn About Responsible Drinking
              </a>
            </motion.div>
          )}

          <p className="text-untamed-white-muted/40 text-xs mt-12">
            Always drink responsibly. Untamed Beverages, LLC &bull; Parrish, FL
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
