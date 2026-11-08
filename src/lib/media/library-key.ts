/**
 * Media-library S3 key rules.
 *
 * The media library owns only the keys it creates itself:
 *   - media/...   (admin upload route, admin presign route, fal.ts saveGeneratedMedia)
 *   - private/... (admin presign route with isPrivate)
 *
 * Other namespaces that can end up in a `media` row (for example promoted UGC
 * rows in folder /ugc, which point at a member's user-uploads/... original)
 * must never be deleted or signed through the library routes.
 *
 * Folder segments come from staff-chosen folder names, including names of
 * local directories dropped into the uploader, so they can contain spaces,
 * parentheses and other punctuation. The check therefore rejects only what
 * is unsafe: control characters, backslashes, empty segments and dot
 * segments ('.', '..', also when percent-encoded as %2e).
 */

const LIBRARY_PREFIXES = ['media', 'private'] as const

const MAX_S3_KEY_LENGTH = 1024

function isDotSegment(segment: string): boolean {
  const decoded = segment.replace(/%2e/gi, '.')
  return decoded === '.' || decoded === '..'
}

export function isLibraryKey(key: unknown): key is string {
  if (typeof key !== 'string') return false
  if (key.length === 0 || key.length > MAX_S3_KEY_LENGTH) return false
  // No control characters (incl. CR/LF/NUL) and no backslashes, which URL
  // parsers treat as path separators.
  if (/[\u0000-\u001f\u007f\\]/.test(key)) return false

  const segments = key.split('/')
  const [prefix, ...rest] = segments
  if (!(LIBRARY_PREFIXES as readonly string[]).includes(prefix)) return false
  // Needs at least one segment (the file name) after the prefix.
  if (rest.length === 0) return false

  for (const segment of rest) {
    if (segment.length === 0) return false
    if (isDotSegment(segment)) return false
  }
  return true
}
