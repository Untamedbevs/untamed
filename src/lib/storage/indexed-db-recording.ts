/**
 * IndexedDB-backed persistence for in-progress UGC recordings.
 *
 * Adapted from the VibrationFit recorder so a user who closes the tab or
 * loses connection mid-record can come back and resume. Each recording is
 * keyed by a stable id and tagged with a `category` so we can find any
 * orphaned recording for the same flow on remount.
 */

const DB_NAME = 'untamed-ugc-recordings'
const DB_VERSION = 1
const STORE_NAME = 'recordings'

export interface SavedRecording {
  id: string
  category: string
  chunks: Blob[]
  duration: number
  mode: 'audio' | 'video'
  timestamp: number
  blob?: Blob
}

let dbInstance: IDBDatabase | null = null

async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(new Error('Failed to open IndexedDB'))
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('category', 'category', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

export async function saveRecordingChunks(
  recordingId: string,
  category: string,
  chunks: Blob[],
  duration: number,
  mode: 'audio' | 'video',
  blob?: Blob
): Promise<void> {
  try {
    const db = await initDB()
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const recording: SavedRecording = {
      id: recordingId,
      category,
      chunks,
      duration,
      mode,
      timestamp: Date.now(),
      blob,
    }
    await new Promise<void>((resolve, reject) => {
      const req = store.put(recording)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(new Error('Failed to save recording'))
    })
  } catch (err) {
    console.error('saveRecordingChunks failed', err)
  }
}

export async function loadSavedRecording(
  recordingId: string
): Promise<SavedRecording | null> {
  try {
    const db = await initDB()
    const tx = db.transaction([STORE_NAME], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    return new Promise((resolve, reject) => {
      const req = store.get(recordingId)
      req.onsuccess = () => resolve((req.result as SavedRecording) || null)
      req.onerror = () => reject(new Error('Failed to load recording'))
    })
  } catch {
    return null
  }
}

export async function getRecordingsForCategory(
  category: string
): Promise<SavedRecording[]> {
  try {
    const db = await initDB()
    const tx = db.transaction([STORE_NAME], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('category')
    return new Promise((resolve, reject) => {
      const req = index.getAll(category)
      req.onsuccess = () => {
        const recs = (req.result as SavedRecording[]) || []
        recs.sort((a, b) => b.timestamp - a.timestamp)
        resolve(recs)
      }
      req.onerror = () => reject(new Error('Failed to read recordings'))
    })
  } catch {
    return []
  }
}

export async function deleteSavedRecording(recordingId: string): Promise<void> {
  try {
    const db = await initDB()
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(recordingId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(new Error('Failed to delete recording'))
    })
  } catch (err) {
    console.error('deleteSavedRecording failed', err)
  }
}

export async function clearOldRecordings(
  olderThanHours: number = 24
): Promise<number> {
  try {
    const db = await initDB()
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('timestamp')
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000
    let deleted = 0
    return new Promise((resolve, reject) => {
      const req = index.openCursor(IDBKeyRange.upperBound(cutoff))
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          deleted++
          cursor.continue()
        } else {
          resolve(deleted)
        }
      }
      req.onerror = () => reject(new Error('Failed to clear old recordings'))
    })
  } catch {
    return 0
  }
}

export function generateRecordingId(category: string): string {
  return `recording-${category}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}`
}
