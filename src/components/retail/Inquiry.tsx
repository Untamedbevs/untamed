'use client'

import { Suspense, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, X } from 'lucide-react'
import { DistributorLeadForm } from '@/components/referral/DistributorLeadForm'
import { ORANGE } from '@/lib/retail/sell'
import type { DistributorBusinessType } from '@/lib/referral/types'

export function InquiryModal({
  open,
  onClose,
  referrerName,
  defaultBusinessType,
  title = 'Start the Conversation',
}: {
  open: boolean
  onClose: () => void
  referrerName?: string | null
  defaultBusinessType?: DistributorBusinessType
  title?: string
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 bg-untamed-black-card"
            style={{ borderColor: '#FF8C2A33' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-8 pt-6 pb-4 bg-untamed-black-card border-b border-card-border">
              <div>
                <h2 className="font-condensed text-2xl font-bold text-white uppercase">{title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Tell us about your business and we will reach out within 48 hours.
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-untamed-black-light transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-8 py-6">
              <Suspense fallback={null}>
                <DistributorLeadForm
                  referrerName={referrerName}
                  defaultBusinessType={defaultBusinessType}
                  onSuccess={onClose}
                />
              </Suspense>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function InquiryCTA({
  label = 'Get Started',
  onClick,
}: {
  label?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3.5 rounded-full font-bold text-black uppercase tracking-wider text-sm sm:text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: ORANGE,
        boxShadow: '0 0 20px rgba(255, 140, 42, 0.3)',
      }}
    >
      <Send className="w-5 h-5 shrink-0" />
      {label}
    </button>
  )
}
