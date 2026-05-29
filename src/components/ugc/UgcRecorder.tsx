'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  SwitchCamera,
  Trash2,
  Video,
} from 'lucide-react'
import {
  clearOldRecordings,
  deleteSavedRecording,
  generateRecordingId,
  getRecordingsForCategory,
  saveRecordingChunks,
} from '@/lib/storage/indexed-db-recording'

export type UgcRecorderMode = 'video' | 'photo'

interface UgcRecorderProps {
  /** 'video' uses MediaRecorder; 'photo' captures a single frame as JPEG. */
  mode: UgcRecorderMode
  /**
   * Called once the user finalizes a recording / capture. Returns a single
   * File ready to feed to the existing tiered upload helper.
   */
  onCaptured: (file: File) => void
  /**
   * Called when the user discards the recording or starts over. Optional.
   */
  onDiscard?: () => void
  /**
   * Logical category used for IndexedDB indexing -- pick one per flow
   * (e.g. 'ugc-video', 'ugc-photo'). Multiple component instances with
   * the same category + instanceId share recovery state.
   */
  category?: string
  /** Distinguishes multiple recorders on the same page. */
  instanceId?: string
  /** Max recording length in seconds. Defaults to 5 minutes. */
  maxDurationSeconds?: number
  className?: string
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * UgcRecorder
 *
 * Lightweight in-browser camera/mic capture for UGC submissions:
 *  - mode='video' records via MediaRecorder, auto-saves chunks to IndexedDB
 *    every 20s, and recovers in-progress recordings on remount
 *  - mode='photo' captures a single frame from the camera as JPEG
 *
 * It does NOT upload, transcribe, or know about S3 -- the parent page
 * receives a `File` via `onCaptured` and is responsible for uploading
 * via the existing tiered helper (`uploadUserFile`).
 */
export function UgcRecorder({
  mode,
  onCaptured,
  onDiscard,
  category = 'ugc',
  instanceId,
  maxDurationSeconds = 300,
  className = '',
}: UgcRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    'environment'
  )
  const [recoveryAvailable, setRecoveryAvailable] = useState<{
    id: string
    duration: number
    chunks: Blob[]
  } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hasCaptured, setHasCaptured] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const previousChunksRef = useRef<Blob[]>([])
  const previousDurationRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingIdRef = useRef<string>(
    generateRecordingId(instanceId ? `${category}-${instanceId}` : category)
  )
  const mimeTypeRef = useRef<string>('')
  const durationRef = useRef(0)

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (autosaveRef.current) clearInterval(autosaveRef.current)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [stream, previewUrl])

  // Look for recoverable in-progress recordings on mount
  useEffect(() => {
    let cancelled = false
    async function check() {
      if (mode !== 'video') return
      const cat = instanceId ? `${category}-${instanceId}` : category
      const recordings = await getRecordingsForCategory(category)
      const matching = recordings.filter(
        (r) =>
          (instanceId ? r.id.includes(cat) : true) &&
          r.chunks &&
          r.chunks.length > 0 &&
          !r.blob
      )
      if (!cancelled && matching.length > 0) {
        const latest = matching[0]
        setRecoveryAvailable({
          id: latest.id,
          duration: latest.duration,
          chunks: latest.chunks.filter((c) => c instanceof Blob),
        })
      }
      await clearOldRecordings(24)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [mode, category, instanceId])

  const acquireStream = useCallback(
    async (face: 'user' | 'environment') => {
      if (mode === 'video') {
        return navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: face,
          },
          audio: true,
        })
      }
      return navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: face,
        },
        audio: false,
      })
    },
    [mode]
  )

  const startPreview = useCallback(async () => {
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera access is not available in this browser. Try the latest Chrome, Safari, or Firefox.'
        )
      }
      const s = await acquireStream(facingMode)
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      const message = mapMediaError(err)
      setError(message)
    }
  }, [acquireStream, facingMode])

  const stopPreview = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [stream])

  const switchCamera = useCallback(async () => {
    if (isRecording) return
    const next = facingMode === 'user' ? 'environment' : 'user'
    try {
      const newStream = await acquireStream(next)
      stopPreview()
      setStream(newStream)
      setFacingMode(next)
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      setError(mapMediaError(err))
    }
  }, [acquireStream, facingMode, isRecording, stopPreview])

  const startRecording = useCallback(async () => {
    if (!stream) return
    setError(null)

    let chosenMime = ''
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      chosenMime = 'video/webm;codecs=vp9,opus'
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      chosenMime = 'video/webm'
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      chosenMime = 'video/mp4'
    }
    mimeTypeRef.current = chosenMime || 'video/webm'

    const recorder = new MediaRecorder(
      stream,
      chosenMime ? { mimeType: chosenMime } : undefined
    )
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data)
    }

    recorder.onstop = async () => {
      const allChunks = [...previousChunksRef.current, ...chunksRef.current]
      chunksRef.current = allChunks
      const blob = new Blob(allChunks, {
        type: mimeTypeRef.current || 'video/webm',
      })
      if (blob.size === 0) {
        setError('Recording was empty. Please try again.')
        return
      }
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setHasCaptured(true)

      await saveRecordingChunks(
        recordingIdRef.current,
        category,
        allChunks,
        durationRef.current,
        'video',
        blob
      )

      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File(
        [blob],
        `ugc-recording-${Date.now()}.${ext}`,
        {
          type: blob.type,
        }
      )
      onCaptured(file)
    }

    recorder.start(1000)
    setIsRecording(true)
    setIsPaused(false)
    setDuration(previousDurationRef.current)
    durationRef.current = previousDurationRef.current

    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1
        if (next >= maxDurationSeconds) {
          stopRecording()
        }
        durationRef.current = next
        return next
      })
    }, 1000)

    autosaveRef.current = setInterval(() => {
      if (!isRecording && chunksRef.current.length === 0) return
      saveRecordingChunks(
        recordingIdRef.current,
        category,
        [...previousChunksRef.current, ...chunksRef.current],
        durationRef.current,
        'video'
      )
    }, 20000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, category, maxDurationSeconds, onCaptured])

  const stopRecording = useCallback(() => {
    const r = mediaRecorderRef.current
    if (r && r.state !== 'inactive') {
      r.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    if (autosaveRef.current) clearInterval(autosaveRef.current)
    setIsRecording(false)
    setIsPaused(false)
  }, [])

  const pauseRecording = useCallback(() => {
    const r = mediaRecorderRef.current
    if (r && r.state === 'recording') {
      r.pause()
      setIsPaused(true)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    const r = mediaRecorderRef.current
    if (r && r.state === 'paused') {
      r.resume()
      setIsPaused(false)
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1
          if (next >= maxDurationSeconds) stopRecording()
          durationRef.current = next
          return next
        })
      }, 1000)
    }
  }, [maxDurationSeconds, stopRecording])

  const capturePhoto = useCallback(async () => {
    if (!stream || !videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    )
    if (!blob) {
      setError('Could not capture photo. Try again.')
      return
    }
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    setHasCaptured(true)
    const file = new File([blob], `ugc-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })
    onCaptured(file)
  }, [stream, onCaptured])

  const restoreRecording = useCallback(async () => {
    if (!recoveryAvailable) return
    previousChunksRef.current = recoveryAvailable.chunks
    previousDurationRef.current = recoveryAvailable.duration
    recordingIdRef.current = recoveryAvailable.id
    setDuration(recoveryAvailable.duration)
    durationRef.current = recoveryAvailable.duration
    setRecoveryAvailable(null)
    if (!stream) await startPreview()
  }, [recoveryAvailable, stream, startPreview])

  const discardRecovery = useCallback(async () => {
    if (recoveryAvailable) {
      await deleteSavedRecording(recoveryAvailable.id)
    }
    setRecoveryAvailable(null)
  }, [recoveryAvailable])

  const reset = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autosaveRef.current) clearInterval(autosaveRef.current)
    await deleteSavedRecording(recordingIdRef.current)
    chunksRef.current = []
    previousChunksRef.current = []
    previousDurationRef.current = 0
    setIsRecording(false)
    setIsPaused(false)
    setDuration(0)
    durationRef.current = 0
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setHasCaptured(false)
    recordingIdRef.current = generateRecordingId(
      instanceId ? `${category}-${instanceId}` : category
    )
    onDiscard?.()
  }, [category, instanceId, onDiscard, previewUrl])

  if (hasCaptured && previewUrl) {
    return (
      <div className={`space-y-3 ${className}`}>
        {mode === 'video' ? (
          <video
            src={previewUrl}
            controls
            className="w-full rounded-xl bg-black"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Captured"
            className="w-full rounded-xl bg-black"
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-sm text-white hover:border-[#9B30FF] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Record again
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {recoveryAvailable && !stream && (
        <div className="bg-[#9B30FF]/10 border border-[#9B30FF]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm text-white">
            Found an in-progress recording ({formatDuration(recoveryAvailable.duration)}). Continue or discard.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={restoreRecording}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#9B30FF] text-white text-sm hover:bg-[#7E22CE] transition-colors"
            >
              <Play className="w-4 h-4" />
              Continue
            </button>
            <button
              type="button"
              onClick={discardRecovery}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm hover:border-[#9B30FF] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Discard
            </button>
          </div>
        </div>
      )}

      <div
        className="relative rounded-xl overflow-hidden bg-black border border-[#2A2A2A]"
        style={{ aspectRatio: '16 / 9' }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />

        {isRecording && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>{formatDuration(duration)}</span>
          </div>
        )}

        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]">
            <button
              type="button"
              onClick={startPreview}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#39FF14] text-black font-semibold text-sm hover:bg-[#39FF14]/80 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Open camera
            </button>
          </div>
        )}

        {stream && !isRecording && (
          <button
            type="button"
            onClick={switchCamera}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
            title="Switch camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {stream && (
        <div className="flex flex-wrap gap-2">
          {mode === 'video' ? (
            <>
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500 text-white font-semibold text-sm hover:bg-red-400 transition-colors"
                >
                  <Video className="w-4 h-4" />
                  Start recording
                </button>
              ) : (
                <>
                  {!isPaused ? (
                    <button
                      type="button"
                      onClick={pauseRecording}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm hover:border-[#9B30FF] transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={resumeRecording}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm hover:border-[#9B30FF] transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Resume
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500 text-white text-sm hover:bg-red-400 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={capturePhoto}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#39FF14] text-black font-semibold text-sm hover:bg-[#39FF14]/80 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Take photo
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stopPreview()
              setError(null)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm hover:border-red-500 transition-colors"
          >
            <Mic className="w-4 h-4" />
            Close camera
          </button>
        </div>
      )}
    </div>
  )
}

function mapMediaError(err: unknown): string {
  if (!(err instanceof Error)) return 'Failed to access camera/microphone.'
  switch (err.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Permission denied. Please allow camera/microphone access in your browser settings.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone found on this device.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera or microphone is in use by another app.'
    case 'OverconstrainedError':
      return 'Your camera does not support the requested settings.'
    default:
      return err.message || 'Failed to access camera/microphone.'
  }
}
