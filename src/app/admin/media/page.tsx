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
  ChevronRight,
  Home,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  uploaded_by: string | null
  created_at: string
  updated_at: string
  uploaded_by_staff: { full_name: string } | null
}

interface FolderItem {
  path: string
  name: string
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'done' | 'error'
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFolder, setCurrentFolder] = useState('/')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [uploading, setUploading] = useState<UploadingFile[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMedia = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterType) params.set('file_type', filterType)
    if (search) {
      if (search) params.set('search', search)
    } else {
      params.set('folder', currentFolder)
    }

    const [mediaRes, foldersRes] = await Promise.all([
      fetch(`/api/admin/media?${params}`),
      fetch(`/api/admin/media?list_folders=true&folder=${encodeURIComponent(currentFolder)}`),
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

  function navigateToFolder(path: string) {
    setCurrentFolder(path)
    setSelectedIds(new Set())
    setSearch('')
  }

  const breadcrumbs = currentFolder === '/'
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
    const newPath = currentFolder === '/'
      ? `/${safeName}`
      : `${currentFolder}/${safeName}`
    setShowNewFolder(false)
    setNewFolderName('')
    navigateToFolder(newPath)
  }

  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    const newUploading: UploadingFile[] = fileArray.map((f) => ({
      file: f,
      progress: 0,
      status: 'uploading' as const,
    }))
    setUploading((prev) => [...prev, ...newUploading])

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', currentFolder)

        const res = await fetch('/api/admin/media', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          setUploading((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, progress: 100, status: 'done' } : u
            )
          )
        } else {
          const errData = await res.json().catch(() => ({}))
          console.error('Upload failed:', file.name, errData)
          alert(`Upload failed for ${file.name}: ${errData.error || 'Unknown error'}`)
          setUploading((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, status: 'error' } : u
            )
          )
        }
      } catch {
        setUploading((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: 'error' } : u
          )
        )
      }
    }

    fetchMedia()
    setTimeout(() => setUploading([]), 3000)
  }

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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <div
      className="space-y-6"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="fixed inset-0 bg-[#E87511]/10 border-2 border-dashed border-[#E87511] z-40 flex items-center justify-center">
          <div className="text-center">
            <Upload className="w-12 h-12 text-[#E87511] mx-auto mb-2" />
            <p className="text-lg font-semibold text-white">Drop files to upload to {currentFolder}</p>
          </div>
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
                view === 'grid' ? 'bg-[#E87511]/15 text-[#E87511]' : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                view === 'list' ? 'bg-[#E87511]/15 text-[#E87511]' : 'text-[#A0A0A0] hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white text-black font-semibold rounded-full px-4 py-2 text-sm flex items-center gap-2 hover:bg-[#E87511] hover:text-white transition-all duration-300"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

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
            onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
            className="p-2 text-[#666] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-2">
          {uploading.map((u, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-white truncate flex-1">{u.file.name}</span>
              {u.status === 'uploading' && <Loader2 className="w-4 h-4 text-[#E87511] animate-spin shrink-0" />}
              {u.status === 'done' && <Check className="w-4 h-4 text-green-400 shrink-0" />}
              {u.status === 'error' && <X className="w-4 h-4 text-red-400 shrink-0" />}
            </div>
          ))}
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
                  <span className="text-sm text-white truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {media.length === 0 && folders.length === 0 && (
            <div className="text-center py-16">
              <FolderOpen className="w-12 h-12 text-[#666] mx-auto mb-3" />
              <p className="text-[#A0A0A0] text-sm">
                {search ? 'No files match your search.' : 'This folder is empty. Upload files or create a subfolder!'}
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
                      selected ? 'border-[#E87511] ring-1 ring-[#E87511]' : 'border-[#2A2A2A] hover:border-[#444]'
                    )}
                  >
                    <div className="aspect-square relative" onClick={() => setPreviewItem(item)}>
                      {item.file_type === 'image' ? (
                        <img src={item.url} alt={item.alt_text || item.filename} className="w-full h-full object-cover" />
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
                      <p className="text-xs text-white truncate">{item.filename}</p>
                      <p className="text-[10px] text-[#666]">{formatBytes(item.file_size)}</p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
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
                      <CopyUrlButton url={item.url} />
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMedia(item.id) }}
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
                          checked={selectedIds.size === media.length && media.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(new Set(media.map((m) => m.id)))
                            else setSelectedIds(new Set())
                          }}
                        />
                      </th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">File</th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Type</th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Size</th>
                      <th className="text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Folder</th>
                      <th className="text-right text-xs font-medium text-[#A0A0A0] uppercase tracking-wider px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {media.map((item) => {
                      const Icon = FILE_TYPE_ICONS[item.file_type]
                      return (
                        <tr key={item.id} className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50 transition-colors">
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded border-[#2A2A2A]" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.file_type === 'image' ? (
                                <img src={item.url} alt={item.alt_text || ''} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-[#0A0A0A] flex items-center justify-center shrink-0">
                                  <Icon className="w-5 h-5 text-[#666]" />
                                </div>
                              )}
                              <span className="text-sm text-white truncate max-w-[200px]">{item.filename}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#A0A0A0] capitalize">{item.file_type}</td>
                          <td className="px-4 py-3 text-xs text-[#A0A0A0]">{formatBytes(item.file_size)}</td>
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
                              <button onClick={() => setPreviewItem(item)} className="p-1.5 text-[#666] hover:text-white transition-colors">
                                <Eye className="w-4 h-4" />
                              </button>
                              <CopyUrlButton url={item.url} variant="icon" />
                              <button onClick={() => deleteMedia(item.id)} className="p-1.5 text-[#666] hover:text-red-400 transition-colors">
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

      {previewItem && <MediaPreview item={previewItem} onClose={() => setPreviewItem(null)} />}
    </div>
  )
}

// ─── Copy URL Button ─────────────────────────────────────────────────────────

function CopyUrlButton({ url, variant = 'mini' }: { url: string; variant?: 'mini' | 'icon' }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (variant === 'icon') {
    return (
      <button onClick={handleCopy} className="p-1.5 text-[#666] hover:text-white transition-colors">
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    )
  }

  return (
    <button onClick={handleCopy} className="w-6 h-6 bg-black/50 backdrop-blur rounded flex items-center justify-center text-white/70 hover:text-white transition-colors">
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

// ─── Preview Modal ───────────────────────────────────────────────────────────

function MediaPreview({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
          <h3 className="text-sm font-semibold text-white truncate">{item.filename}</h3>
          <button onClick={onClose} className="text-[#666] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {item.file_type === 'image' && (
            <img src={item.url} alt={item.alt_text || item.filename} className="max-w-full max-h-[60vh] mx-auto rounded-xl object-contain" />
          )}
          {item.file_type === 'video' && (
            <video src={item.url} controls className="max-w-full max-h-[60vh] mx-auto rounded-xl" />
          )}
          {item.file_type === 'audio' && <audio src={item.url} controls className="w-full mt-8" />}
          {item.file_type === 'document' && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-[#666] mx-auto mb-3" />
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#E87511] hover:underline">
                Open document
              </a>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 grid grid-cols-2 gap-3 text-xs text-[#A0A0A0]">
          <div><span className="text-[#666]">Size:</span> {formatBytes(item.file_size)}</div>
          <div><span className="text-[#666]">Type:</span> {item.mime_type || item.file_type}</div>
          <div><span className="text-[#666]">Folder:</span> {item.folder}</div>
          <div><span className="text-[#666]">Uploaded:</span> {new Date(item.created_at).toLocaleDateString()}</div>
          <div className="col-span-2">
            <span className="text-[#666]">URL:</span>{' '}
            <span className="text-white break-all">{item.url}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
