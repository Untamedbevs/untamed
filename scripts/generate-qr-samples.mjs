import QRCode from 'qrcode'
import { writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://untamedbeverages.com'

const drinks = [
  { slug: 'black-panther', name: 'Black Panther' },
  { slug: 'cheetah', name: 'Cheetah' },
  { slug: 'cougar', name: 'Cougar' },
  { slug: 'lioness', name: 'Lioness' },
]

const qrOptions = {
  type: 'png',
  width: 1024,
  margin: 4,
  color: { dark: '#000000', light: '#FFFFFF' },
  errorCorrectionLevel: 'M',
}

function writeQr(path, url) {
  return QRCode.toBuffer(url, qrOptions).then((png) => {
    writeFileSync(path, png)
    console.log(path)
    console.log(`  ${url}\n`)
  })
}

// --- Can: short URL -> redirect adds utm_source=can (see next.config.ts)
const canDir = 'public/images/qr'
mkdirSync(canDir, { recursive: true })

for (const drink of drinks) {
  const url = `${BASE_URL}/r/rewards/${drink.slug}`
  await writeQr(`${canDir}/qr-${drink.slug}.png`, url)
}

await writeQr(`${canDir}/qr-rewards-generic.png`, `${BASE_URL}/r/rewards`)
console.log('Can (website + can print):', canDir)

// --- Box: short URL -> redirect adds utm_source=box
const boxDir = 'public/images/qr/box'
mkdirSync(boxDir, { recursive: true })

for (const drink of drinks) {
  const url = `${BASE_URL}/r/box/rewards/${drink.slug}`
  await writeQr(`${boxDir}/qr-${drink.slug}.png`, url)
}

await writeQr(`${boxDir}/qr-rewards-generic.png`, `${BASE_URL}/r/box/rewards`)
console.log('Box (print for boxes only):', boxDir)
