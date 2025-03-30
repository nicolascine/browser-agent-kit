import { Action, ActionResult } from './registry'
import { findElement } from '../dom/selector'

export const clickAction: Action = {
  name: 'click',
  description: 'Click on an element identified by selector or description',
  parameters: [
    { name: 'target', type: 'string', required: true, description: 'CSS selector or text description of element to click' },
  ],
  execute: async (params): Promise<ActionResult> => {
    const target = params.target as string

    const result = findElement(target)
    if (!result) {
      return { success: false, message: `Could not find element: ${target}` }
    }

    const el = result.element as HTMLElement

    // scroll into view if needed
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // wait a bit for scroll
    await new Promise(r => setTimeout(r, 200))

    // simulate click
    el.click()

    return {
      success: true,
      message: `Clicked "${result.path}" (confidence: ${result.confidence.toFixed(2)}, strategy: ${result.strategy})`,
      data: { path: result.path, confidence: result.confidence },
    }
  },
}
