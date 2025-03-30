import { Action, ActionResult } from './registry'
import { findElement } from '../dom/selector'

export const typeAction: Action = {
  name: 'type',
  description: 'Type text into an input field',
  parameters: [
    { name: 'target', type: 'string', required: true, description: 'CSS selector or description of the input field' },
    { name: 'text', type: 'string', required: true, description: 'Text to type' },
    { name: 'clear', type: 'boolean', required: false, description: 'Clear existing value first (default: true)' },
  ],
  execute: async (params): Promise<ActionResult> => {
    const target = params.target as string
    const text = params.text as string
    const clear = params.clear !== false

    const result = findElement(target)
    if (!result) {
      return { success: false, message: `Could not find input: ${target}` }
    }

    const el = result.element
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
      return { success: false, message: `Element is not an input field: ${result.path}` }
    }

    el.focus()

    if (clear) {
      el.value = ''
    }

    // simulate typing character by character
    for (const char of text) {
      el.value += char
      el.dispatchEvent(new Event('input', { bubbles: true }))
      // small delay between keystrokes
      await new Promise(r => setTimeout(r, 30 + Math.random() * 50))
    }

    el.dispatchEvent(new Event('change', { bubbles: true }))

    return {
      success: true,
      message: `Typed "${text}" into ${result.path}`,
    }
  },
}
