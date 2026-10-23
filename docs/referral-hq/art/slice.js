// Usage: node slice.js <imgDir> <projectDir>
const path = require('path')
const fs = require('fs')
const [, , IMG, PROJECT] = process.argv
const sharp = require(path.join(PROJECT, 'node_modules', 'sharp'))
const OUT = path.join(PROJECT, 'public', 'images', 'referral-hq')
const MASTER = path.join(PROJECT, 'docs', 'referral-hq', 'art')

const SHEETS = [
  { file: 'ranks/ranks.png', dir: 'ranks', cols: 4, rows: 2, whiteBg: true, keepScale: true,
    names: ['cub', 'prowler', 'stalker', 'hunter', 'alpha', 'apex', 'legend', 'wild-credit'] },
  { file: 'trophies/trophies.png', dir: 'trophies', cols: 4, rows: 2, whiteBg: false,
    names: ['panther-pack', 'cheetah-sprint', 'cougar-crew', 'lioness-pride', 'full-pride', 'hot-streak', 'pack-builder', 'big-game'] },
  { file: 'rewards/rewards.png', dir: 'rewards', cols: 3, rows: 2, whiteBg: true,
    names: ['coins', 'four-pack', 'hat', 'hoodie', 'key', 'vip'] },
]

const neighbors = (i, w, h) => {
  const x = i % w, y = (i / w) | 0, out = []
  if (x > 0) out.push(i - 1)
  if (x < w - 1) out.push(i + 1)
  if (y > 0) out.push(i - w)
  if (y < h - 1) out.push(i + w)
  return out
}

function removeWhite(data, w, h) {
  const n = w * h
  const dist = new Uint8Array(n)
  for (let i = 0; i < n; i++) dist[i] = 255 - Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])

  const HARD = 30
  const bg = new Uint8Array(n)
  const stack = []
  const push = (i) => { if (!bg[i] && dist[i] < HARD) { bg[i] = 1; stack.push(i) } }
  const flood = () => { while (stack.length) for (const j of neighbors(stack.pop(), w, h)) push(j) }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  flood()

  // Large enclosed near-white pockets (e.g. inside the lanyard loop) are background too.
  const seen = new Uint8Array(n)
  for (let s = 0; s < n; s++) {
    if (bg[s] || seen[s] || dist[s] >= 14) continue
    const comp = [s]; seen[s] = 1
    for (let k = 0; k < comp.length; k++) {
      for (const j of neighbors(comp[k], w, h)) {
        if (!seen[j] && !bg[j] && dist[j] < 14) { seen[j] = 1; comp.push(j) }
      }
    }
    if (comp.length > 900) for (const i of comp) { bg[i] = 1; stack.push(i) }
  }
  flood()

  // Soft edge band (≤3px from background): color-to-alpha against white.
  const near = new Uint8Array(n).fill(255)
  for (let i = 0; i < n; i++) if (bg[i]) near[i] = 0
  for (let pass = 1; pass <= 3; pass++) {
    for (let i = 0; i < n; i++) {
      if (near[i] !== 255) continue
      if (neighbors(i, w, h).some((j) => near[j] === pass - 1)) near[i] = pass
    }
  }
  for (let i = 0; i < n; i++) {
    const o = i * 4
    if (bg[i]) { data[o + 3] = 0; continue }
    if (near[i] <= 3) {
      const a = Math.min(1, dist[i] / 190)
      if (a < 1) {
        for (let c = 0; c < 3; c++) {
          const v = (data[o + c] - (1 - a) * 255) / Math.max(a, 0.01)
          data[o + c] = Math.max(0, Math.min(255, Math.round(v)))
        }
        data[o + 3] = Math.round(a * 255)
      }
    }
  }
}

;(async () => {
  for (const sheet of SHEETS) {
    const { data, info } = await sharp(path.join(IMG, sheet.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width: w, height: h } = info
    if (sheet.whiteBg) removeWhite(data, w, h)
    else for (let i = 3; i < data.length; i += 4) if (data[i] >= 240) data[i] = 255

    fs.mkdirSync(path.join(OUT, sheet.dir), { recursive: true })
    fs.mkdirSync(path.join(MASTER, sheet.dir), { recursive: true })

    // Label connected shapes and give each to the cell holding its centroid,
    // so art that crosses a grid line still lands in the right crop.
    const n = w * h
    const labeled = new Uint8Array(n)
    const cw = w / sheet.cols, ch = h / sheet.rows
    const cellPixels = sheet.names.map(() => [])
    for (let s = 0; s < n; s++) {
      if (labeled[s] || data[s * 4 + 3] <= 16) continue
      const comp = [s]; labeled[s] = 1
      let sx = 0, sy = 0
      for (let k = 0; k < comp.length; k++) {
        const i = comp[k]; sx += i % w; sy += (i / w) | 0
        for (const j of neighbors(i, w, h)) if (!labeled[j] && data[j * 4 + 3] > 16) { labeled[j] = 1; comp.push(j) }
      }
      if (comp.length < 40) continue
      const col = Math.min(sheet.cols - 1, Math.floor(sx / comp.length / cw))
      const row = Math.min(sheet.rows - 1, Math.floor(sy / comp.length / ch))
      const cell = row * sheet.cols + col
      if (cell < sheet.names.length) for (const i of comp) cellPixels[cell].push(i)
    }

    const boxes = cellPixels.map((px) => {
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
      for (const i of px) {
        const x = i % w, y = (i / w) | 0
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      }
      return { x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 }
    })
    const sheetSide = Math.ceil(Math.max(...boxes.map((b) => Math.max(b.bw, b.bh))) * 1.04)

    for (let idx = 0; idx < sheet.names.length; idx++) {
      const { x0, y0, bw, bh } = boxes[idx]
      const buf = Buffer.alloc(bw * bh * 4)
      for (const i of cellPixels[idx]) {
        const x = (i % w) - x0, y = ((i / w) | 0) - y0
        data.copy(buf, (y * bw + x) * 4, i * 4, i * 4 + 4)
      }
      const side = sheet.keepScale ? sheetSide : Math.ceil(Math.max(bw, bh) * 1.04)
      const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: buf, raw: { width: bw, height: bh, channels: 4 }, left: Math.round((side - bw) / 2), top: Math.round((side - bh) / 2) }])
        .png().toBuffer()
      const sized = await sharp(square).resize(512, 512).png().toBuffer()
      const name = sheet.names[idx]
      await sharp(sized).png({ compressionLevel: 9 }).toFile(path.join(MASTER, sheet.dir, `${name}.png`))
      await sharp(sized).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(path.join(OUT, sheet.dir, `${name}.webp`))
      console.log(sheet.dir, name, `${bw}x${bh}`)
    }
  }
  await sharp(path.join(IMG, 'map/map.png')).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, 'map.jpg'))
  console.log('map done')
})()
