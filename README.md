# browser-agent-kit

A toolkit for building AI agents that operate inside the browser.

## What is this

Browser automation usually means Puppeteer/Playwright running headless from Node. But what if the agent runs *inside* the browser itself? Same page, same context, real DOM access.

browser-agent-kit gives you the building blocks:
- **DOM analysis**: Snapshot the page, extract accessibility tree, track mutations
- **Smart selection**: Find elements by CSS, ARIA labels, text content, or fuzzy matching
- **Actions**: Click, type, navigate - with a registry for custom actions
- **Planning**: Give the agent a goal in natural language, it figures out the steps

The agent uses an LLM (you bring your own) to understand the page and plan actions. It serializes the page into a compact text representation that fits in context windows.

## Install

```bash
npm install browser-agent-kit
```

## Quick start

```typescript
import { BrowserAgent } from 'browser-agent-kit'

const agent = new BrowserAgent({
  llmCall: async (prompt) => {
    // call your LLM here (OpenAI, Anthropic, local, etc)
    return await yourLLMFunction(prompt)
  },
  verbose: true,
})

// tell it what to do in natural language
await agent.run('Click the "Sign In" button, fill in email and password, then submit')
```

## How it works

1. Agent captures the page state (accessibility tree + interactive elements)
2. Serializes it into a compact text format for the LLM
3. LLM generates a plan (sequence of actions)
4. Agent executes each action, monitoring DOM changes
5. If something fails, it can re-plan (WIP)

## Page serialization

The key insight is that LLMs don't need the full DOM. They need a *semantic* view of the page - similar to what screen readers see. We extract the accessibility tree, filter to interactive elements, and format it as structured text.

This typically compresses a 50KB DOM into ~2-4KB of context.

## Custom actions

```typescript
import { BrowserAgent } from 'browser-agent-kit'

const agent = new BrowserAgent({ llmCall: myLLM })

agent.registerAction({
  name: 'scroll_down',
  description: 'Scroll the page down',
  parameters: [],
  execute: async () => {
    window.scrollBy(0, 500)
    return { success: true, message: 'Scrolled down' }
  }
})
```

## Architecture

```
BrowserAgent
├── ActionRegistry (built-in + custom actions)
├── ActionPlanner (LLM-based planning)
├── DOMObserver (mutation tracking)
└── Serializer
    ├── DOMSnapshot (raw DOM tree)
    └── A11yTree (accessibility view)
```

## Limitations

- Runs in browser context only (no Node.js / headless)
- No cross-origin navigation
- Planning quality depends on your LLM
- Doesn't handle iframes yet
- No screenshot/vision support (text-only page understanding)

## Why not just use Puppeteer?

Different use case. Puppeteer controls a browser from outside. This operates from inside - useful for:
- Browser extensions that need AI capabilities
- In-page AI assistants
- Testing tools that need semantic understanding
- Accessibility auditing with AI analysis

## TODO

- [ ] Re-planning on action failure
- [ ] Screenshot support for vision models
- [ ] iframe handling
- [ ] Session recording/replay
- [ ] More built-in actions (scroll, select, drag)

## License

MIT
