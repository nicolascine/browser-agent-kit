/**
 * extracts a simplified accessibility tree from the DOM
 * this gives agents a semantic view of the page similar to
 * what screen readers see
 */

export interface A11yNode {
  role: string
  name?: string
  value?: string
  children?: A11yNode[]
  interactive: boolean
  path: string
}

export function extractA11yTree(root: Element = document.body): A11yNode[] {
  return processElement(root)
}

function processElement(element: Element, depth = 0): A11yNode[] {
  if (depth > 10) return []  // prevent infinite recursion

  const nodes: A11yNode[] = []

  for (const child of Array.from(element.children)) {
    // skip hidden elements
    if (child instanceof HTMLElement && (child.hidden || child.getAttribute('aria-hidden') === 'true')) {
      continue
    }

    const role = getRole(child)
    const name = getAccessibleName(child)
    const isInteractive = isInteractiveElement(child)

    // only include meaningful nodes
    if (role || name || isInteractive) {
      const node: A11yNode = {
        role: role || child.tagName.toLowerCase(),
        interactive: isInteractive,
        path: generatePath(child),
      }

      if (name) node.name = name

      // get value for inputs
      if (child instanceof HTMLInputElement || child instanceof HTMLTextAreaElement) {
        node.value = child.value
      }
      if (child instanceof HTMLSelectElement) {
        node.value = child.options[child.selectedIndex]?.text
      }

      const children = processElement(child, depth + 1)
      if (children.length > 0) node.children = children

      nodes.push(node)
    } else {
      // skip this node but process its children
      nodes.push(...processElement(child, depth + 1))
    }
  }

  return nodes
}

function getRole(el: Element): string | null {
  // explicit ARIA role
  const ariaRole = el.getAttribute('role')
  if (ariaRole) return ariaRole

  // implicit roles
  const roleMap: Record<string, string> = {
    'A': 'link',
    'BUTTON': 'button',
    'INPUT': 'textbox',
    'SELECT': 'combobox',
    'TEXTAREA': 'textbox',
    'IMG': 'img',
    'NAV': 'navigation',
    'MAIN': 'main',
    'HEADER': 'banner',
    'FOOTER': 'contentinfo',
    'H1': 'heading',
    'H2': 'heading',
    'H3': 'heading',
    'UL': 'list',
    'OL': 'list',
    'LI': 'listitem',
    'TABLE': 'table',
    'FORM': 'form',
  }

  return roleMap[el.tagName] || null
}

function getAccessibleName(el: Element): string | null {
  // aria-label takes precedence
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy)
    if (labelEl) return labelEl.textContent?.trim() || null
  }

  // for inputs, check associated label
  if (el instanceof HTMLInputElement && el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`)
    if (label) return label.textContent?.trim() || null
  }

  // alt text for images
  if (el instanceof HTMLImageElement) {
    return el.alt || null
  }

  // direct text for buttons, links, headings
  if (['BUTTON', 'A', 'H1', 'H2', 'H3', 'H4', 'LABEL'].includes(el.tagName)) {
    const text = el.textContent?.trim()
    if (text && text.length < 200) return text
  }

  return null
}

function isInteractiveElement(el: Element): boolean {
  const interactive = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']
  if (interactive.includes(el.tagName)) return true
  if (el.getAttribute('tabindex') !== null) return true
  if (el.getAttribute('onclick') !== null) return true
  if (el.getAttribute('role') === 'button') return true
  return false
}

function generatePath(el: Element): string {
  if (el.id) return `#${el.id}`
  return el.tagName.toLowerCase()
}
