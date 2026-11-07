import { register } from 'node:module'
import path from 'node:path'

const src = path.resolve(import.meta.dirname, '../../../../src')
const fakes = path.join(import.meta.dirname, 'fakes.mjs')
register('../loader.mjs', import.meta.url, {
  data: {
    src,
    swaps: {
      [path.join(src, 'lib/referral/helpers.ts')]: fakes,
      [path.join(src, 'lib/tracking/order-attribution.ts')]: fakes,
    },
  },
})
