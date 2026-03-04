'use client'

import { useState } from 'react'
import { Mail, User, Loader2, ArrowRight } from 'lucide-react'
import type { Drink } from '@/lib/drinks'

interface JoinFormProps {
  drink: Drink
  visitorId: string
  onJoined: (member: Record<string, unknown>) => void
}

export function JoinForm({ drink, visitorId, onJoined }: JoinFormProps) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/loyalty/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          email,
          firstName,
          drinkSlug: drink.slug,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to join')
      }

      const data = await res.json()
      localStorage.setItem('ut_loyalty_email', email.toLowerCase().trim())
      onJoined(data.member)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div className="relative">
        <User
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: drink.color }}
        />
        <input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-white placeholder:text-[#666] focus:outline-none focus:border-current transition-colors"
          style={{ '--tw-ring-color': drink.color } as React.CSSProperties}
        />
      </div>

      <div className="relative">
        <Mail
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: drink.color }}
        />
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full pl-12 pr-4 py-3.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-white placeholder:text-[#666] focus:outline-none focus:border-current transition-colors"
          style={{ '--tw-ring-color': drink.color } as React.CSSProperties}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: drink.color,
          boxShadow: `0 0 20px ${drink.colorGlow}`,
        }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Join the Pack
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </form>
  )
}
