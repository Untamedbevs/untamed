// Node resolve hook for replaying an app's real TypeScript files without installing anything:
// maps "@/x" to <src>/x, adds the .ts/.tsx/index.ts extension Next.js code leaves off, and swaps
// selected real files for fakes. Data: { src: absolute path, swaps: { realAbsolutePath: fakeAbsolutePath } }
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

let config = { src: '', swaps: {} }
export function initialize(data) {
  config = { src: data.src, swaps: Object.fromEntries(Object.entries(data.swaps || {}).map(([k, v]) => [path.normalize(k), v])) }
}

const candidates = (base) => [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, path.join(base, 'index.ts')]

function locate(base) {
  for (const file of candidates(base)) if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  return null
}

export async function resolve(specifier, context, next) {
  let base = null
  if (specifier.startsWith('@/')) base = path.join(config.src, specifier.slice(2))
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:'))
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
  if (base) {
    const file = locate(base)
    if (file) {
      const swapped = config.swaps[path.normalize(file)]
      return { url: pathToFileURL(swapped || file).href, shortCircuit: true }
    }
  }
  return next(specifier, context)
}
