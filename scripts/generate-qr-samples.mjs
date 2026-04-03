import QRCode from 'qrcode'
import { writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://untamedbeverages.com'

const drinks = [
  { slug: 'black-panther', name: 'Black Panther' },
  { slug: 'cheetah', name: 'Cheetah' },
  { slug: 'cougar', name: 'Cougar' },
  { slug: 'lioness', name: 'Lioness' },
]

const outputDir = 'public/images/qr'
mkdirSync(outputDir, { recursive: true })

for (const drink of drinks) {
  // Keep QR payload short for print reliability; redirect preserves tracking params.
  const url = `${BASE_URL}/r/rewards/${drink.slug}`

  const png = await QRCode.toBuffer(url, {
    type: 'png',
    width: 1024,
    margin: 4,
    color: { dark: '#000000', light: '#FFFFFF' },
    // Higher levels increase density; M prints/scans better for simple URLs.
    errorCorrectionLevel: 'M',
  })

  const path = `${outputDir}/qr-${drink.slug}.png`
  writeFileSync(path, png)
  console.log(`${drink.name}: ${path}`)
  console.log(`  URL: ${url}\n`)
}

// Also generate a generic "rewards" QR code
const genericUrl = `${BASE_URL}/r/rewards`
const genericPng = await QRCode.toBuffer(genericUrl, {
  type: 'png',
  width: 1024,
  margin: 4,
  color: { dark: '#000000', light: '#FFFFFF' },
  errorCorrectionLevel: 'M',
})
writeFileSync(`${outputDir}/qr-rewards-generic.png`, genericPng)
console.log(`Generic Rewards: ${outputDir}/qr-rewards-generic.png`)
console.log(`  URL: ${genericUrl}`)
