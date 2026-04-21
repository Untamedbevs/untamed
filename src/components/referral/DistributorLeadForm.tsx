'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Building2, User, Mail, Phone, MapPin,
  MessageSquare, Loader2, CheckCircle, Send,
} from 'lucide-react'
import {
  BUSINESS_TYPE_LABELS,
  VOLUME_INTEREST_LABELS,
} from '@/lib/referral/constants'
import type { DistributorBusinessType, VolumeInterest } from '@/lib/referral/types'

interface DistributorLeadFormProps {
  referrerName?: string | null
}

export function DistributorLeadForm({ referrerName }: DistributorLeadFormProps) {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')

  const [businessName, setBusinessName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [businessType, setBusinessType] = useState<DistributorBusinessType>('bar_restaurant')
  const [volumeInterest, setVolumeInterest] = useState<VolumeInterest | ''>('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/distributor/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          contactName,
          email,
          phone: phone || undefined,
          location: location || undefined,
          businessType,
          volumeInterest: volumeInterest || undefined,
          message: message || undefined,
          ref: ref || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border-2 border-green-500/30 bg-green-500/5 p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">Inquiry Received</h3>
        <p className="text-muted-foreground">
          Thanks for your interest in distributing Untamed Beverages.
          Our team will be in touch within 48 hours.
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors'
  const selectClass =
    'w-full px-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white focus:outline-none transition-colors appearance-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {referrerName && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/30 text-sm mb-4 w-fit">
          <User className="w-4 h-4 text-orange-400" />
          <span className="text-orange-300">Referred by {referrerName}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="relative">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
          <input
            type="text"
            placeholder="Business name *"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
          <input
            type="text"
            placeholder="Your name *"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
          <input
            type="email"
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
        <input
          type="text"
          placeholder="City, State / Region"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">Business Type *</label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value as DistributorBusinessType)}
            className={selectClass}
          >
            {Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">Volume Interest</label>
          <select
            value={volumeInterest}
            onChange={(e) => setVolumeInterest(e.target.value as VolumeInterest)}
            className={selectClass}
          >
            <option value="">Select...</option>
            {Object.entries(VOLUME_INTEREST_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-orange-400" />
        <textarea
          placeholder="Tell us about your business and interest..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !businessName || !contactName || !email}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: '#FF8C2A',
          boxShadow: '0 0 20px rgba(255, 140, 42, 0.3)',
        }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" />
            Submit Inquiry
          </>
        )}
      </button>
    </form>
  )
}
