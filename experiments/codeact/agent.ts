/**
 * A tiny in-page agent surface that the model's CODE can call.
 * This is what gets exposed to LLM-written JavaScript (the "code action").
 */
import { typeAction } from '../../src/actions/type'
import { clickAction } from '../../src/actions/click'
import { serializePage } from '../../src/utils/serializer'
import { findElement } from '../../src/dom/selector'

export interface Agent {
  observe(): string
  type(target: string, text: string): Promise<void>
  click(target: string): Promise<void>
}

export function makeAgent(log: (m: string) => void): Agent {
  return {
    observe: () => serializePage({ interactiveOnly: true }),
    async type(target, text) {
      const r = await typeAction.execute({ target, text })
      log(`  · type  ${target} ← "${text}"  ${r.success ? '✓' : '✗ ' + r.message}`)
      if (!r.success) throw new Error(r.message)
    },
    async click(target) {
      const r = await clickAction.execute({ target })
      log(`  · click ${target}  ${r.success ? '✓' : '✗ ' + r.message}`)
      if (!r.success) throw new Error(r.message)
    },
  }
}
