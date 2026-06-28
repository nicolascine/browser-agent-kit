/**
 * LIVE, complex task on the real mercadopublico.cl:
 *   search "notebooks reacondicionados" → go to results → EXTRACT the real
 *   tenders (title, organismo, monto, cierre).
 *
 * A process HUD shows each step; the run is recorded. Read-only (a public search,
 * no login, no submit of data) — the same thing a visitor does.
 *
 *   node experiments/codeact/mp-live.mjs   # -> prints real tenders + examples/mp-live.mp4
 */
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'
import { mkdirSync, rmSync, readdirSync } from 'fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const QUERY = 'notebooks reacondicionados'
const W = 1280, H = 800
const C = { dim: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, c: (s) => `\x1b[36m${s}\x1b[0m` }

const steps = []
async function hud(page, highlight) {
  await page.evaluate(({ steps, sel }) => {
    document.getElementById('bak-hud')?.remove()
    const d = document.createElement('div'); d.id = 'bak-hud'
    d.style.cssText = 'position:fixed;top:14px;right:14px;width:330px;z-index:2147483647;background:#0d1117ee;color:#c9d1d9;font:13px/1.5 ui-monospace,Menlo,monospace;border:1px solid #30363d;border-radius:10px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.4)'
    d.innerHTML = `<div style="color:#67e8f9;font-weight:700;margin-bottom:8px">browser-agent-kit · proceso</div>` +
      steps.map((s) => `<div style="margin:3px 0">${s}</div>`).join('')
    document.body.appendChild(d)
    if (sel) { const el = document.querySelector(sel); if (el) { el.style.outline = '3px solid #f59e0b'; el.style.outlineOffset = '2px'; el.scrollIntoView({ block: 'center' }) } }
  }, { steps, sel: highlight })
}

console.log(C.b(C.c('\n  Prueba en vivo · mercadopublico.cl')) + C.dim(`  ·  tarea: buscar "${QUERY}" y extraer licitaciones\n`))

const vidDir = join(root, '.vid'); rmSync(vidDir, { recursive: true, force: true }); mkdirSync(vidDir)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: vidDir, size: { width: W, height: H } } })
const page = await ctx.newPage()

steps.push('① abriendo mercadopublico.cl…')
await page.goto('https://www.mercadopublico.cl/Home', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
await page.waitForTimeout(3500); await hud(page)

steps.push('② ubico el buscador → <b style="color:#58a6ff">#txtBuscar</b>'); await hud(page, '#txtBuscar')
await page.fill('#txtBuscar', QUERY).catch(() => {})
steps.push(`③ escribí <b style="color:#3fb950">"${QUERY}"</b>`); await hud(page); await page.waitForTimeout(800)

steps.push('④ envío la búsqueda → <b style="color:#58a6ff">#btnBuscar</b>'); await hud(page, '#btnBuscar')
await Promise.race([page.waitForNavigation({ timeout: 15000 }).catch(() => null), page.click('#btnBuscar').catch(() => {})])
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(4000)

// extract the real tenders from the results DOM
const data = await page.evaluate(() => {
  const txt = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim()
  const count = (document.body.innerText.match(/Se han encontrado\s+([\d.]+)\s+resultados/i) || [])[1] || '?'
  const ids = [...document.querySelectorAll('*')].filter((e) => /ID Licitaci[oó]n/i.test(txt(e)) && e.children.length <= 3)
  const out = []
  for (const idEl of ids.slice(0, 5)) {
    const card = idEl.closest('div,article,li,section') || idEl.parentElement
    const t = txt(card)
    const id = (t.match(/ID Licitaci[oó]n:?\s*([A-Z0-9-]+)/i) || [])[1] || ''
    const titleEl = card?.querySelector('a, h1, h2, h3, h4')
    const monto = (t.match(/\$[\s]*[\d.]+/) || [])[0] || ''
    const cierre = (t.match(/cierre[:\s]*([\d/]+)/i) || [])[1] || ''
    out.push({ id, title: txt(titleEl).slice(0, 80), monto: monto.replace(/\s/g, ''), cierre })
  }
  return { count, url: location.href, tenders: out.filter((x) => x.title || x.id) }
})

steps.push(`⑤ <b style="color:#3fb950">${data.count} resultados</b> · extraídas ${data.tenders.length}`); await hud(page)
await page.waitForTimeout(2500)
await ctx.close(); await browser.close()

// transcode the recording
const webm = join(vidDir, readdirSync(vidDir).find((f) => f.endsWith('.webm')))
const mp4 = join(root, 'examples', 'mp-live.mp4')
execSync(`ffmpeg -y -v error -i "${webm}" -movflags +faststart -pix_fmt yuv420p -vf "scale=${W}:-2" "${mp4}"`)
rmSync(vidDir, { recursive: true, force: true })

console.log(C.b(`  Resultado real (${data.count} resultados en ${data.url}):\n`))
for (const t of data.tenders) {
  console.log(`  ${C.g('•')} ${C.b(t.title || '(sin título)')}`)
  console.log(C.dim(`    ${t.id}${t.monto ? ' · ' + t.monto : ''}${t.cierre ? ' · cierre ' + t.cierre : ''}`))
}
console.log(C.dim(`\n  video del proceso: examples/mp-live.mp4\n`))
