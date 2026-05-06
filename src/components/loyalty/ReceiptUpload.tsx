'use client'

import { useState, useRef } from 'react'
import { Upload, Camera, Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react'
import type { Drink } from '@/lib/drinks'
import { drinks } from '@/lib/drinks'

interface ReceiptUploadProps {
  drink: Drink
  memberId: string
  onUploaded: () => void
  accentColor?: string
  accentGlow?: string
}

export function ReceiptUpload({ drink, memberId, onUploaded, accentColor, accentGlow }: ReceiptUploadProps) {
  const color = accentColor || drink.color
  const glow = accentGlow || drink.colorGlow
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [drinkSlug, setDrinkSlug] = useState(drink.slug || drinks[0].slug)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB')
      return
    }

    setFile(selected)
    setError('')
    setPreview(URL.createObjectURL(selected))
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/loyalty/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          filename: file.name,
          contentType: file.type,
          drinkSlug,
        }),
      })

      if (!res.ok) throw new Error('Failed to get upload URL')

      const { presignedUrl } = await res.json()

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) throw new Error('Failed to upload image')

      setSuccess(true)
      setFile(null)
      setPreview(null)
      onUploaded()

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3
        className="font-condensed text-2xl font-bold uppercase tracking-wider"
        style={{ color }}
      >
        Upload Receipt
      </h3>
      <p className="text-untamed-white-muted text-sm">
        Snap a photo of your purchase receipt to earn 25 points. We&apos;ll review and credit your account.
      </p>

      <div className="flex gap-3">
        <select
          value={drinkSlug}
          onChange={(e) => setDrinkSlug(e.target.value)}
          className="flex-1 px-4 py-3 bg-untamed-black-light border border-card-border rounded-xl text-white text-sm focus:outline-none"
        >
          {drinks.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name} {d.flavor}
            </option>
          ))}
        </select>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-card-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt preview" className="w-full max-h-64 object-contain bg-untamed-black-light" />
          <button
            onClick={() => {
              setFile(null)
              setPreview(null)
            }}
            className="absolute top-2 right-2 px-3 py-1 bg-black/70 rounded-lg text-xs text-white hover:bg-black"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-card-border rounded-xl hover:border-current transition-colors text-muted"
        >
          <div className="flex items-center gap-4">
            <Camera className="w-8 h-8" />
            <ImageIcon className="w-8 h-8" />
          </div>
          <span className="text-sm">Tap to take a photo or choose an image</span>
        </button>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          Receipt submitted! We&apos;ll review it shortly.
        </div>
      )}

      {file && !success && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
          style={{ backgroundColor: color, boxShadow: `0 0 20px ${glow}` }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Submit Receipt
            </>
          )}
        </button>
      )}
    </div>
  )
}
