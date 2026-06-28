/**
 * End-to-end proof of the CodeAct + self-written skill loop, on the real
 * (captured) DOM of mercadopublico.cl.
 *
 *   npx tsx experiments/codeact/run.ts                       # mock model, no key
 *   ANTHROPIC_API_KEY=... npx tsx experiments/codeact/run.ts # Claude writes the code
 *
 * Pass 1: no skill exists → the model WRITES JavaScript to do the task → we run
 *         it inside the page, verify it worked, and save it as a SKILL.md.
 * Pass 2: the skill exists → we load and run it directly. Zero LLM calls.
 */
import { readFileSync, rmSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { JSDOM, VirtualConsole } from 'jsdom'
import { makeAgent } from './agent'
import { writeCode, runCode, LLM } from './codeact'
import { saveSkill, findSkill } from './skills'

const here = dirname(fileURLToPath(import.meta.url))
const snapshot = readFileSync(join(here, '..', '..', 'examples', 'snapshots', 'mercadopublico-home.html'), 'utf8')

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`, b: (s: string) => `\x1b[1m${s}\x1b[0m`,
  g: (s: string) => `\x1b[32m${s}\x1b[0m`, c: (s: string) => `\x1b[36m${s}\x1b[0m`,
  y: (s: string) => `\x1b[33m${s}\x1b[0m`, m: (s: string) => `\x1b[35m${s}\x1b[0m`,
}
const log = (s = '') => console.log(s)

const SITE = 'mercadopublico.cl'
const GOAL = 'Buscar licitaciones de notebooks reacondicionados en el portal.'
const QUERY = 'notebooks reacondicionados'

// load the page fresh and wire globals so the kit (and the agent's code) can run
function loadPage() {
  const vc = new VirtualConsole()
  vc.on('jsdomError', () => {})
  const dom = new JSDOM(snapshot, { url: 'https://www.mercadopublico.cl/Home', virtualConsole: vc })
  const g = globalThis as any
  g.window = dom.window
  g.document = dom.window.document
  for (const k of ['Node', 'NodeFilter', 'Element', 'HTMLElement', 'HTMLInputElement',
    'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLImageElement', 'MutationObserver', 'Event']) {
    g[k] = (dom.window as any)[k]
  }
  // jsdom doesn't implement requestSubmit — make clicking submit just fire `submit`
  ;(dom.window as any).HTMLFormElement.prototype.requestSubmit = function () {
    this.dispatchEvent(new (dom.window as any).Event('submit', { bubbles: true, cancelable: true }))
  }
  let submitted = false
  document.querySelector('#formBusqueda')?.addEventListener('submit', (e) => { e.preventDefault(); submitted = true })
  return {
    verify: () => {
      const v = (document.querySelector('#txtBuscar') as HTMLInputElement)?.value || ''
      return { ok: submitted && v.includes(QUERY), value: v, submitted }
    },
  }
}

// the model: real Claude if a key is present, otherwise a deterministic stand-in
const realLLM: LLM = async (prompt) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.MODEL || 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  })
  const data: any = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data.content[0].text
}
const mockLLM: LLM = async () => `await agent.type('#txtBuscar', '${QUERY}')\nawait agent.click('#btnBuscar')`
const useReal = !!process.env.ANTHROPIC_API_KEY
let llmCalls = 0
const llm: LLM = (p) => { llmCalls++; return (useReal ? realLLM : mockLLM)(p) }

async function pass(n: number) {
  log(C.b(C.m(`\n▌ Pasada ${n}`)))
  const page = loadPage()
  const agent = makeAgent((m) => log(C.dim(m)))

  const skill = findSkill(SITE, GOAL)
  let code: string
  if (skill) {
    log(`  skill encontrada: ${C.c(skill.path.split('/').slice(-2).join('/'))}  ${C.g('→ reusar sin LLM')}`)
    code = skill.code
  } else {
    log(`  ${C.y('sin skill')} → el modelo (${useReal ? 'Claude' : 'mock'}) ${C.b('escribe el código')}…`)
    code = await writeCode(llm, GOAL, agent.observe())
    log(C.dim('  ┌─ código generado ─────────────────────────────'))
    code.split('\n').forEach((l) => log(C.dim('  │ ') + C.c(l)))
    log(C.dim('  └───────────────────────────────────────────────'))
  }

  log(C.dim('  ejecutando dentro de la página:'))
  await runCode(code, agent)
  const v = page.verify()
  log(`  verificación: ${v.ok ? C.g('✓ búsqueda enviada con el término') : C.y('✗ ' + JSON.stringify(v))}`)

  if (v.ok && !skill) {
    const p = saveSkill({ name: 'buscar-licitacion', description: 'Buscar licitaciones por término en mercadopublico.cl', site: SITE, code })
    log(`  ${C.g('skill guardada')}: ${C.c(p.split('/').slice(-2).join('/'))}`)
  }
  return v.ok
}

async function main() {
  console.clear()
  log(C.b(C.c('  CodeAct + skills auto-escritas')) + C.dim('  ·  mercadopublico.cl'))
  log(C.dim('  el agente escribe su propio código, lo verifica, y lo reusa\n'))
  log(C.dim(`  cerebro: ${useReal ? 'Claude (real)' : 'mock — export ANTHROPIC_API_KEY para Claude real'}`))

  // start clean so the demo is reproducible
  const skillsDir = join(here, 'skills', 'buscar-licitacion')
  if (existsSync(skillsDir)) rmSync(skillsDir, { recursive: true, force: true })

  const a = await pass(1)   // writes + saves the skill
  const b = await pass(2)   // reuses it, no LLM

  log(C.b(C.m('\n▌ Resultado')))
  log(`  pasada 1 (escribe): ${a ? C.g('✓') : '✗'}   pasada 2 (reusa): ${b ? C.g('✓') : '✗'}`)
  log(`  llamadas al LLM: ${C.b(String(llmCalls))}  ${C.dim('(1 para aprender, 0 para repetir)')}`)
  log(C.dim('  la skill quedó en experiments/codeact/skills/buscar-licitacion/SKILL.md\n'))
}

main()
