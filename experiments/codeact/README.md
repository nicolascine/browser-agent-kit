# CodeAct + self-written skills (prototype)

A proof-of-concept: instead of the planner returning a JSON list of steps, the
model **writes JavaScript** that drives the page through a small `agent` API
(*code as action*). When the code works, it's saved as a `SKILL.md` and **reused
later without calling the LLM**.

It runs against the captured real DOM of `mercadopublico.cl`.

```bash
npx tsx experiments/codeact/run.ts                       # mock model, no key
ANTHROPIC_API_KEY=... npx tsx experiments/codeact/run.ts # Claude writes the code
# or: npm run demo:codeact
```

What you'll see:

- **Pass 1** — no skill exists → the model writes a snippet like
  `await agent.type('#txtBuscar', '…'); await agent.click('#btnBuscar')`, we run it
  inside the page, verify the search fired, and save it to
  `skills/buscar-licitacion/SKILL.md`.
- **Pass 2** — the skill exists → we load and run it directly. **Zero LLM calls.**

## Why this is interesting

| Piece | Prior art |
|-------|-----------|
| Code as action (LLM writes code, not JSON) | [CodeAct, ICML 2024](https://arxiv.org/abs/2402.01030) |
| Agent writes + stores its own skills | [Voyager](https://arxiv.org/abs/2305.16291) |
| Skills as portable `SKILL.md` | agentskills.io |

Each exists separately, and mostly server-side or in games. Doing it **inside the
live page** (same DOM, same session) is the gap this kit sits in.

## Caveats (read these)

- **`new Function` is not a sandbox.** This prototype executes the model's code in
  Node to prove the loop. In a browser, that code must run in a sandboxed `iframe`
  exposing only the `agent` API — executing model-written JS in a live authenticated
  session is the real risk to design around.
- **Verification is shallow** here (did the search submit with the term?). A real
  loop should verify via the DOM/accessibility diff after the action, and self-debug
  on failure (Voyager-style) before saving a skill.
- Retrieval is naive (same site + keyword). Real systems index skills by embeddings.

---

## Experiment 2: on-device embedding grounding (`ground-browser.mjs`)

Can a Web Worker / WASM embedding model let the agent ground "the help button" to the
right element **without asking the LLM**? Runs in real Chrome (onnxruntime-web/WASM)
on the real mercadopublico.cl DOM, comparing the kit's fuzzy selector vs. embeddings.

```bash
npm run demo:grounding   # downloads a small multilingual model on first run
```

### Honest result (not a clean win)

On ambiguous Spanish descriptions with little word overlap (e.g. *"asistencia al
usuario"* → *Centro de Ayuda*):

| | top-1 | top-3 |
|---|---|---|
| fuzzy (current selector) | 0/5 | 0/5 |
| embeddings (`multilingual-e5-small`, q8, scoped) | 1/5 | 3/5 |

**What this means, honestly:**

- The **plumbing works**: a quantized multilingual embedder runs in-browser on WASM,
  on the real page. The WASM/Worker thesis is real.
- **Fuzzy is useless for natural language** (0/5) — confirms the selector's weak spot.
- A **small on-device model is NOT a reliable last-mile picker.** e5 compresses cosine
  scores (~0.85 for everything) and generic CTAs ("Regístrate", "Descargar") pollute
  the top. It narrows, it doesn't decide.

**The realistic design is therefore hybrid — narrow-then-verify:** embeddings cut
56 elements → top-3 locally (cheap), then the agent *acts on the top candidate and
checks the accessibility-diff* (or asks the LLM to pick from 3). Local narrows; a
cheap verify confirms. Pure-local top-1 needs a bigger model (e5-base / bge-m3, a
~300MB–1GB download) — a real size/quality tradeoff to decide deliberately.
