import { Action, ActionResult } from './registry'
import { findElement } from '../dom/selector'

export const scrollDownAction: Action = {
  name: 'scroll_down',
  description: 'Scroll the page down by one viewport height',
  parameters: [],
  execute: async (): Promise<ActionResult> => {
    const before = window.scrollY
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' })

    await new Promise(r => setTimeout(r, 300))

    const after = window.scrollY
    if (after === before) {
      return { success: true, message: 'Already at bottom of page' }
    }

    return { success: true, message: `Scrolled down to ${after}px` }
  },
}

export const scrollUpAction: Action = {
  name: 'scroll_up',
  description: 'Scroll the page up by one viewport height',
  parameters: [],
  execute: async (): Promise<ActionResult> => {
    window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' })
    await new Promise(r => setTimeout(r, 300))
    return { success: true, message: `Scrolled up to ${window.scrollY}px` }
  },
}

export const scrollToAction: Action = {
  name: 'scroll_to_element',
  description: 'Scroll to bring a specific element into view',
  parameters: [
    { name: 'target', type: 'string', required: true, description: 'CSS selector or description of element to scroll to' },
  ],
  execute: async (params): Promise<ActionResult> => {
    const target = params.target as string
    const result = findElement(target)

    if (!result) {
      return { success: false, message: `Could not find element: ${target}` }
    }

    (result.element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
    await new Promise(r => setTimeout(r, 400))

    return {
      success: true,
      message: `Scrolled to "${result.path}"`,
      data: { path: result.path }
    }
  },
}
