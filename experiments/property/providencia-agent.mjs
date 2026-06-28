/**
 * Same goal as providencia.mjs — find below-market apartments in Providencia —
 * but done THROUGH browser-agent-kit, as a new use case of the tech:
 *
 *   PERCEIVE  the heavy real-estate SPA as a compact accessibility view (the kit)
 *   GROUND    the controls by intent (the kit's new intent strategy)
 *   ACT       run the agent's extraction code in-page, against the real DOM
 *   REASON    compute UF/m² and flag size-adjusted below-market listings
 *
 *   node experiments/property/providencia-agent.mjs   # or: npm run demo:property
 */
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = 'https://www.portalinmobiliario.com/venta/departamento/providencia-metropolitana'
const PAGES = 4
const C = { dim:(s)=>`\x1b[2m${s}\x1b[0m`, b:(s)=>`\x1b[1m${s}\x1b[0m`, g:(s)=>`\x1b[32m${s}\x1b[0m`, y:(s)=>`\x1b[33m${s}\x1b[0m`, c:(s)=>`\x1b[36m${s}\x1b[0m`, m:(s)=>`\x1b[35m${s}\x1b[0m`, r:(s)=>`\x1b[31m${s}\x1b[0m` }
const kit = (await build({ entryPoints:[join(root,'src/index.ts')], bundle:true, format:'iife', globalName:'BAK', write:false })).outputFiles[0].text

// the agent's "code action": uses the page to read listings (CodeAct-style).
// In a real loop the model writes this; here it's fixed for portalinmobiliario.
const EXTRACT = () => {
  const cards=[...document.querySelectorAll('.poly-card')]
  const txt=(c,x)=>(c.querySelector(x)?.textContent||'').replace(/\s+/g,' ').trim()
  return cards.map(c=>{
    const a=c.querySelector('a[href*="MLC-"]')||c.querySelector('a')
    return { attrs:txt(c,'.poly-attributes_list, [class*="attributes"]'),
      cur:txt(c,'.andes-money-amount__currency-symbol'), frac:txt(c,'.andes-money-amount__fraction'),
      title:txt(c,'.poly-component__title, h2, h3').slice(0,50), loc:txt(c,'.poly-component__location').slice(0,50), href:a?.href||'' }
  })
}

console.log(C.b(C.c('\n  Deal-finder · Providencia')) + C.dim('  ·  powered by browser-agent-kit (in-page)\n'))

const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--disable-blink-features=AutomationControlled'] })
const page = await browser.newPage()
const all = []
for (let i=0;i<PAGES;i++){
  process.stdout.write(C.dim(`  cargando página ${i+1}/${PAGES}…\r`))
  await page.goto(i===0?BASE:`${BASE}/_Desde_${i*48+1}`, { waitUntil:'domcontentloaded', timeout:30000 }).catch(()=>{})
  await page.waitForTimeout(3500)
  await page.addScriptTag({ content: kit })            // inject the kit into the real page
  if (i===0){
    const per = await page.evaluate(()=>{
      const BAK=window.BAK, kb=s=>Math.round(new Blob([s]).size/1024)
      const raw=document.body.outerHTML, ctx=BAK.serializePage({interactiveOnly:true})
      const g=BAK.groundByIntent('buscar propiedades')
      return { rawKB:kb(raw), ctxKB:kb(ctx), pct:Math.round(100*(1-new Blob([ctx]).size/new Blob([raw]).size)),
               ground:g?{label:g.label.slice(0,30),intents:g.intents}:null }
    })
    console.log(C.b(C.m('  PERCIBIR')) + C.dim(' (kit) ') + `DOM ${per.rawKB}KB → vista a11y ${C.g(per.ctxKB+'KB')} ${C.dim(`(${per.pct}% menos)`)}`)
    console.log(C.b(C.m('  UBICAR')) + C.dim('  (kit) ') + `intent "buscar propiedades" → ${C.c(per.ground?.label||'—')} ${C.dim('['+(per.ground?.intents||[]).join(',')+']')}`)
    console.log(C.b(C.m('  ACTUAR')) + C.dim('  (kit) ') + `el agente corre su código de extracción dentro de la página`)
  }
  all.push(...await page.evaluate(EXTRACT))
}
process.stdout.write('\n')
await browser.close()

// REASON: parse, UF/m², size-adjusted below-market
const seen=new Set(); const items=[]
for(const r of all){
  if(r.cur!=='UF'||/\d+\s*-\s*\d+\s*m²/.test(r.attrs)) continue
  const m2=+((r.attrs.match(/(\d+)\s*m²/)||[])[1]), uf=+(r.frac.replace(/\./g,''))
  if(!m2||!uf||m2<25||m2>400||uf<500) continue
  const id=(r.href.match(/MLC-?\d+/)||[r.href])[0]; if(seen.has(id)) continue; seen.add(id)
  items.push({ uf, m2, ufm2:uf/m2, title:r.title, loc:r.loc, dorm:(r.attrs.match(/(\d+)\s*dormitor/)||[])[1]||'', href:r.href })
}
if(items.length<10){ console.log(C.r('  pocas unidades extraídas.')); process.exit(0) }
const med=(a)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
const sorted=items.map(x=>x.ufm2).sort((a,b)=>a-b), q=p=>sorted[Math.floor(p*(sorted.length-1))]
for(const x of items){ const peers=items.filter(y=>y.m2>=x.m2*0.75&&y.m2<=x.m2*1.25).map(y=>y.ufm2); x.lm=med(peers); x.disc=1-x.ufm2/x.lm }

console.log(C.b(C.m('  RAZONAR')) + C.dim(` ${items.length} unidades · UF/m² mediana ${med(sorted).toFixed(1)} · p25 ${q(.25).toFixed(1)} · p75 ${q(.75).toFixed(1)}\n`))
const below=items.filter(x=>x.disc>=0.20).sort((a,b)=>b.disc-a.disc).slice(0,8)
console.log(C.b(`  ${below.length} candidatas bajo mercado (ajustado por tamaño):\n`))
for(const x of below){
  console.log(`  ${C.g('▼')} ${C.y(`-${Math.round(x.disc*100)}%`)} ${C.b(`${x.ufm2.toFixed(1)} UF/m²`)} ${C.dim(`(pares ~${x.m2}m²: ${x.lm.toFixed(0)})`)}  ${C.dim(`${x.uf.toLocaleString('es-CL')} UF · ${x.m2}m²${x.dorm?` · ${x.dorm}D`:''}`)}`)
  console.log(`    ${x.title||'(s/t)'}${x.loc?C.dim(' · '+x.loc):''}`)
  if(x.href) console.log(C.dim('    '+x.href.split('#')[0].slice(0,72)))
}
console.log(C.dim('\n  PERCIBIR+UBICAR+ACTUAR = browser-agent-kit in-page · RAZONAR = lógica de tasación encima.'))
console.log(C.dim('  "mercado" = precios pedidos, no tasaciones. Candidatas a inspeccionar.\n'))
