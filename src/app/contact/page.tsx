'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Mail, User, MessageSquare, Send,
  Loader2, CheckCircle, Building2, Headphones,
  Newspaper, Package, MessageCircle, ThumbsUp,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

const SUBJECTS = [
  { value: 'general', label: 'General Inquiry', icon: MessageCircle },
  { value: 'partnership', label: 'Partnership', icon: Building2 },
  { value: 'media', label: 'Media / Press', icon: Newspaper },
  { value: 'distribution', label: 'Distribution', icon: Package },
  { value: 'support', label: 'Support', icon: Headphones },
  { value: 'feedback', label: 'Feedback', icon: ThumbsUp },
] as const

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState<string>('general')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          website: honeypot,
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

  return (
    <div className="flex flex-col min-h-screen bg-untamed-black">
      <Navigation />

      <div className="flex-1 py-12 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                <Mail className="w-7 h-7 text-untamed-black" />
              </div>
            </div>
            <h1 className="font-condensed text-4xl sm:text-5xl font-bold text-white uppercase mb-3">
              Get In Touch
            </h1>
            <p className="text-untamed-white-muted text-base md:text-lg max-w-lg mx-auto">
              Questions, partnerships, press inquiries, or just want to say hello — we&apos;d love to hear from you.
            </p>
          </motion.div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center p-10 rounded-2xl border border-card-border bg-untamed-black-card"
            >
              <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-5" />
              <h2 className="text-2xl font-bold text-white mb-3">Message Sent</h2>
              <p className="text-untamed-white-muted mb-8 max-w-sm mx-auto">
                Thanks for reaching out. Our team will get back to you within 24–48 hours.
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-card-border text-white font-medium transition-all hover:bg-untamed-black-light"
              >
                Back to Home
              </a>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              onSubmit={handleSubmit}
              className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-10 space-y-5"
            >
              {/* Subject pills */}
              <div>
                <label className="block text-sm text-untamed-white-muted mb-2.5 font-medium">
                  What&apos;s this about?
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSubject(value)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                        subject === value
                          ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                          : 'border-card-border text-untamed-white-muted hover:border-untamed-white/30 hover:text-untamed-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name + Email */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFD700]" />
                  <input
                    type="text"
                    placeholder="Your name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-untamed-white-muted/50 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFD700]" />
                  <input
                    type="email"
                    placeholder="Email *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-untamed-white-muted/50 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Honeypot — hidden from humans, bots fill it */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="relative">
                <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-[#FFD700]" />
                <textarea
                  placeholder="Your message *"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  maxLength={5000}
                  className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-untamed-white-muted/50 focus:outline-none focus:border-[#FFD700]/50 transition-colors resize-none"
                />
                <span className="absolute bottom-3 right-4 text-xs text-untamed-white-muted/40">
                  {message.length}/5000
                </span>
              </div>

              {error && (
                <p className="text-red-400 text-sm px-1">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !name || !email || message.length < 10}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-untamed-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#FFD700] to-[#FFA500]"
                style={{ boxShadow: '0 0 20px rgba(255, 215, 0, 0.2)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Message
                  </>
                )}
              </button>

              <p className="text-untamed-white-muted/50 text-xs text-center">
                We typically respond within 24–48 hours.
              </p>
            </motion.form>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
