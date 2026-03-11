'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  LayoutGrid,
  List,
  Search,
  Upload,
  X,
  Trash2,
  Copy,
  Check,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Loader2,
  Eye,
  FolderOpen,
  Folder,
  FolderPlus,
  FolderUp,
  ChevronRight,
  Home,
  AlertCircle,
  CheckCircle,
  File as FileIcon,
  Lock,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  uploadMediaQueue,
  readDroppedItems,
  createQueuedFiles,
  deriveFileType,
  type QueuedFile,
  type FileStatus,
} from '@/lib/upload'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string
  filename: string
  s3_key: string
  url: string
  file_type: 'image' | 'video' | 'audio' | 'document'
  mime_type: string | null
  file_size: number | null
  width: number | null
  height: number | null
  alt_text: string | null
  tags: string[]
  folder: string
  is_private: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
  uploaded_by_staff: { full_name: string } | null
}

interface FolderItem {
  path: string
  name: string
}

interface Notification {
  type: 'success' | 'error'
  title: string
  details?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FILE_TYPE_ICONS = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(file: File) {
  const type = deriveFileType(file.type || 'application/octet-stream')
  return FILE_TYPE_ICONS[type]
}

function fileExtension(name: string): string {
  const ext = name.split('.').pop()
  return ext && ext !== name ? ext : '—'
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFolder, setCurrentFolder] = useState('/')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  // Upload state
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadPrivate, setUploadPrivate] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  )
  const [uploadStatus, setUploadStatus] = useState<Record<string, FileStatus>>(
    {}
  )
  const [dragOver, setDragOver] = useState(false)

  // Selection & preview
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)

  // Folders
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Notifications
  const [notification, setNotification] = useState<Notification | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  function notify(n: Notification, timeout = 4000) {
    setNotification(n)
    setTimeout(() => setNotification(null), timeout)
  }

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchMedia = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterType) params.set('file_type', filterType)
    if (search) {
      params.set('search', search)
    } else {
      params.set('folder', currentFolder)
    }

    const [mediaRes, foldersRes] = await Promise.all([
      fetch(`/api/admin/media?${params}`),
      fetch(
        `/api/admin/media?list_folders=true&folder=${encodeURIComponent(currentFolder)}`
      ),
    ])

    const mediaData = await mediaRes.json()
    const foldersData = await foldersRes.json()

    setMedia(Array.isArray(mediaData) ? mediaData : [])
    setFolders(foldersData.folders || [])
    setLoading(false)
  }, [currentFolder, filterType, search])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  // ─── Navigation ──────────────────────────────────────────────────────────

  function navigateToFolder(path: string) {
    setCurrentFolder(path)
    setSelectedIds(new Set())
    setSearch('')
  }

  const breadcrumbs =
    currentFolder === '/'
      ? [{ label: 'Media', path: '/' }]
      : [
          { label: 'Media', path: '/' },
          ...currentFolder
            .replace(/^\/|\/$/g, '')
            .split('/')
            .map((segment, i, arr) => ({
              label: segment,
              path: '/' + arr.slice(0, i + 1).join('/'),
            })),
        ]

  function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const safeName = newFolderName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    const newPath =
      currentFolder === '/' ? `/${safeName}` : `${currentFolder}/${safeName}`
    setShowNewFolder(false)
    setNewFolderName('')
    navigateToFolder(newPath)
  }

  // ─── File / Folder Selection ─────────────────────────────────────────────

  function enqueueFiles(items: QueuedFile[]) {
    if (items.length === 0) return
    const tagged = items.map((item) => ({ ...item, isPrivate: uploadPrivate }))
    setQueue((prev) => [...prev, ...tagged])

    const status: Record<string, FileStatus> = {}
    const progress: Record<string, number> = {}
    items.forEach((q) => {
      status[q.id] = 'pending'
      progress[q.id] = 0
    })
    setUploadStatus((prev) => ({ ...prev, ...status }))
    setUploadProgress((prev) => ({ ...prev, ...progress }))

    if (!showUploadForm) setShowUploadForm(true)
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id))
    setUploadStatus((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setUploadProgress((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function clearQueue() {
    setQueue([])
    setUploadStatus({})
    setUploadProgress({})
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      enqueueFiles(createQueuedFiles(Array.from(e.target.files), currentFolder))
      e.target.value = ''
    }
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    const files = Array.from(e.target.files)

    const queued: QueuedFile[] = files
      .filter((f) => f.name && !f.name.startsWith('.'))
      .map((file) => {
        const relativePath = file.webkitRelativePath || ''
        const parts = relativePath.split('/')
        // Remove the filename from the path to get the folder portion
        const folderParts = parts.slice(0, -1)
        const folderSuffix = folderParts.join('/')
        const targetFolder =
          currentFolder === '/'
            ? `/${folderSuffix}`
            : `${currentFolder}/${folderSuffix}`
        const displayName =
          folderParts.length > 0 ? `${folderSuffix}/${file.name}` : file.name

        return {
          id: `${targetFolder}/${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          displayName,
          targetFolder,
        }
      })

    enqueueFiles(queued)
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)

    try {
      const items = await readDroppedItems(e.dataTransfer, currentFolder)
      enqueueFiles(items)
    } catch (err) {
      console.error('Failed to read dropped items:', err)
      // Fallback to flat file list
      if (e.dataTransfer.files.length) {
        enqueueFiles(
          createQueuedFiles(Array.from(e.dataTransfer.files), currentFolder)
        )
      }
    }
  }

  // ─── Upload ──────────────────────────────────────────────────────────────

  async function handleUpload() {
    const pending = queue.filter(
      (q) => (uploadStatus[q.id] || 'pending') === 'pending'
    )
    if (pending.length === 0) {
      notify({ type: 'error', title: 'No files to upload' })
      return
    }

    try {
      setUploading(true)

      const results = await uploadMediaQueue(
        pending,
        (id, status, progress) => {
          setUploadStatus((prev) => ({ ...prev, [id]: status }))
          if (progress !== undefined) {
            setUploadProgress((prev) => ({ ...prev, [id]: progress }))
          }
        }
      )

      const succeeded = results.filter((r) => !r.error)
      const failed = results.filter((r) => r.error)

      await fetchMedia()

      if (failed.length === 0) {
        notify({
          type: 'success',
          title: `${succeeded.length} file${succeeded.length !== 1 ? 's' : ''} uploaded`,
        })
        clearQueue()
        setShowUploadForm(false)
      } else if (succeeded.length > 0) {
        notify(
          {
            type: 'success',
            title: `${succeeded.length} uploaded, ${failed.length} failed`,
            details: failed.map((f) => `${f.fileName}: ${f.error}`),
          },
          6000
        )
      } else {
        notify(
          {
            type: 'error',
            title: 'Upload failed',
            details: failed.map((f) => `${f.fileName}: ${f.error}`),
          },
          6000
        )
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Upload failed',
        details: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setUploading(false)
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  async function deleteMedia(id: string) {
    if (!confirm('Delete this file?')) return
    await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
    setMedia((prev) => prev.filter((m) => m.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} files?`)) return
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
      )
    )
    setSelectedIds(new Set())
    fetchMedia()
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const pendingCount = queue.filter(
    (q) => (uploadStatus[q.id] || 'pending') === 'pending'
  ).length

  // Collect unique target folders for display when queue has mixed folders
  const targetFolders = [...new Set(queue.map((q) => q.targetFolder))]
  const hasMultipleFolders = targetFolders.length > 1

  return (
    <div
      className="space-y-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 bg-[#E87511]/10 border-2 border-dashed border-[#E87511] z-40 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 text-[#E87511] mx-auto mb-2" />
            <p className="text-lg font-semibold text-white">
              Drop files or folders to upload
            </p>
            <p className="text-sm text-[#A0A0A0] mt-1">
              Folder structure will be preserved
            </p>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border text-sm animate-in fade-in slide-in-from-top-2 duration-300',
            notification.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          )}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium">{notification.title}</p>
            {notification.details?.map((d, i) => (
              <p key={i} className="text-xs opacity-80 mt-1">
                {d}
              </p>
            ))}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#666]" />}
            <button
              onClick={() => navigateToFolder(crumb.path)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors',
                i === breadcrumbs.length - 1
                  ? 'text-white font-medium'
                  : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
              )}
            >
              {i === 0 && <Home className="w-3.5 h-3.5" />}
              {crumb.label}
            </button>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all media..."
              className="bg-[#141414] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#E87511] transition-colors w-48"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E87511] transition-colors"
          >
            <option value="">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="document">Documents</option>
          </select>

          {selectedIds.size > 0 && (
            <button
              onClick={bulkDelete}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-full px-3 py-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedIds.size})
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#A0A0A0] hover:text-white border border-[#2A2A2A] rounded-xl hover:border-[#444] transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>

          <div className="flex bg-[#141414] border border-[#2A2A2A] rounded-xl overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                view === 'grid'
                  ? 'bg-[#E87511]/15 text-[#E87511]'
                  : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                view === 'list'
                  ? 'bg-[#E87511]/15 text-[#E87511]'
                  : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowUploadForm((v) => !v)}
            className="bg-white text-black font-semibold rounded-full px-4 py-2 text-sm flex items-center gap-2 hover:bg-[#E87511] hover:text-white transition-all duration-300"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Upload Files</h3>
            <button
              onClick={() => {
                setShowUploadForm(false)
                clearQueue()
              }}
              className="text-[#666] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Public / Private toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUploadPrivate(false)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                !uploadPrivate
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'text-[#666] border-[#2A2A2A] hover:border-[#444] hover:text-[#A0A0A0]'
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              Public
            </button>
            <button
              type="button"
              onClick={() => setUploadPrivate(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                uploadPrivate
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'text-[#666] border-[#2A2A2A] hover:border-[#444] hover:text-[#A0A0A0]'
              )}
            >
              <Lock className="w-3.5 h-3.5" />
              Private
            </button>
            {uploadPrivate && (
              <span className="text-[10px] text-amber-400/70">
                Files stored under private/ prefix — viewable only by admins via signed URLs
              </span>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 transition-all',
              dragOver
                ? 'border-[#E87511] bg-[#E87511]/5'
                : 'border-[#2A2A2A] hover:border-[#444] hover:bg-[#0A0A0A]/50'
            )}
          >
            <Upload className="w-8 h-8 text-[#666]" />
            <div className="text-center">
              <p className="text-sm text-white font-medium">
                Drag files or folders here
              </p>
              <p className="text-xs text-[#666] mt-1">
                Folder structure is preserved automatically
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                /* @ts-expect-error webkitdirectory is a non-standard attribute */
                webkitdirectory=""
                onChange={handleFolderSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-[#E87511] hover:text-[#FF8C2A] font-medium border border-[#E87511]/30 rounded-full px-4 py-1.5 hover:border-[#E87511] transition-colors"
              >
                Browse Files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="text-xs text-[#A0A0A0] hover:text-white font-medium border border-[#2A2A2A] rounded-full px-4 py-1.5 hover:border-[#444] transition-colors flex items-center gap-1.5"
              >
                <FolderUp className="w-3 h-3" />
                Browse Folder
              </button>
            </div>
          </div>

          {/* Queued files list */}
          {queue.length > 0 && (
            <>
              {hasMultipleFolders && (
                <p className="text-[10px] text-[#666]">
                  Uploading to {targetFolders.length} folders
                </p>
              )}
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {queue.map((item) => {
                  const status = uploadStatus[item.id] || 'pending'
                  const progress = uploadProgress[item.id] || 0
                  const Icon = fileIcon(item.file)

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-[#0A0A0A] rounded-xl px-3 py-2.5"
                    >
                      {/* Thumbnail or icon */}
                      <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] flex items-center justify-center shrink-0 overflow-hidden">
                        {item.file.type.startsWith('image/') ? (
                          <FilePreviewThumb file={item.file} />
                        ) : (
                          <Icon className="w-4 h-4 text-[#666]" />
                        )}
                      </div>

                      {/* File info + progress */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-white truncate">
                            {item.displayName}
                          </p>
                          <span className="text-[10px] text-[#E87511]/70 font-medium uppercase shrink-0">
                            {fileExtension(item.file.name)}
                          </span>
                          <span className="text-[10px] text-[#666] shrink-0">
                            {formatBytes(item.file.size)}
                          </span>
                        </div>

                        {item.targetFolder !== currentFolder && (
                          <p className="text-[10px] text-[#555] truncate">
                            {item.targetFolder}
                          </p>
                        )}

                        {status === 'uploading' && (
                          <div className="mt-1 w-full bg-[#2A2A2A] rounded-full h-1.5">
                            <div
                              className="bg-[#E87511] h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                        {status === 'success' && (
                          <p className="text-[10px] text-green-400 mt-0.5">
                            Uploaded
                          </p>
                        )}
                        {status === 'error' && (
                          <p className="text-[10px] text-red-400 mt-0.5">
                            Failed
                          </p>
                        )}
                      </div>

                      {/* Status icon / remove */}
                      {status === 'uploading' && (
                        <Loader2 className="w-4 h-4 text-[#E87511] animate-spin shrink-0" />
                      )}
                      {status === 'success' && (
                        <Check className="w-4 h-4 text-green-400 shrink-0" />
                      )}
                      {status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      {status === 'pending' && (
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          className="text-[#666] hover:text-red-400 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Actions */}
          {queue.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleUpload}
                disabled={uploading || pendingCount === 0}
                className={cn(
                  'flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300',
                  uploading || pendingCount === 0
                    ? 'bg-[#2A2A2A] text-[#666] cursor-not-allowed'
                    : 'bg-white text-black hover:bg-[#E87511] hover:text-white'
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {pendingCount} File
                    {pendingCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>

              {!uploading && (
                <button
                  onClick={clearQueue}
                  className="text-xs text-[#A0A0A0] hover:text-white transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Folder Dialog */}
      {showNewFolder && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 flex items-center gap-3">
          <FolderPlus className="w-5 h-5 text-[#E87511] shrink-0" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder="Folder name"
            autoFocus
            className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#E87511] transition-colors"
          />
          <button
            onClick={handleCreateFolder}
            className="px-3 py-2 text-sm bg-[#E87511] text-white rounded-lg hover:bg-[#FF8C2A] transition-colors"
          >
            Create
          </button>
          <button
            onClick={() => {
              setShowNewFolder(false)
              setNewFolderName('')
            }}
            className="p-2 text-[#666] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-[#E87511] animate-spin" />
        </div>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && !search && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  onClick={() => navigateToFolder(folder.path)}
                  className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 flex items-center gap-3 hover:border-[#E87511] hover:bg-[#1A1A1A] transition-all group"
                >
                  <Folder className="w-8 h-8 text-[#E87511] shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-sm text-white truncate">
                    {folder.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {media.length === 0 && folders.length === 0 && (
            <div className="text-center py-16">
              <FolderOpen className="w-12 h-12 text-[#666] mx-auto mb-3" />
              <p className="text-[#A0A0A0] text-sm">
                {search
                  ? 'No files match your search.'
                  : 'This folder is empty. Upload files or create a subfolder!'}
              </p>
            </div>
          )}

          {/* Grid View */}
          {view === 'grid' && media.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {media.map((item) => {
                const selected = selectedIds.has(item.id)
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group relative bg-[#141414] border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer',
                      selected
                        ? 'border-[#E87511] ring-1 ring-[#E87511]'
                        : 'border-[#2A2A2A] hover:border-[#444]'
                    )}
                  >
                    <div
                      className="aspect-square relative"
                      onClick={() => setPreviewItem(item)}
                    >
                      {item.file_type === 'image' && !item.is_private ? (
                        <img
                          src={item.url}
                          alt={item.alt_text || item.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : item.is_private ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0A0A0A] gap-1.5">
                          <Lock className="w-8 h-8 text-amber-400/50" />
                          <span className="text-[10px] text-amber-400/50 font-medium">Private</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A]">
                          {(() => {
                            const Icon = FILE_TYPE_ICONS[item.file_type]
                            return <Icon className="w-10 h-10 text-[#666]" />
                          })()}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <div className="p-2">
                      <p className="text-xs text-white truncate">
                        {item.filename}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#E87511]/70 font-medium uppercase">
                          {fileExtension(item.filename)}
                        </span>
                        <span className="text-[10px] text-[#666]">
                          {formatBytes(item.file_size)}
                        </span>
                        {item.is_private && (
                          <Lock className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(item.id)
                      }}
                      className={cn(
                        'absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-all',
                        selected
                          ? 'bg-[#E87511] border-[#E87511]'
                          : 'border-white/30 bg-black/30 opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </button>

                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!item.is_private && <CopyUrlButton url={item.url} />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteMedia(item.id)
                        }}
                        className="w-6 h-6 bg-black/50 backdrop-blur rounded flex items-center justify-center text-white/70 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* List View */}
          {view === 'list' && media.length > 0 && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2A2A2A]">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-[#2A2A2A]"
                          checked={
                            selectedIds.size === media.length &&
                            media.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedIds(
                                new Set(media.map((m) => m.id))
                              )
                            else setSelectedIds(new Set())
                          }}
                        />
                      </th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">
                        File
                      </th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">
                        Type
                      </th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">
                        Size
                      </th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">
                        Folder
                      </th>
                      <th className="text-right text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {media.map((item) => {
                      const Icon = FILE_TYPE_ICONS[item.file_type]
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="rounded border-[#2A2A2A]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.is_private ? (
                                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                  <Lock className="w-5 h-5 text-amber-400/60" />
                                </div>
                              ) : item.file_type === 'image' ? (
                                <img
                                  src={item.url}
                                  alt={item.alt_text || ''}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-[#0A0A0A] flex items-center justify-center shrink-0">
                                  <Icon className="w-5 h-5 text-[#666]" />
                                </div>
                              )}
                              <span className="text-sm text-white truncate max-w-[200px]">
                                {item.filename}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#A0A0A0]">
                            <div className="flex items-center gap-1.5 capitalize">
                              {item.file_type}
                              {item.is_private && (
                                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full font-medium">
                                  Private
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#A0A0A0]">
                            {formatBytes(item.file_size)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => navigateToFolder(item.folder)}
                              className="text-xs text-[#E87511] hover:underline"
                            >
                              {item.folder}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setPreviewItem(item)}
                                className="p-1.5 text-[#666] hover:text-white transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {!item.is_private && (
                                <CopyUrlButton url={item.url} variant="icon" />
                              )}
                              <button
                                onClick={() => deleteMedia(item.id)}
                                className="p-1.5 text-[#666] hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {previewItem && (
        <MediaPreview item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
    </div>
  )
}

// ─── File Preview Thumb ───────────────────────────────────────────────────────

function FilePreviewThumb({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!src) return <FileIcon className="w-4 h-4 text-[#666]" />

  return <img src={src} alt="" className="w-full h-full object-cover" />
}

// ─── Copy URL Button ─────────────────────────────────────────────────────────

function CopyUrlButton({
  url,
  variant = 'mini',
}: {
  url: string
  variant?: 'mini' | 'icon'
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCopy}
        className="p-1.5 text-[#666] hover:text-white transition-colors"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleCopy}
      className="w-6 h-6 bg-black/50 backdrop-blur rounded flex items-center justify-center text-white/70 hover:text-white transition-colors"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-400" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  )
}

// ─── Preview Modal ───────────────────────────────────────────────────────────

function MediaPreview({
  item,
  onClose,
}: {
  item: MediaItem
  onClose: () => void
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    item.is_private ? null : item.url
  )
  const [loadingUrl, setLoadingUrl] = useState(item.is_private)

  useEffect(() => {
    if (!item.is_private) {
      setResolvedUrl(item.url)
      setLoadingUrl(false)
      return
    }

    let cancelled = false
    setLoadingUrl(true)

    fetch(`/api/admin/media/${item.id}/signed-url`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setResolvedUrl(data.url)
          setLoadingUrl(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingUrl(false)
      })

    return () => { cancelled = true }
  }, [item.id, item.is_private, item.url])

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#141414] border border-[#2A2A2A] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2 min-w-0">
            {item.is_private && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium shrink-0">
                <Lock className="w-3 h-3" />
                Private
              </span>
            )}
            <h3 className="text-sm font-semibold text-white truncate">
              {item.filename}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {loadingUrl ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#E87511] animate-spin" />
            </div>
          ) : !resolvedUrl ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-300">Failed to load file</p>
            </div>
          ) : (
            <>
              {item.file_type === 'image' && (
                <img
                  src={resolvedUrl}
                  alt={item.alt_text || item.filename}
                  className="max-w-full max-h-[60vh] mx-auto rounded-xl object-contain"
                />
              )}
              {item.file_type === 'video' && (
                <video
                  src={resolvedUrl}
                  controls
                  className="max-w-full max-h-[60vh] mx-auto rounded-xl"
                />
              )}
              {item.file_type === 'audio' && (
                <audio src={resolvedUrl} controls className="w-full mt-8" />
              )}
              {item.file_type === 'document' && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-[#666] mx-auto mb-3" />
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#E87511] hover:underline"
                  >
                    Open document
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 pb-4 grid grid-cols-2 gap-3 text-xs text-[#A0A0A0]">
          <div>
            <span className="text-[#666]">Size:</span>{' '}
            {formatBytes(item.file_size)}
          </div>
          <div>
            <span className="text-[#666]">Type:</span>{' '}
            {item.mime_type || item.file_type}
          </div>
          <div>
            <span className="text-[#666]">Folder:</span> {item.folder}
          </div>
          <div>
            <span className="text-[#666]">Uploaded:</span>{' '}
            {new Date(item.created_at).toLocaleDateString()}
          </div>
          <div className="col-span-2">
            <span className="text-[#666]">{item.is_private ? 'Access:' : 'URL:'}</span>{' '}
            <span className="text-white break-all">
              {item.is_private ? 'Signed URL (expires in 1 hour)' : item.url}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
