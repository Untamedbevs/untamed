// Records Referral HQ walkthroughs (desktop + mobile) and full-page stills.
// Usage: node record.js <projectDir> <outDir> <framesDir>
const fs = require('fs')
const path = require('path')
const { chromium } = require('C:/Users/ejdia/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')

const [, , PROJECT, OUT, FRAMES] = process.argv
const BASE = 'http://localhost:3003'

function readCreds() {
  const env = fs.readFileSync(path.join(PROJECT, '.env.local'), 'utf8')
  const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
  return { user: get('REFERRAL_HQ_USERNAME'), pass: get('REFERRAL_HQ_PASSWORD') }
}

const INIT = `
  try { localStorage.setItem('untamed-age-verified', 'true') } catch {}
  (() => {
    const install = () => {
      if (document.getElementById('__cap_style')) return
      const st = document.createElement('style'); st.id = '__cap_style'
      st.textContent = \`
        nextjs-portal, iframe { display: none !important; }
        ::-webkit-scrollbar { display: none; }
        #__cursor { position: fixed; left: -60px; top: -60px; width: 22px; height: 22px; margin: -11px 0 0 -11px;
          border-radius: 50%; background: rgba(255,255,255,.92); border: 2px solid #9B30FF;
          box-shadow: 0 0 14px rgba(155,48,255,.85); z-index: 2147483647; pointer-events: none; transition: transform .12s; }
        #__cursor.down { transform: scale(.7); }
        .__ripple { position: fixed; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
          border: 2px solid #FFD700; z-index: 2147483646; pointer-events: none; animation: __rip .55s ease-out forwards; }
        @keyframes __rip { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.5); opacity: 0 } }\`
      document.head.appendChild(st)
      if (!window.__CAP_CURSOR) return
      const c = document.createElement('div'); c.id = '__cursor'; document.body.appendChild(c)
      try { const p = JSON.parse(sessionStorage.getItem('__cp') || 'null'); if (p) { c.style.left = p.x + 'px'; c.style.top = p.y + 'px' } } catch {}
      addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
        try { sessionStorage.setItem('__cp', JSON.stringify({ x: e.clientX, y: e.clientY })) } catch {} }, true)
      addEventListener('mousedown', (e) => { c.classList.add('down'); const r = document.createElement('div'); r.className = '__ripple';
        r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 650) }, true)
      addEventListener('mouseup', () => c.classList.remove('down'), true)
    }
    if (document.readyState === 'complete') install(); else addEventListener('load', () => setTimeout(install, 50))
  })()
`

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function smoothScrollTo(page, y, ms = 1400) {
  await page.evaluate(([target, dur]) => new Promise((res) => {
    const max = document.documentElement.scrollHeight - innerHeight
    const to = Math.max(0, Math.min(max, target))
    const from = scrollY, d = to - from, t0 = performance.now()
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      window.scrollTo({ top: from + d * e, behavior: 'instant' })
      p < 1 ? requestAnimationFrame(step) : res()
    }
    requestAnimationFrame(step)
  }), [y, ms])
}

async function topOf(page, js) {
  return page.evaluate((code) => {
    const el = new Function(`return (${code})`)()
    return el ? el.getBoundingClientRect().top + scrollY : 0
  }, js)
}

const h2 = (text) => `[...document.querySelectorAll('h2')].find((e) => e.textContent.includes(${JSON.stringify(text)}))?.closest('section')`

async function hover(page, locator) {
  const b = await locator.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 24 })
}

async function moveClick(page, locator, { hold = 250 } = {}) {
  const box = await locator.boundingBox()
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y, { steps: 24 })
  await wait(hold)
  await page.mouse.down(); await wait(90); await page.mouse.up()
}

async function startRecorder(page, dir, { maxWidth, maxHeight }) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  let n = 0
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `f${String(++n).padStart(5, '0')}.jpg`
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth, maxHeight, everyNthFrame: 1 })
  return async (tailSeconds = 1.5) => {
    await cdp.send('Page.stopScreencast').catch(() => {})
    const lines = []
    frames.forEach((f, i) => {
      const next = frames[i + 1]
      const dur = next ? Math.max(0.001, next.t - f.t) : tailSeconds
      lines.push(`file '${f.file}'`, `duration ${dur.toFixed(4)}`)
    })
    lines.push(`file '${frames[frames.length - 1].file}'`)
    fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'))
    return frames.length
  }
}

async function login(page, creds, { slow }) {
  await page.goto(`${BASE}/referral-hq/login`, { waitUntil: 'load' })
  await wait(slow ? 1500 : 200)
  const email = page.locator('#username'), pass = page.locator('#password')
  if (slow) await moveClick(page, email); else await email.click()
  await email.pressSequentially(creds.user, { delay: slow ? 45 : 0 })
  if (slow) await moveClick(page, pass); else await pass.click()
  await pass.pressSequentially(creds.pass, { delay: slow ? 70 : 0 })
  await wait(slow ? 400 : 0)
  const submit = page.locator('button[type=submit]')
  if (slow) await moveClick(page, submit); else await submit.click()
  await page.waitForURL(`${BASE}/referral-hq`, { timeout: 30000 })
  await page.waitForLoadState('load'); await wait(800)
}

async function preloadImages(page) {
  // next/image lazy-loads below the fold; walk the page once so every image is decoded.
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < h; y += 500) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await wait(120) }
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await wait(400)
}

async function desktopWalkthrough(browser, creds) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await context.addInitScript(`window.__CAP_CURSOR = true;` + INIT)
  const page = await context.newPage()

  // Warm the dev server and the image cache, then sign out so the recording starts at login.
  await login(page, creds, { slow: false })
  await preloadImages(page)
  await page.goto(`${BASE}/referral-hq/blueprint`, { waitUntil: 'load' }); await preloadImages(page)
  await context.clearCookies()
  await page.mouse.move(960, 760)

  const stop = await startRecorder(page, path.join(FRAMES, 'desktop'), { maxWidth: 1920, maxHeight: 1080 })

  await login(page, creds, { slow: true })
  await wait(2800)

  // Hero → territory map
  await hover(page, page.getByText('Wild Credit', { exact: true }).first()); await wait(1400)
  const mapTop = await topOf(page, h2('Your territory'))
  await smoothScrollTo(page, mapTop - 110, 1800); await wait(2200)

  // Inspect a locked milestone, then the next target
  await moveClick(page, page.locator('button[aria-label^="Legend:"]')); await wait(1300)
  await smoothScrollTo(page, mapTop + 300, 1100); await wait(2400)
  await smoothScrollTo(page, mapTop - 110, 1000); await wait(600)
  await moveClick(page, page.locator('button[aria-label^="Alpha:"]')); await wait(1200)

  // Demo: build the territory from scratch to the summit
  await moveClick(page, page.getByRole('button', { name: 'Demo progress' })); await wait(900)
  const preset = (n) => page.locator('div.fixed button').filter({ hasText: new RegExp(`^${n}$`) })
  await moveClick(page, preset(0)); await wait(2600)
  for (const n of [1, 5, 10, 25, 50, 100]) { await moveClick(page, preset(n), { hold: 120 }); await wait(1500) }
  await moveClick(page, preset(250), { hold: 120 }); await wait(3500)
  await smoothScrollTo(page, 0, 1300); await wait(2600)   // hero at Legend
  await smoothScrollTo(page, mapTop - 110, 1300); await wait(600)
  await moveClick(page, page.locator('div.fixed button').filter({ hasText: 'Jess' })); await wait(2000)
  await moveClick(page, page.locator('button[aria-label="Close demo controls"]')); await wait(800)

  // Trophy case, code card, next unlock
  const trophyTop = await topOf(page, h2('Trophy case'))
  await smoothScrollTo(page, trophyTop - 110, 1700); await wait(1200)
  await hover(page, page.locator('li').filter({ hasText: 'Panther Pack' }).first()); await wait(1100)
  await hover(page, page.locator('li').filter({ hasText: 'Big Game' }).first()); await wait(1300)
  await hover(page, page.locator('section').filter({ hasText: 'Your code' }).locator('button').first()); await wait(1600)

  // Ledger, weekly chart (hover a bar), flavor mix
  const ledgerTop = await topOf(page, h2('Wild Credit activity'))
  await smoothScrollTo(page, ledgerTop - 110, 1700); await wait(1500)
  const bar = page.locator('[aria-label^="Week of Sep 28"]')
  const bb = await bar.boundingBox()
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 30, { steps: 25 }); await wait(1600)
  const bar2 = page.locator('[aria-label^="Week of Oct 12"]'); const bb2 = await bar2.boundingBox()
  await page.mouse.move(bb2.x + bb2.width / 2, bb2.y + bb2.height - 30, { steps: 18 }); await wait(1400)
  await page.mouse.move(1300, 900, { steps: 15 })
  await smoothScrollTo(page, 99999, 1600); await wait(2400)

  // Program blueprint
  await moveClick(page, page.getByRole('link', { name: 'Program Blueprint' }))
  await page.waitForURL(`${BASE}/referral-hq/blueprint`, { waitUntil: 'commit' }); await page.waitForLoadState('load'); await wait(800)
  await wait(3200)
  const ladderTop = await topOf(page, `[...document.querySelectorAll('table')][0]?.closest('section')`)
  await smoothScrollTo(page, ladderTop - 110, 1800); await wait(3800)
  await smoothScrollTo(page, ladderTop + 420, 1600); await wait(3200)
  const trophiesTop = await topOf(page, `[...document.querySelectorAll('div')].find((d) => d.textContent.trim() === 'Trophies (side hunts)')?.closest('section')`)
  await smoothScrollTo(page, trophiesTop - 110, 1600); await wait(3400)
  await smoothScrollTo(page, 99999, 1800); await wait(4000)

  const count = await stop(1.5)
  await context.close()
  return count
}

async function mobileWalkthrough(browser, creds) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  await context.addInitScript(INIT)
  const page = await context.newPage()
  await login(page, creds, { slow: false })
  await preloadImages(page)

  const stop = await startRecorder(page, path.join(FRAMES, 'mobile'), { maxWidth: 780, maxHeight: 1688 })
  await page.reload({ waitUntil: 'load' }); await wait(2500)
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  const mapTop = await topOf(page, h2('Your territory'))
  await smoothScrollTo(page, mapTop - 80, 1600); await wait(2600)
  await page.locator('button[aria-label^="Legend:"]').tap(); await wait(2200)
  for (let y = mapTop + 500; y < total; y += 640) { await smoothScrollTo(page, y, 1300); await wait(1700) }
  await smoothScrollTo(page, total, 900); await wait(2000)
  const count = await stop(1.2)
  await context.close()
  return count
}

async function stills(browser, creds) {
  const shots = []
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await desk.addInitScript(INIT)
  const page = await desk.newPage()
  await page.goto(`${BASE}/referral-hq/login`, { waitUntil: 'load' }); await wait(800)
  await page.screenshot({ path: path.join(OUT, '01-login.png') }); shots.push('01-login.png')
  await login(page, creds, { slow: false }); await preloadImages(page)
  await page.screenshot({ path: path.join(OUT, '02-dashboard-full.png'), fullPage: true }); shots.push('02-dashboard-full.png')

  const map = page.locator('[class*="aspect-[3/2]"]').first()
  await page.getByRole('button', { name: 'Demo progress' }).click()
  const preset = (n) => page.locator('div.fixed button').filter({ hasText: new RegExp(`^${n}$`) })
  const closePanel = () => page.locator('button[aria-label="Close demo controls"]').click()
  for (const [n, name] of [[0, '03-map-new-referrer.png'], [37, '04-map-hunter-37-packs.png'], [250, '05-map-legend-summit.png']]) {
    if (n === 37) await page.locator('div.fixed button').filter({ hasText: 'Jess' }).click(); else await preset(n).click()
    await wait(1400)
    await closePanel(); await wait(200)
    await map.screenshot({ path: path.join(OUT, name) }); shots.push(name)
    await page.getByRole('button', { name: 'Demo progress' }).click()
  }
  await page.locator('div.fixed button').filter({ hasText: 'Jess' }).click(); await closePanel()

  await page.goto(`${BASE}/referral-hq/blueprint`, { waitUntil: 'load' }); await preloadImages(page)
  await page.screenshot({ path: path.join(OUT, '06-blueprint-full.png'), fullPage: true }); shots.push('06-blueprint-full.png')
  await desk.close()

  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await mob.addInitScript(INIT)
  const mp = await mob.newPage()
  await login(mp, creds, { slow: false }); await preloadImages(mp)
  await mp.screenshot({ path: path.join(OUT, '07-dashboard-mobile-full.png'), fullPage: true }); shots.push('07-dashboard-mobile-full.png')
  await mob.close()
  return shots
}

;(async () => {
  const creds = readCreds()
  if (!creds.user || !creds.pass) throw new Error('REFERRAL_HQ_* not set in .env.local')
  fs.mkdirSync(OUT, { recursive: true })
  const which = process.argv[5] || 'all'
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    if (which === 'all' || which === 'desktop') console.log('desktop frames', await desktopWalkthrough(browser, creds))
    if (which === 'all' || which === 'mobile') console.log('mobile frames', await mobileWalkthrough(browser, creds))
    if (which === 'all' || which === 'stills') console.log('stills', await stills(browser, creds))
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
