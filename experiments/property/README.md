# Below-market property finder (Providencia)

Finds apartments listed **below the asking-price market rate** in Providencia, Santiago,
from real public listings on portalinmobiliario.com.

```bash
node experiments/property/providencia.mjs   # or: npm run demo:property
```

## How it works

1. Loads several pages of `venta/departamento/providencia-metropolitana` with Playwright.
2. Extracts **individual resale units** (UF price + m²), skipping project listings (m² ranges).
3. Computes **UF/m²** per unit and the zone distribution (median, p25, p75).
4. **Size-adjusts:** each unit is compared to the median UF/m² of *similar-size* units
   (±25% m²), because price/m² naturally falls as size grows. Flags units ≥20% under
   their size-peer median.
5. Prints a UF/m² histogram + the ranked candidates with real listing links.

## Honest methodology notes

- **"Market" = median ASKING price/m² of current listings**, not real transaction/appraisal
  values. Below-median can be a deal — or older / low floor / bad orientation / needs work /
  legal issue. These are **candidates to inspect, not appraisals**.
- One snapshot of current inventory; ~140 units; asking prices move.
- Size-adjustment controls the biggest confound (large units look cheap per m²) but not
  quality, floor, view, or condition — which the listing text doesn't reliably encode.
- This is **outside-in extraction** (Playwright), not the in-page agent. For pure data
  harvesting that's fine; the in-page approach matters for *interactive* tasks in a session.

## Sample (run it for live numbers)

```
144 unidades · UF/m² mediana 92.6 · p25 78.4 · p75 106.0
▼ -52%  45.2 UF/m²  4.200 UF · 93 m² · 3D — Metro Parque Bustamante
▼ -49%  47.7 UF/m²  5.100 UF · 107 m² · 3D — "Rebajado!!!" Barrio Italia
...
```
