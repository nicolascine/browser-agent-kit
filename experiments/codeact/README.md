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
