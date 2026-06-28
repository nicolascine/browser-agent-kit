# Deal-finder: below-market apartments in Providencia — *through the kit*

A new use case **of browser-agent-kit**, not around it: a deal-hunting agent that
lives in the page. It finds apartments listed below the asking-price market rate in
Providencia, Santiago, from real public listings on portalinmobiliario.com.

```bash
node experiments/property/providencia-agent.mjs   # or: npm run demo:property
```

## The agent's loop uses the kit

| stage | who | what |
|-------|-----|------|
| **PERCIBIR** | kit | the heavy SPA (~519 KB DOM) → a ~4 KB accessibility view (**99% smaller**) |
| **UBICAR** | kit | grounds controls by intent — `"buscar propiedades"` → `Buscar` `[search]` |
| **ACTUAR** | kit | the agent runs its extraction code **in-page**, against the real DOM |
| **RAZONAR** | task logic | UF/m² + size-adjusted below-market flagging |

`PERCIBIR + UBICAR + ACTUAR` is browser-agent-kit (compression + intent grounding +
in-page execution). `RAZONAR` is the appraisal logic layered on top. The extraction
code is fixed here; in the CodeAct loop the model would write it (see `../codeact`).

## Method & honest caveats

- Extracts **individual resale units** (UF + m²), skips project listings (m² ranges).
- **Size-adjusted:** each unit is compared to the median UF/m² of *similar-size* units
  (±25% m²), because price/m² falls as size grows — otherwise big units look like fake
  bargains. Flags units ≥20% under their size-peer median.
- **"Market" = median ASKING price/m² of current listings**, not transactions/appraisals.
  Below-median can be a deal — or low floor / bad orientation / needs work / legal issue.
  **Candidates to inspect, not appraisals.** One snapshot, ~140 units.

## Sample (run it for live numbers)

```
PERCIBIR (kit) DOM 519KB → vista a11y 4KB (99% menos)
UBICAR   (kit) intent "buscar propiedades" → Buscar [search]
RAZONAR  144 unidades · UF/m² mediana 92.9 · p25 78.4 · p75 106.0

▼ -52%  45.2 UF/m²  4.200 UF · 93m² · 3D — Metro Parque Bustamante
▼ -49%  47.7 UF/m²  5.100 UF · 107m² · 3D — "Rebajado!!!" Barrio Italia
...
```
