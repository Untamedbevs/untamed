'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, ArrowRight } from 'lucide-react'

interface ContactModalProps {
  open: boolean
  onClose: () => void
}

export function ContactModal({ open, onClose }: ContactModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[101] flex items-center justify-center px-4"
          >
            <div
              className="relative w-full max-w-md rounded-2xl border border-card-border bg-untamed-black-card p-8 md:p-10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-untamed-white-muted hover:text-untamed-white transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                  <Mail className="w-7 h-7 text-untamed-black" />
                </div>
              </div>

              {/* Heading */}
              <h2 className="font-condensed text-2xl md:text-3xl font-bold uppercase tracking-wider text-untamed-white text-center mb-3">
                Get In Touch
              </h2>

              <p className="text-untamed-white-muted text-center text-sm md:text-base leading-relaxed mb-8">
                For media inquiries, partnerships, distribution, or just to say hello — drop us a line.
              </p>

              {/* Email CTA */}
              <a
                href="mailto:media@untamedbeverages.com"
                className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-untamed-white text-untamed-black font-semibold text-base rounded-full
                  hover:bg-gradient-to-r hover:from-[#FFD700] hover:to-[#FFA500] transition-all duration-300
                  hover:shadow-[0_0_30px_rgba(255,165,0,0.3)] active:scale-[0.98]"
              >
                <Mail className="w-5 h-5" />
                media@untamedbeverages.com
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </a>

              {/* Subtle footer */}
              <p className="text-untamed-white-muted/50 text-xs text-center mt-6">
                We typically respond within 24 hours.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
