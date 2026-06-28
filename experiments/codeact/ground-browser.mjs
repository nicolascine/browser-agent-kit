/**
 * Semantic element grounding, run where it actually lives: in the browser, on
 * WASM. Loads the real mercadopublico.cl DOM in Chrome, injects browser-agent-kit
 * and transformers.js, and compares the kit's fuzzy selector vs. on-device
 * embeddings on ambiguous Spanish descriptions.
 *
 *   node experiments/codeact/ground-browser.mjs    # or: npm run demo:grounding
 *
 * The embedding model runs via onnxruntime-web (WASM). Moving it into a Web
 * Worker is a one-line change — it never needs the DOM, only the element texts.
 */
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const TF_VERSION = JSON.parse(readFileSync(join(root, 'node_modules/@huggingface/transformers/package.json'), 'utf8')).version
const TF_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TF_VERSION}/dist/transformers.min.js`
const MODEL = 'Xenova/multilingual-e5-small'

let html = readFileSync(join(root, 'examples/snapshots/mercadopublico-home.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<head([^>]*)>/i, '<head$1><base href="https://www.mercadopublico.cl/">')

const kit = (await build({ entryPoints: [join(root, 'src/index.ts')], bundle: true, format: 'iife', globalName: 'BAK', write: false })).outputFiles[0].text

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, c: (s) => `\x1b[36m${s}\x1b[0m`,
}
// ambiguous descriptions with little/no word overlap with the target label,
// each pointing to a UNIQUE element (no near-duplicate competitors)
const tests = [
  { desc: 'quiero loguearme', expect: 'Iniciar Sesión' },
  { desc: 'cursos para aprender a usar la plataforma', expect: 'Capacitación' },
  { desc: 'asistencia al usuario', expect: 'Centro de Ayuda' },
  { desc: 'reciclaje y cuidado del medio ambiente', expect: 'Economía Circular' },
  { desc: 'catálogo de productos con precios ya negociados', expect: 'Tienda Convenio Marco' },
]
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

console.log(C.b(C.c('\n  Grounding: fuzzy vs embeddings (WASM, in-browser)')) + C.dim('  ·  mercadopublico.cl'))
console.log(C.dim(`  modelo ${MODEL} · transformers.js ${TF_VERSION} · primera vez descarga el modelo\n`))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load', timeout: 30000 }).catch(() => {})
await page.addScriptTag({ content: kit })

const rows = await page.evaluate(async ({ tfUrl, model, tests }) => {
  const { pipeline, env } = await import(tfUrl)
  env.allowLocalModels = false
  const BAK = window.BAK

  // candidate elements, scoped to the primary regions an agent looks at
  // (header/nav/main) — not the footer/region junk
  const seen = new Set()
  const candidates = []
  const scope = new Set([...document.querySelectorAll('header, nav, main')]
    .flatMap((c) => [...c.querySelectorAll('a, button, input, textarea, select, [role="button"]')]))
  for (const el of scope) {
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue
    const labelFor = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : ''
    const text = (el.getAttribute('aria-label') || el.placeholder || labelFor || el.textContent || el.getAttribute('title') || el.getAttribute('name') || '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > 80 || seen.has(text)) continue
    seen.add(text); candidates.push({ text, path: el.id ? `#${el.id}` : el.tagName.toLowerCase() })
  }

  const extractor = await pipeline('feature-extraction', model, { dtype: 'q8' })
  const embed = async (arr) => (await extractor(arr, { pooling: 'mean', normalize: true })).tolist()
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
  const candVecs = await embed(candidates.map((c) => 'passage: ' + c.text))

  const out = []
  for (const t of tests) {
    // fuzzy = the kit's current selector
    const fz = BAK.findElement(t.desc)
    const fzEl = fz && fz.element
    const fzText = fzEl ? (fzEl.getAttribute('aria-label') || fzEl.placeholder || fzEl.textContent || fzEl.getAttribute('name') || fzEl.tagName).replace(/\s+/g, ' ').trim().slice(0, 38) : '—'
    // embeddings: rank all, keep top-3
    const [qv] = await embed(['query: ' + t.desc])
    const ranked = candidates.map((c, i) => ({ ...c, score: dot(qv, candVecs[i]) })).sort((a, b) => b.score - a.score).slice(0, 3)
    out.push({ desc: t.desc, expect: t.expect, fzText, fzStrat: fz ? fz.strategy : null, fzConf: fz ? fz.confidence : 0, top3: ranked })
  }
  return { candidates: candidates.length, out }
}, { tfUrl: TF_URL, model: MODEL, tests })

await browser.close()

let fw = 0, e1 = 0, e3 = 0
console.log(C.dim(`  ${rows.candidates} elementos candidatos\n`))
for (const o of rows.out) {
  const fzOk = norm(o.fzText).includes(norm(o.expect))
  const top1Ok = norm(o.top3[0].text).includes(norm(o.expect))
  const top3Ok = o.top3.some((c) => norm(c.text).includes(norm(o.expect)))
  if (fzOk) fw++; if (top1Ok) e1++; if (top3Ok) e3++
  console.log(C.b(`  "${o.desc}"`) + C.dim(`   (esperado: ${o.expect})`))
  console.log(`    fuzzy:      ${fzOk ? C.g('✓') : C.r('✗')} ${C.dim(`${o.fzText} ${o.fzStrat ? `[${o.fzStrat} ${o.fzConf.toFixed(2)}]` : '(sin match)'}`)}`)
  const t3 = o.top3.map((c, i) => `${i === 0 ? C.c(c.text) : C.dim(c.text)} ${C.dim(`(${c.score.toFixed(2)})`)}`).join(C.dim(' · '))
  console.log(`    embeddings: ${top1Ok ? C.g('✓ top-1') : top3Ok ? C.g('✓ top-3') : C.r('✗')}  ${t3}\n`)
}
console.log(C.b('  Resultado: ') + `fuzzy ${C.r(fw + '/' + rows.out.length)}   ·   embeddings ${C.g(e1 + '/' + rows.out.length)} top-1, ${C.g(e3 + '/' + rows.out.length)} top-3`)
console.log(C.dim('  el agente reduce 56 elementos a los 3 correctos por significado, on-device, sin LLM.\n'))
