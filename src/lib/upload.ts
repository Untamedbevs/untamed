type FileType = 'image' | 'video' | 'audio' | 'document'

export interface UploadResult {
  id: string
  url: string
  s3Key: string
  fileName: string
  fileType: FileType
  mimeType: string
  fileSize: number
}

export type FileStatus = 'pending' | 'uploading' | 'success' | 'error'

export interface QueuedFile {
  id: string
  file: File
  displayName: string
  targetFolder: string
}

export function deriveFileType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

function shouldSkipFile(name: string): boolean {
  return name.startsWith('.') || IGNORED_FILES.has(name)
}

// ─── Directory reading ─────────────────────────────────────────────────────

async function readDirectoryChildren(
  dirEntry: FileSystemDirectoryEntry
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = []
    const reader = dirEntry.createReader()
    function readBatch() {
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all)
        else {
          all.push(...batch)
          readBatch()
        }
      }, reject)
    }
    readBatch()
  })
}

async function readAllFiles(
  entry: FileSystemEntry,
  parentPath: string
): Promise<{ file: File; folderPath: string }[]> {
  if (shouldSkipFile(entry.name)) return []

  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      ;(entry as FileSystemFileEntry).file(resolve, reject)
    })
    return [{ file, folderPath: parentPath }]
  }

  if (entry.isDirectory) {
    const currentPath = parentPath
      ? `${parentPath}/${entry.name}`
      : entry.name
    const children = await readDirectoryChildren(
      entry as FileSystemDirectoryEntry
    )
    const results: { file: File; folderPath: string }[] = []
    for (const child of children) {
      results.push(...(await readAllFiles(child, currentPath)))
    }
    return results
  }

  return []
}

export async function readDroppedItems(
  dataTransfer: DataTransfer,
  currentFolder: string
): Promise<QueuedFile[]> {
  const items = Array.from(dataTransfer.items)
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean) as FileSystemEntry[]

  if (entries.length === 0) {
    return Array.from(dataTransfer.files)
      .filter((f) => !shouldSkipFile(f.name))
      .map((file) => ({
        id: `${currentFolder}/${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        displayName: file.name,
        targetFolder: currentFolder,
      }))
  }

  const queued: QueuedFile[] = []

  for (const entry of entries) {
    if (entry.isFile) {
      if (shouldSkipFile(entry.name)) continue
      const file = await new Promise<File>((resolve, reject) => {
        ;(entry as FileSystemFileEntry).file(resolve, reject)
      })
      queued.push({
        id: `${currentFolder}/${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        displayName: file.name,
        targetFolder: currentFolder,
      })
    } else if (entry.isDirectory) {
      const files = await readAllFiles(entry, '')
      for (const { file, folderPath } of files) {
        const targetFolder =
          currentFolder === '/'
            ? `/${folderPath}`
            : `${currentFolder}/${folderPath}`
        const displayName = folderPath
          ? `${folderPath}/${file.name}`
          : file.name
        queued.push({
          id: `${targetFolder}/${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          displayName,
          targetFolder,
        })
      }
    }
  }

  return queued
}

export function createQueuedFiles(
  files: File[],
  currentFolder: string
): QueuedFile[] {
  return files
    .filter((f) => !shouldSkipFile(f.name))
    .map((file) => ({
      id: `${currentFolder}/${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      displayName: file.name,
      targetFolder: currentFolder,
    }))
}

// ─── Upload via presigned URL (browser → S3 direct) ────────────────────────

function uploadWithProgress(
  url: string,
  file: File,
  onProgress?: (progress: number) => void
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
      else reject(new Error(`S3 upload failed (${xhr.status})`))
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 600_000

    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.send(file)
  })
}

async function getPresignedUrl(
  filename: string,
  contentType: string,
  folder: string
): Promise<{ presignedUrl: string; s3Key: string; publicUrl: string }> {
  const res = await fetch('/api/admin/media/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, folder }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to get upload URL')
  }
  return res.json()
}

async function registerMediaRecord(record: {
  filename: string
  s3_key: string
  url: string
  file_type: FileType
  mime_type: string
  file_size: number
  folder: string
}): Promise<{ id: string }> {
  const res = await fetch('/api/admin/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to save media record')
  }
  return res.json()
}

async function uploadFile(
  file: File,
  folder: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const mimeType = file.type || 'application/octet-stream'
  const fileType = deriveFileType(mimeType)

  const { presignedUrl, s3Key, publicUrl } = await getPresignedUrl(
    file.name,
    mimeType,
    folder
  )

  await uploadWithProgress(presignedUrl, file, onProgress)

  const record = await registerMediaRecord({
    filename: file.name,
    s3_key: s3Key,
    url: publicUrl,
    file_type: fileType,
    mime_type: mimeType,
    file_size: file.size,
    folder,
  })

  return {
    id: record.id,
    url: publicUrl,
    s3Key,
    fileName: file.name,
    fileType,
    mimeType,
    fileSize: file.size,
  }
}

export async function uploadMediaQueue(
  queue: QueuedFile[],
  onFileProgress?: (
    id: string,
    status: FileStatus,
    progress?: number
  ) => void
): Promise<(UploadResult & { error?: string })[]> {
  const results: (UploadResult & { error?: string })[] = []

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    onFileProgress?.(item.id, 'uploading', 0)

    try {
      const result = await uploadFile(
        item.file,
        item.targetFolder,
        (progress) => {
          onFileProgress?.(item.id, 'uploading', progress)
        }
      )

      onFileProgress?.(item.id, 'success', 100)
      results.push(result)

      if (i < queue.length - 1) {
        await new Promise((r) => setTimeout(r, 200))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      onFileProgress?.(item.id, 'error')
      results.push({
        id: item.id,
        url: '',
        s3Key: '',
        fileName: item.file.name,
        fileType: 'document',
        mimeType: item.file.type || 'application/octet-stream',
        fileSize: item.file.size,
        error: message,
      })
    }
  }

  return results
}
