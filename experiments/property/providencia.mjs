/**
 * Find apartments listed BELOW the asking-price market rate in Providencia, Santiago.
 *
 *   node experiments/property/providencia.mjs
 *
 * Loads several pages of portalinmobiliario.com (real, public listings), extracts
 * individual resale units (UF price + m²), computes UF/m², and flags listings whose
 * UF/m² sits well under the median for the zone.
 *
 * HONEST CAVEAT: "market" here = the MEDIAN ASKING price/m² of *current listings*,
 * not real transaction values. Below-median can mean a deal — or older/lower-floor/
 * needs-work/bad-orientation. These are CANDIDATES TO INSPECT, not appraisals.
 */
import { chromium } from 'playwright-core'

const BASE = 'https://www.portalinmobiliario.com/venta/departamento/providencia-metropolitana'
const PAGES = 4
const C = { dim:(s)=>`\x1b[2m${s}\x1b[0m`, b:(s)=>`\x1b[1m${s}\x1b[0m`, g:(s)=>`\x1b[32m${s}\x1b[0m`, y:(s)=>`\x1b[33m${s}\x1b[0m`, c:(s)=>`\x1b[36m${s}\x1b[0m`, r:(s)=>`\x1b[31m${s}\x1b[0m` }

const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--disable-blink-features=AutomationControlled'] })
const page = await browser.newPage()
const all = []
for (let i=0;i<PAGES;i++){
  const url = i===0 ? BASE : `${BASE}/_Desde_${i*48+1}`
  process.stdout.write(C.dim(`  cargando página ${i+1}/${PAGES}…\r`))
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{})
  await page.waitForTimeout(3500)
  const rows = await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.poly-card')]
    const txt=(c,x)=>(c.querySelector(x)?.textContent||'').replace(/\s+/g,' ').trim()
    return cards.map(c=>{
      const attrs=txt(c,'.poly-attributes_list, [class*="attributes"]')
      const cur=txt(c,'.andes-money-amount__currency-symbol')
      const frac=txt(c,'.andes-money-amount__fraction')
      const a=c.querySelector('a[href*="MLC-"]')||c.querySelector('a')
      return { attrs, cur, frac, title:txt(c,'.poly-component__title, h2, h3').slice(0,50),
               loc:txt(c,'.poly-component__location').slice(0,50), href:(a?.href||'') }
    })
  })
  all.push(...rows)
}
process.stdout.write('\n')
await browser.close()

// keep individual UF units with a single m² (skip projects with ranges)
const seen=new Set(); const items=[]
for(const r of all){
  if(r.cur!=='UF') continue
  if(/\d+\s*-\s*\d+\s*m²/.test(r.attrs)) continue            // m² range = project, skip
  const m2=+( (r.attrs.match(/(\d+)\s*m²/)||[])[1] )
  const uf=+(r.frac.replace(/\./g,''))
  if(!m2||!uf||m2<25||m2>400||uf<500) continue
  const id=(r.href.match(/MLC-?\d+/)||[r.href])[0]
  if(seen.has(id)) continue; seen.add(id)
  const dorm=(r.attrs.match(/(\d+)\s*dormitor/)||[])[1]||''
  items.push({ uf, m2, ufm2: uf/m2, title:r.title, loc:r.loc, dorm, href:r.href })
}

if(items.length<10){ console.log(C.r('  muy pocas unidades individuales extraídas — el sitio cambió layout o bloqueó.')); process.exit(0) }

const ufm2=items.map(x=>x.ufm2).sort((a,b)=>a-b)
const q=(p)=>ufm2[Math.floor(p*(ufm2.length-1))]
const median=q(0.5), p25=q(0.25), p75=q(0.75)
const THRESH=0.80*median

console.log(C.b(C.c('\n  Departamentos bajo precio de mercado · Providencia'))+C.dim(`  ·  ${items.length} unidades individuales\n`))
console.log(`  UF/m²  mediana ${C.b(median.toFixed(1))}   ·   p25 ${p25.toFixed(1)}   ·   p75 ${p75.toFixed(1)}   ·   umbral "bajo mercado" < ${C.y(THRESH.toFixed(1))}\n`)

// distribution histogram (p5..p95)
const lo=q(0.05), hi=q(0.95), BINS=14
const counts=new Array(BINS).fill(0)
for(const v of ufm2){ if(v<lo||v>hi) continue; counts[Math.min(BINS-1,Math.floor((v-lo)/(hi-lo)*BINS))]++ }
const max=Math.max(...counts)
console.log(C.dim('  distribución UF/m²:'))
for(let i=0;i<BINS;i++){
  const a=lo+(hi-lo)*i/BINS
  const bar='█'.repeat(Math.round(counts[i]/max*32))
  const below=a<THRESH
  console.log(`  ${String(Math.round(a)).padStart(3)} ${below?C.y(bar):C.dim(bar)} ${C.dim(counts[i]||'')}`)
}

// size-adjusted: compare each unit vs the median UF/m² of SIMILAR-SIZE units
// (±25% m²) — controls for the fact that price/m² falls as size grows
const med=(arr)=>{const s=[...arr].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]}
for(const x of items){
  const peers=items.filter(y=>y.m2>=x.m2*0.75 && y.m2<=x.m2*1.25).map(y=>y.ufm2)
  x.localMedian=med(peers); x.discount=1-x.ufm2/x.localMedian
}
const below=items.filter(x=>x.discount>=0.20).sort((a,b)=>b.discount-a.discount).slice(0,10)
console.log(C.b(`\n  ${below.length} candidatas bajo mercado — ajustado por tamaño (vs unidades de m² similar):\n`))
for(const x of below){
  const pct=Math.round(x.discount*100)
  console.log(`  ${C.g('▼')} ${C.y(`-${pct}%`)} ${C.b(`${x.ufm2.toFixed(1)} UF/m²`)} ${C.dim(`(pares ~${x.m2}m²: ${x.localMedian.toFixed(0)})`)}  ${C.dim(`${x.uf.toLocaleString('es-CL')} UF · ${x.m2} m²${x.dorm?` · ${x.dorm}D`:''}`)}`)
  console.log(`    ${x.title||'(s/t)'}${x.loc?C.dim(' · '+x.loc):''}`)
  if(x.href) console.log(C.dim('    '+x.href.split('#')[0].slice(0,72)))
}
console.log(C.dim('\n  patrón: "barato para su tamaño" (vs pares de m² similar), no solo bajo la mediana global.'))
console.log(C.dim('  "mercado" = PRECIOS PEDIDOS actuales, no tasaciones. Candidatas a inspeccionar, no gangas garantizadas.\n'))
