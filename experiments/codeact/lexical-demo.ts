/**
 * Bounded lexical grounder vs the same cases — no model, no download, runs anywhere.
 *
 *   npx tsx experiments/codeact/lexical-demo.ts     # or: npm run demo:lexical
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { JSDOM, VirtualConsole } from 'jsdom'
import { findElement } from '../../src/dom/selector'
import { ground, norm, Candidate } from './lexicon'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '..', 'examples', 'snapshots', 'mercadopublico-home.html'), 'utf8')
const dom = new JSDOM(html, { url: 'https://www.mercadopublico.cl/Home', virtualConsole: new VirtualConsole() })
const g = globalThis as any
g.window = dom.window; g.document = dom.window.document
for (const k of ['Node', 'NodeFilter', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLImageElement', 'MutationObserver', 'Event']) g[k] = (dom.window as any)[k]

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`, b: (s: string) => `\x1b[1m${s}\x1b[0m`,
  g: (s: string) => `\x1b[32m${s}\x1b[0m`, r: (s: string) => `\x1b[31m${s}\x1b[0m`, c: (s: string) => `\x1b[36m${s}\x1b[0m`,
}
const tests = [
  { desc: 'quiero loguearme', expect: 'Iniciar Sesión' },
  { desc: 'cursos para aprender a usar la plataforma', expect: 'Capacitación' },
  { desc: 'asistencia al usuario', expect: 'Centro de Ayuda' },
  { desc: 'reciclaje y cuidado del medio ambiente', expect: 'Economía Circular' },
  { desc: 'catálogo de productos con precios ya negociados', expect: 'Tienda Convenio Marco' },
]

function candidatesFrom(): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  const scope = new Set([...document.querySelectorAll('header, nav, main')].flatMap((c) => [...c.querySelectorAll('a, button, input, textarea, select, [role="button"]')]))
  for (const el of scope) {
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue
    const labelFor = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : ''
    const text = (el.getAttribute('aria-label') || (el as HTMLInputElement).placeholder || labelFor || el.textContent || el.getAttribute('title') || el.getAttribute('name') || '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > 80 || seen.has(text)) continue
    seen.add(text); out.push({ text, path: el.id ? `#${el.id}` : el.tagName.toLowerCase() })
  }
  return out
}

const candidates = candidatesFrom()
console.log(C.b(C.c('\n  Grounding léxico (KB, sin modelo, sin descarga)')) + C.dim('  ·  mercadopublico.cl'))
console.log(C.dim(`  ${candidates.length} candidatos · léxico de intenciones es/en\n`))

let fw = 0, e1 = 0, e3 = 0
for (const t of tests) {
  const fz = findElement(t.desc)
  const fzText = fz ? (fz.element.getAttribute('aria-label') || (fz.element as HTMLInputElement).placeholder || fz.element.textContent || fz.element.tagName).replace(/\s+/g, ' ').trim().slice(0, 38) : '—'
  const fzOk = norm(fzText).includes(norm(t.expect))

  const ranked = ground(t.desc, candidates).slice(0, 3)
  const top1Ok = norm(ranked[0].text).includes(norm(t.expect))
  const top3Ok = ranked.some((c) => norm(c.text).includes(norm(t.expect)))
  if (fzOk) fw++; if (top1Ok) e1++; if (top3Ok) e3++

  console.log(C.b(`  "${t.desc}"`) + C.dim(`   (esperado: ${t.expect})`))
  console.log(`    fuzzy:   ${fzOk ? C.g('✓') : C.r('✗')} ${C.dim(fz ? `${fzText} [${fz.strategy}]` : '(sin match)')}`)
  const t3 = ranked.map((c, i) => `${i === 0 ? C.c(c.text) : C.dim(c.text)} ${C.dim(`[${(c as any).intents.join(',') || '—'}]`)}`).join(C.dim(' · '))
  console.log(`    léxico:  ${top1Ok ? C.g('✓ top-1') : top3Ok ? C.g('✓ top-3') : C.r('✗')}  ${t3}\n`)
}
console.log(C.b('  Resultado: ') + `fuzzy ${C.r(fw + '/' + tests.length)}   ·   léxico ${C.g(e1 + '/' + tests.length)} top-1, ${C.g(e3 + '/' + tests.length)} top-3`)
console.log(C.dim('  sin modelo, sin descarga, determinista y auditable.\n'))
