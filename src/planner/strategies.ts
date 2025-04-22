/**
 * planning strategies for different types of browser tasks
 * these provide additional context to the planner
 */

export interface Strategy {
  name: string
  description: string
  systemPrompt: string
  maxSteps: number
}

export const strategies: Record<string, Strategy> = {
  'form-fill': {
    name: 'Form Filling',
    description: 'Fill out forms with provided data',
    systemPrompt: `You are filling out a web form. Match the provided data to the correct form fields.

Tips:
- Use the field labels to identify the correct inputs
- Fill fields in order from top to bottom
- Look for submit/save buttons after filling
- Check for required fields marked with *`,
    maxSteps: 20,
  },

  'navigation': {
    name: 'Navigation',
    description: 'Navigate through a website to find something',
    systemPrompt: `You are navigating a website to find specific content or a page.

Tips:
- Use navigation menus and links
- Look for search functionality first
- Check breadcrumbs for orientation
- Use browser back if you hit a dead end`,
    maxSteps: 15,
  },

  'data-extraction': {
    name: 'Data Extraction',
    description: 'Extract structured data from a page',
    systemPrompt: `You are extracting data from a web page into a structured format.

Tips:
- Identify the main content area first
- Look for tables, lists, and repeated patterns
- Scroll to load more content if needed
- Note pagination for multi-page data`,
    maxSteps: 10,
  },
}

export function getStrategy(name: string): Strategy | undefined {
  return strategies[name]
}
