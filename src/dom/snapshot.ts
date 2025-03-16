/**
 * captures a serializable snapshot of the current DOM state
 * designed to be compact enough to fit in LLM context windows
 */

export interface DOMSnapshot {
  url: string
  title: string
  timestamp: number
  tree: ElementNode[]
  interactiveElements: InteractiveElement[]
}

export interface ElementNode {
  tag: string
  id?: string
  classes?: string[]
  text?: string
  children?: ElementNode[]
  attrs?: Record<string, string>
  // unique selector path for this element
  path: string
}

export interface InteractiveElement {
  tag: string
  type?: string // input type
  path: string
  label?: string
  placeholder?: string
  value?: string
  role?: string
}

export function captureSnapshot(root: Document | Element = document): DOMSnapshot {
  const doc = root instanceof Document ? root : root.ownerDocument!

  return {
    url: doc.location?.href || '',
    title: doc.title || '',
    timestamp: Date.now(),
    tree: serializeTree(doc.body),
    interactiveElements: findInteractiveElements(doc.body),
  }
}

function serializeTree(element: Element, maxDepth = 8, depth = 0): ElementNode[] {
  if (depth >= maxDepth) return []

  const nodes: ElementNode[] = []

  for (const child of Array.from(element.children)) {
    // skip invisible elements
    if (isHidden(child)) continue
    // skip script/style tags
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(child.tagName)) continue

    const node: ElementNode = {
      tag: child.tagName.toLowerCase(),
      path: generateSelector(child),
    }

    if (child.id) node.id = child.id

    const classes = Array.from(child.classList).filter(c => !c.startsWith('_'))
    if (classes.length > 0) node.classes = classes

    // get direct text content (not from children)
    const directText = getDirectText(child)
    if (directText) node.text = directText.slice(0, 100) // truncate long text

    const children = serializeTree(child, maxDepth, depth + 1)
    if (children.length > 0) node.children = children

    nodes.push(node)
  }

  return nodes
}

function findInteractiveElements(root: Element): InteractiveElement[] {
  const selectors = 'a, button, input, select, textarea, [role="button"], [tabindex]'
  const elements = root.querySelectorAll(selectors)

  return Array.from(elements).map(el => {
    const elem: InteractiveElement = {
      tag: el.tagName.toLowerCase(),
      path: generateSelector(el),
    }

    if (el instanceof HTMLInputElement) {
      elem.type = el.type
      elem.value = el.value
      elem.placeholder = el.placeholder || undefined
    }

    // try to find a label
    const ariaLabel = el.getAttribute('aria-label')
    const title = el.getAttribute('title')
    const text = getDirectText(el)
    elem.label = ariaLabel || title || text || undefined

    const role = el.getAttribute('role')
    if (role) elem.role = role

    return elem
  }).filter(e => e.label || e.type) // only keep elements we can describe
}

function generateSelector(element: Element): string {
  if (element.id) return `#${element.id}`

  const parts: string[] = []
  let current: Element | null = element

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()

    if (current.id) {
      selector = `#${current.id}`
      parts.unshift(selector)
      break
    }

    // add nth-child if needed to be unique
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-child(${index})`
      }
    }

    parts.unshift(selector)
    current = current.parentElement
  }

  return parts.join(' > ')
}

function isHidden(element: Element): boolean {
  if (element instanceof HTMLElement) {
    return element.hidden || element.style.display === 'none' || element.style.visibility === 'hidden'
  }
  return false
}

function getDirectText(element: Element): string {
  const textNodes = Array.from(element.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent?.trim())
    .filter(Boolean)

  return textNodes.join(' ').trim()
}
