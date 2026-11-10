/**
 * Size limits for member uploads, by destination folder. They match what the portal pages
 * already tell members (UGC up to 1.5 GB per file, receipts up to 25 MB), so nothing a
 * member is invited to upload is refused; they stop anything far larger from being stored
 * or sent to MediaConvert.
 *
 * Enforcement: the size a browser declares is signed into its S3 upload link (S3 refuses a
 * body of any other length), and multipart uploads are added up before they are completed.
 */

const MB = 1024 * 1024

export const UPLOAD_MAX_BYTES: Record<string, number> = {
  'ugc/uploads': 1500 * MB,
  'ugc/recordings': 1500 * MB,
  'receipts/uploads': 25 * MB,
  'promotions/proofs': 25 * MB,
}

/** The portal uploads large files in 10 MB parts; allow some headroom, never more. */
export const MULTIPART_MAX_PART_BYTES = 64 * MB
/** S3's own ceiling on part numbers. */
export const MULTIPART_MAX_PARTS = 10_000

function isWholeBytes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** The declared size when it is a whole number of bytes within the folder's limit, else null. */
export function allowedUploadSize(folder: string, size: unknown): number | null {
  const max = UPLOAD_MAX_BYTES[folder]
  if (!max || !isWholeBytes(size) || size > max) return null
  return size
}

/** The declared part size when it is a whole number of bytes within the part limit, else null. */
export function allowedPartSize(size: unknown): number | null {
  return isWholeBytes(size) && size <= MULTIPART_MAX_PART_BYTES ? size : null
}

/** Human-readable limit for error messages, e.g. "1.5 GB" or "25 MB". */
export function describeLimit(folder: string): string {
  const max = UPLOAD_MAX_BYTES[folder] ?? 0
  return max >= 1000 * MB ? `${(max / (1000 * MB)).toFixed(1)} GB` : `${Math.round(max / MB)} MB`
}

/** The folder of a member upload key `user-uploads/<user>/<folder...>/<file>`, or null. */
export function folderOfUserKey(key: string, authUserId: string): string | null {
  const prefix = `user-uploads/${authUserId}/`
  if (!key.startsWith(prefix)) return null
  const rest = key.slice(prefix.length)
  const slash = rest.lastIndexOf('/')
  return slash > 0 ? rest.slice(0, slash) : null
}
