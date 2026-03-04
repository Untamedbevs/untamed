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
  const url = `${BASE_URL}/drinks/${drink.slug}/rewards?utm_source=can&utm_medium=qr&utm_campaign=launch_2026&utm_content=${drink.slug}`

  const png = await QRCode.toBuffer(url, {
    type: 'png',
    width: 1024,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  })

  const path = `${outputDir}/qr-${drink.slug}.png`
  writeFileSync(path, png)
  console.log(`${drink.name}: ${path}`)
  console.log(`  URL: ${url}\n`)
}

// Also generate a generic "rewards" QR code
const genericUrl = `${BASE_URL}/rewards?utm_source=packaging&utm_medium=qr&utm_campaign=launch_2026&utm_content=generic`
const genericPng = await QRCode.toBuffer(genericUrl, {
  type: 'png',
  width: 1024,
  margin: 2,
  color: { dark: '#000000', light: '#FFFFFF' },
  errorCorrectionLevel: 'H',
})
writeFileSync(`${outputDir}/qr-rewards-generic.png`, genericPng)
console.log(`Generic Rewards: ${outputDir}/qr-rewards-generic.png`)
console.log(`  URL: ${genericUrl}`)
