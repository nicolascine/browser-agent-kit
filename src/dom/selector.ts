/**
 * smart element selection - find elements by various strategies
 * designed for agent use: find the "best" match even with fuzzy descriptions
 */

export type SelectorStrategy = 'css' | 'text' | 'aria' | 'fuzzy'

export interface SelectorResult {
  element: Element
  confidence: number  // 0-1
  strategy: SelectorStrategy
  path: string
}

export function findElement(
  description: string,
  root: Element = document.body
): SelectorResult | null {
  // try strategies in order of specificity
  const strategies: Array<() => SelectorResult | null> = [
    () => tryCSSSelector(description, root),
    () => tryAriaSelector(description, root),
    () => tryTextMatch(description, root),
    () => tryFuzzyMatch(description, root),
  ]

  for (const strategy of strategies) {
    const result = strategy()
    if (result && result.confidence > 0.5) {
      return result
    }
  }

  return null
}

function tryCSSSelector(selector: string, root: Element): SelectorResult | null {
  try {
    const el = root.querySelector(selector)
    if (el) {
      return {
        element: el,
        confidence: 1.0,
        strategy: 'css',
        path: selector,
      }
    }
  } catch {
    // invalid css selector, thats fine
  }
  return null
}

function tryAriaSelector(description: string, root: Element): SelectorResult | null {
  // search by aria-label, role, name
  const candidates = root.querySelectorAll('[aria-label], [role], [name]')

  for (const el of Array.from(candidates)) {
    const label = el.getAttribute('aria-label') || ''
    const name = el.getAttribute('name') || ''

    if (label.toLowerCase().includes(description.toLowerCase()) ||
        name.toLowerCase().includes(description.toLowerCase())) {
      return {
        element: el,
        confidence: 0.9,
        strategy: 'aria',
        path: generatePath(el),
      }
    }
  }

  return null
}

function tryTextMatch(description: string, root: Element): SelectorResult | null {
  const lower = description.toLowerCase()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)

  let node: Node | null = walker.nextNode()
  while (node) {
    const el = node as Element
    const text = el.textContent?.toLowerCase() || ''

    if (text.includes(lower) && text.length < lower.length * 3) {
      // reasonably close match - not too much extra text
      return {
        element: el,
        confidence: 0.7,
        strategy: 'text',
        path: generatePath(el),
      }
    }
    node = walker.nextNode()
  }

  return null
}

function tryFuzzyMatch(description: string, root: Element): SelectorResult | null {
  // basic fuzzy: find element with closest text content
  const words = description.toLowerCase().split(/\s+/)
  let bestMatch: Element | null = null
  let bestScore = 0

  const allElements = root.querySelectorAll('*')

  for (const el of Array.from(allElements)) {
    const text = (el.textContent || '').toLowerCase()
    const matchedWords = words.filter(w => text.includes(w))
    const score = matchedWords.length / words.length

    if (score > bestScore && score > 0.3) {
      bestScore = score
      bestMatch = el
    }
  }

  if (bestMatch) {
    return {
      element: bestMatch,
      confidence: bestScore * 0.6, // fuzzy is less confident
      strategy: 'fuzzy',
      path: generatePath(bestMatch),
    }
  }

  return null
}

function generatePath(el: Element): string {
  if (el.id) return `#${el.id}`
  const tag = el.tagName.toLowerCase()
  const parent = el.parentElement
  if (!parent) return tag
  const idx = Array.from(parent.children).indexOf(el)
  return `${generatePath(parent)} > ${tag}:nth-child(${idx + 1})`
}
