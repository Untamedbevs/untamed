/**
 * Client-side tiered upload helper for end-user file uploads.
 *
 * Routes files to the right backend based on size:
 *  - <500KB     → POST /api/portal/upload (FormData; goes through Vercel)
 *  - 500KB-100MB → presigned PUT directly to S3 via /api/portal/upload/presigned
 *  - >100MB     → multipart upload via /api/portal/upload/multipart
 *
 * Ported from VibrationFit's `s3-storage-presigned.ts`, slimmed down for the
 * Untamed UGC use case (photo/video submissions from loyalty + distributors).
 */

export const UGC_FOLDERS = {
  ugc: 'ugc/uploads',
  ugcRecordings: 'ugc/recordings',
} as const

export type UgcFolder = keyof typeof UGC_FOLDERS

const PRESIGNED_THRESHOLD = 500 * 1024 // 500KB
const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100MB
const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000

export interface UserUploadResult {
  s3Key: string
  url: string
  fileName: string
  contentType: string
  fileSize: number
  width?: number
  height?: number
  durationSeconds?: number
}

export type UploadProgressCb = (progress: number) => void

// ---------------------------------------------------------------------------
// Friendly error messages
// ---------------------------------------------------------------------------
export function getUploadErrorMessage(error: unknown): string {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'Upload timed out. Please check your connection and try again.'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Network error. Please check your connection and try again.'
  }
  if (msg.includes('cors') || msg.includes('405')) {
    return 'Upload blocked by server configuration. Please contact support.'
  }
  if (msg.includes('too large') || msg.includes('413')) {
    return 'File is too large. Please try a smaller file.'
  }
  if (msg.includes('unauthorized') || msg.includes('401')) {
    return 'Your session expired. Please sign in again.'
  }
  return 'Upload failed. Please try again.'
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error = new Error('Unknown error')
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const m = lastError.message.toLowerCase()
      const retryable =
        m.includes('network') ||
        m.includes('timeout') ||
        m.includes('failed to fetch') ||
        m.includes('500') ||
        m.includes('502') ||
        m.includes('503') ||
        m.includes('504')
      if (attempt === MAX_RETRIES || !retryable) throw lastError
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// XHR upload with progress
// ---------------------------------------------------------------------------
function xhrPut(
  url: string,
  body: Blob | File,
  contentType: string,
  onProgress?: UploadProgressCb
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 600_000
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(body)
  })
}

// ---------------------------------------------------------------------------
// Helpers for image/video metadata
// ---------------------------------------------------------------------------
async function readImageDimensions(
  file: File
): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/')) return {}
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dims)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({})
    }
    img.src = url
  })
}

async function readVideoMetadata(
  file: File
): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  if (!file.type.startsWith('video/')) return {}
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const meta = {
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: video.duration,
      }
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({})
    }
    video.src = url
  })
}

// ---------------------------------------------------------------------------
// Tier 1: API route for tiny files (<500KB)
// ---------------------------------------------------------------------------
async function uploadViaApiRoute(
  folder: UgcFolder,
  file: File,
  onProgress?: UploadProgressCb
): Promise<UserUploadResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', UGC_FOLDERS[folder])

  return withRetry(async () => {
    const res = await fetch('/api/portal/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Upload failed (${res.status})`)
    }
    const data = await res.json()
    onProgress?.(100)
    const meta = file.type.startsWith('video/')
      ? await readVideoMetadata(file)
      : await readImageDimensions(file)
    return {
      s3Key: data.s3Key,
      url: data.url,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      fileSize: file.size,
      ...meta,
    }
  })
}

// ---------------------------------------------------------------------------
// Tier 2: Presigned PUT (500KB-100MB)
// ---------------------------------------------------------------------------
async function uploadViaPresignedUrl(
  folder: UgcFolder,
  file: File,
  onProgress?: UploadProgressCb
): Promise<UserUploadResult> {
  const presignRes = await fetch('/api/portal/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      folder: UGC_FOLDERS[folder],
    }),
  })
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to get upload URL')
  }
  const { presignedUrl, s3Key, publicUrl } = await presignRes.json()

  await withRetry(() =>
    xhrPut(presignedUrl, file, file.type || 'application/octet-stream', onProgress)
  )

  const meta = file.type.startsWith('video/')
    ? await readVideoMetadata(file)
    : await readImageDimensions(file)

  return {
    s3Key,
    url: publicUrl,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
    ...meta,
  }
}

// ---------------------------------------------------------------------------
// Tier 3: Multipart upload (>100MB)
// ---------------------------------------------------------------------------
async function uploadViaMultipart(
  folder: UgcFolder,
  file: File,
  onProgress?: UploadProgressCb
): Promise<UserUploadResult> {
  const initRes = await fetch('/api/portal/upload/multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'init',
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      folder: UGC_FOLDERS[folder],
    }),
  })
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to initialize upload')
  }
  const { uploadId, s3Key, publicUrl } = await initRes.json()

  const partCount = Math.ceil(file.size / CHUNK_SIZE)
  const uploadedParts: { PartNumber: number; ETag: string }[] = []
  let totalUploaded = 0

  for (let i = 0; i < partCount; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    const partNumber = i + 1

    const partUrlRes = await fetch('/api/portal/upload/multipart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'part-url',
        uploadId,
        s3Key,
        partNumber,
      }),
    })
    if (!partUrlRes.ok) {
      const err = await partUrlRes.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to get part URL')
    }
    const { presignedUrl } = await partUrlRes.json()

    const etag = await withRetry(async () => {
      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const overall = ((totalUploaded + e.loaded) / file.size) * 100
            onProgress(Math.min(99, Math.round(overall)))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const headerEtag = xhr.getResponseHeader('ETag')
            if (!headerEtag) {
              reject(new Error('Missing ETag header from S3'))
              return
            }
            resolve(headerEtag.replace(/"/g, ''))
          } else {
            reject(new Error(`Part upload failed (${xhr.status})`))
          }
        }
        xhr.onerror = () => reject(new Error('Network error during part upload'))
        xhr.ontimeout = () => reject(new Error('Part upload timed out'))
        xhr.timeout = 300_000
        xhr.open('PUT', presignedUrl)
        xhr.send(chunk)
      })
    })

    uploadedParts.push({ PartNumber: partNumber, ETag: etag })
    totalUploaded += chunk.size
  }

  const completeRes = await fetch('/api/portal/upload/multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      uploadId,
      s3Key,
      parts: uploadedParts,
    }),
  })
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to finalize upload')
  }

  onProgress?.(100)

  const meta = file.type.startsWith('video/')
    ? await readVideoMetadata(file)
    : {}

  return {
    s3Key,
    url: publicUrl,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
    ...meta,
  }
}

// ---------------------------------------------------------------------------
// Public API: route to the right tier
// ---------------------------------------------------------------------------
export async function uploadUserFile(
  folder: UgcFolder,
  file: File,
  onProgress?: UploadProgressCb
): Promise<UserUploadResult> {
  if (file.size > MULTIPART_THRESHOLD) {
    return uploadViaMultipart(folder, file, onProgress)
  }
  if (file.size > PRESIGNED_THRESHOLD) {
    return uploadViaPresignedUrl(folder, file, onProgress)
  }
  return uploadViaApiRoute(folder, file, onProgress)
}

export async function uploadUserFiles(
  folder: UgcFolder,
  files: File[],
  onFileProgress?: (index: number, progress: number) => void
): Promise<{ result?: UserUploadResult; error?: string }[]> {
  const results: { result?: UserUploadResult; error?: string }[] = []
  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadUserFile(folder, files[i], (p) =>
        onFileProgress?.(i, p)
      )
      results.push({ result })
    } catch (err) {
      results.push({ error: getUploadErrorMessage(err) })
    }
    if (i < files.length - 1) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return results
}
