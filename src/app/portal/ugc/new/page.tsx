'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  Camera,
  CheckCircle,
  ImageIcon,
  Loader2,
  Upload as UploadIcon,
  Video,
  X,
} from 'lucide-react'
import { drinks } from '@/lib/drinks'
import {
  getUploadErrorMessage,
  uploadUserFile,
  type UserUploadResult,
} from '@/lib/storage/user-uploads'
import type { UgcAssetType } from '@/lib/ugc/types'
import { UgcRecorder } from '@/components/ugc/UgcRecorder'

interface QueueItem {
  id: string
  file: File
  previewUrl: string
  assetType: UgcAssetType
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  result?: UserUploadResult
}

const MAX_FILES = 10
// Bumped to 1.5GB to accommodate iPhone 4K videos. Multipart upload kicks in
// automatically above 100MB so large files still ship reliably.
const MAX_FILE_SIZE_MB = 1500

export default function NewUgcSubmissionPage() {
  const router = useRouter()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [caption, setCaption] = useState('')
  const [drinkSlug, setDrinkSlug] = useState('')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [consentGranted, setConsentGranted] = useState(false)
  const [consentSignature, setConsentSignature] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [inputMode, setInputMode] = useState<'upload' | 'record-video' | 'capture-photo'>('upload')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      queue.forEach((q) => URL.revokeObjectURL(q.previewUrl))
    }
  }, [queue])

  function addFiles(filesList: FileList | File[]) {
    const files = Array.from(filesList)
    const remaining = MAX_FILES - queue.length
    const accepted = files.slice(0, remaining)

    // Categorize so we can give users a clear "why your file got skipped"
    // message instead of silently dropping it.
    const sizeMb = (b: number) => Math.round(b / (1024 * 1024))
    const tooBig: string[] = []
    const wrongType: string[] = []
    const newItems: QueueItem[] = []

    for (const f of accepted) {
      const isImage = f.type.startsWith('image/')
      const isVideo = f.type.startsWith('video/')
      if (!isImage && !isVideo) {
        wrongType.push(f.name)
        continue
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        tooBig.push(`${f.name} (${sizeMb(f.size)}MB)`)
        continue
      }
      newItems.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        assetType: isVideo ? 'video' : 'image',
        status: 'pending',
        progress: 0,
      })
    }

    const messages: string[] = []
    if (tooBig.length) {
      messages.push(
        `Too large (limit ${MAX_FILE_SIZE_MB}MB): ${tooBig.join(', ')}`
      )
    }
    if (wrongType.length) {
      messages.push(
        `Wrong type (only photos/videos): ${wrongType.join(', ')}`
      )
    }
    if (files.length > remaining) {
      messages.push(
        `Only ${MAX_FILES} files per submission \u2014 some files were not added.`
      )
    }

    setError(messages.join(' \u2014 '))

    setQueue((prev) => [...prev, ...newItems])
  }

  function removeItem(id: string) {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((q) => q.id !== id)
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  async function uploadAll(): Promise<QueueItem[]> {
    const updated: QueueItem[] = []
    for (const item of queue) {
      if (item.status === 'success' && item.result) {
        updated.push(item)
        continue
      }
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: 'uploading', progress: 0, error: undefined } : q
        )
      )
      try {
        const result = await uploadUserFile('ugc', item.file, (progress) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress } : q))
          )
        })
        const success: QueueItem = {
          ...item,
          status: 'success',
          progress: 100,
          result,
        }
        updated.push(success)
        setQueue((prev) => prev.map((q) => (q.id === item.id ? success : q)))
      } catch (err) {
        const message = getUploadErrorMessage(err)
        const failed: QueueItem = {
          ...item,
          status: 'error',
          error: message,
        }
        updated.push(failed)
        setQueue((prev) => prev.map((q) => (q.id === item.id ? failed : q)))
        throw new Error(message)
      }
    }
    return updated
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (queue.length === 0) {
      setError('Add at least one photo or video.')
      return
    }
    if (!consentGranted) {
      setError('You must agree to the usage rights to submit.')
      return
    }
    if (!consentSignature.trim()) {
      setError('Please type your name as your signature.')
      return
    }

    setSubmitting(true)

    let uploaded: QueueItem[]
    try {
      uploaded = await uploadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setSubmitting(false)
      return
    }

    const successful = uploaded.filter((u) => u.status === 'success' && u.result)
    if (successful.length === 0) {
      setError('No files uploaded successfully. Please retry.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/portal/ugc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: caption.trim() || undefined,
          drinkSlug: drinkSlug || undefined,
          location: location.trim() || undefined,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          isPublic,
          consentGranted: true,
          consentSignature: consentSignature.trim(),
          assets: successful.map((u, i) => ({
            s3Key: u.result!.s3Key,
            url: u.result!.url,
            assetType: u.assetType,
            mimeType: u.file.type || 'application/octet-stream',
            width: u.result!.width,
            height: u.result!.height,
            durationSeconds: u.result!.durationSeconds,
            fileSizeBytes: u.result!.fileSize,
            displayOrder: i,
          })),
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Submission failed')
      }

      router.push('/portal/ugc?submitted=1')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  const allUploaded =
    queue.length > 0 && queue.every((q) => q.status === 'success')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl text-white">Share a moment</h1>
          <p className="text-sm text-[#A0A0A0]">
            The best submissions get featured on the site for the whole pack
            to see.
          </p>
        </div>
        <Link href="/portal/ugc" className="text-sm text-[#A0A0A0] hover:text-white">
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
              inputMode === 'upload'
                ? 'bg-[#9B30FF] text-white'
                : 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#9B30FF]'
            }`}
          >
            <UploadIcon className="w-4 h-4" />
            Upload files
          </button>
          <button
            type="button"
            onClick={() => setInputMode('record-video')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
              inputMode === 'record-video'
                ? 'bg-[#9B30FF] text-white'
                : 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#9B30FF]'
            }`}
          >
            <Video className="w-4 h-4" />
            Record video
          </button>
          <button
            type="button"
            onClick={() => setInputMode('capture-photo')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
              inputMode === 'capture-photo'
                ? 'bg-[#9B30FF] text-white'
                : 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#9B30FF]'
            }`}
          >
            <Camera className="w-4 h-4" />
            Take photo
          </button>
        </div>

        {inputMode === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          className={`bg-[#141414] border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
            dragOver
              ? 'border-[#9B30FF] bg-[#9B30FF]/5'
              : 'border-[#2A2A2A] hover:border-[#9B30FF]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
          <UploadIcon className="w-10 h-10 text-[#9B30FF] mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Drag & drop or click to add</p>
          <p className="text-xs text-[#A0A0A0] mb-1">
            Photos and videos · up to {(MAX_FILE_SIZE_MB / 1000).toFixed(1)}GB each · {MAX_FILES} max
          </p>
          <p className="text-[10px] text-[#666] mb-4 max-w-md mx-auto">
            iPhone tip: if your photos upload as HEIC and won&apos;t preview, set
            Settings &rarr; Camera &rarr; Formats to <em>Most Compatible</em>.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-colors"
          >
            <UploadIcon className="w-4 h-4" />
            Choose files
          </button>
        </div>
        )}

        {inputMode === 'record-video' && (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">
            <UgcRecorder
              mode="video"
              category="ugc-video"
              onCaptured={(file) => {
                addFiles([file])
                setInputMode('upload')
              }}
            />
            <p className="text-xs text-[#A0A0A0] mt-3">
              Tip: your recording is auto-saved to this device every 20s, so you
              can come back if you lose connection.
            </p>
          </div>
        )}

        {inputMode === 'capture-photo' && (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">
            <UgcRecorder
              mode="photo"
              category="ugc-photo"
              onCaptured={(file) => {
                addFiles([file])
                setInputMode('upload')
              }}
            />
          </div>
        )}

        {queue.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className="relative group bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden aspect-square"
              >
                {item.assetType === 'video' ? (
                  <video
                    src={item.previewUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                )}

                <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                  {item.assetType === 'video' ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <ImageIcon className="w-3 h-3" />
                  )}
                  {Math.round(item.file.size / 1024 / 1024)}MB
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={item.status === 'uploading'}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>

                {item.status === 'uploading' && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5">
                    <div className="flex items-center gap-2 text-xs text-white">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {item.progress}%
                    </div>
                    <div className="h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-[#9B30FF] transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {item.status === 'success' && (
                  <div className="absolute top-1.5 right-9 w-6 h-6 rounded-full bg-[#39FF14] flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-black" />
                  </div>
                )}

                {item.status === 'error' && (
                  <div className="absolute inset-x-0 bottom-0 bg-red-500/90 px-2 py-1 text-[10px] text-white truncate">
                    {item.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 space-y-4">
          <div>
            <label
              htmlFor="caption"
              className="block text-sm font-medium text-[#A0A0A0] mb-2"
            >
              Caption <span className="text-[#666] font-normal">(optional)</span>
            </label>
            <textarea
              id="caption"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none"
              placeholder="Tell us about this moment..."
            />
            <div className="text-right text-xs text-[#666] mt-1">
              {caption.length}/500
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="drink"
                className="block text-sm font-medium text-[#A0A0A0] mb-2"
              >
                Drink featured
              </label>
              <select
                id="drink"
                value={drinkSlug}
                onChange={(e) => setDrinkSlug(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#9B30FF] transition-colors"
              >
                <option value="">Choose a flavor (optional)</option>
                {drinks.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name} — {d.flavor}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-[#A0A0A0] mb-2"
              >
                Location <span className="text-[#666] font-normal">(optional)</span>
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={120}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
                placeholder="e.g. Austin, TX"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="tags"
              className="block text-sm font-medium text-[#A0A0A0] mb-2"
            >
              Tags <span className="text-[#666] font-normal">(comma separated)</span>
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
              placeholder="rooftop, summer, friends"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex items-center w-11 h-6 p-0.5 rounded-full transition-colors shrink-0 ${
                isPublic ? 'bg-[#9B30FF]' : 'bg-[#2A2A2A]'
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  isPublic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <label
              onClick={() => setIsPublic(!isPublic)}
              className="text-sm text-white cursor-pointer"
            >
              Show on the public Untamed gallery if approved
            </label>
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white">Usage Rights</h3>
          <p className="text-xs text-[#A0A0A0] leading-relaxed">
            By submitting, you confirm that you own this content and grant
            Untamed Beverages a worldwide, royalty-free, perpetual license to
            use, reproduce, modify, and display it for marketing, advertising,
            social media, and packaging. You also confirm that everyone visible
            in this content has consented to be photographed/recorded and is of
            legal drinking age.
          </p>

          <div className="flex items-start gap-3">
            <input
              id="consent"
              type="checkbox"
              checked={consentGranted}
              onChange={(e) => setConsentGranted(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[#2A2A2A] bg-[#0A0A0A] text-[#9B30FF] focus:ring-[#9B30FF]"
            />
            <label htmlFor="consent" className="text-sm text-white">
              I agree and grant Untamed the rights described above.
            </label>
          </div>

          <div>
            <label
              htmlFor="signature"
              className="block text-sm font-medium text-[#A0A0A0] mb-2"
            >
              Type your full name as signature
            </label>
            <input
              id="signature"
              type="text"
              value={consentSignature}
              onChange={(e) => setConsentSignature(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#666] font-mono italic focus:outline-none focus:border-[#9B30FF] transition-colors"
              placeholder="Jane Doe"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/portal/ugc"
            className="text-sm text-[#A0A0A0] hover:text-white px-4 py-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={
              submitting ||
              queue.length === 0 ||
              !consentGranted ||
              !consentSignature.trim()
            }
            className="bg-[#9B30FF] text-white font-semibold rounded-full px-6 py-3 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UploadIcon className="w-4 h-4" />
            )}
            {submitting
              ? allUploaded
                ? 'Saving...'
                : 'Uploading...'
              : 'Submit for review'}
          </button>
        </div>
      </form>
    </div>
  )
}
