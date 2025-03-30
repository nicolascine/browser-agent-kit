import { Action, ActionResult } from './registry'

export const navigateAction: Action = {
  name: 'navigate',
  description: 'Navigate to a URL',
  parameters: [
    { name: 'url', type: 'string', required: true, description: 'URL to navigate to' },
  ],
  execute: async (params): Promise<ActionResult> => {
    const url = params.url as string

    try {
      // basic url validation
      new URL(url)
    } catch {
      return { success: false, message: `Invalid URL: ${url}` }
    }

    window.location.href = url

    // wait for navigation to start
    await new Promise(r => setTimeout(r, 100))

    return {
      success: true,
      message: `Navigating to ${url}`,
    }
  },
}
