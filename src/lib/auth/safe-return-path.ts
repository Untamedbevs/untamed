// Shared by client pages and server routes, so it must not import anything
// server-only.

const BASE = 'https://return-path.invalid'

/**
 * Turns an untrusted return path (a `returnTo` or `next` query value) into a
 * path on this site, or `fallback` when it could lead anywhere else.
 *
 * The value is resolved the way a browser would resolve it, because string
 * checks alone miss cases: the URL parser drops tabs and newlines and treats
 * `\` as `/`, so `/\tevil.example` or `/\\evil.example` become `//evil.example`,
 * a link to another host.
 */
export function safeReturnPath(
  value: string | null | undefined,
  fallback = '/portal'
): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback

  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return fallback
  }

  if (url.origin !== BASE) return fallback
  // A path such as `/a/..//evil.example` resolves to `//evil.example`, which
  // the browser would read as another host once it is navigated to.
  if (url.pathname.startsWith('//')) return fallback

  return `${url.pathname}${url.search}${url.hash}`
}
