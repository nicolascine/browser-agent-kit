import { captureSnapshot, DOMSnapshot } from '../dom/snapshot'
import { extractA11yTree, A11yNode } from './accessibility'

/**
 * serializes the current page state into a compact text representation
 * optimized for LLM context windows
 *
 * the idea is: give the agent just enough info to understand the page
 * without blowing up the token count
 */

export interface SerializerOptions {
  includeTree?: boolean       // include DOM tree (default: false - uses a11y tree instead)
  maxLength?: number          // max output length in chars
  includeStyles?: boolean     // include computed styles (default: false)
  interactiveOnly?: boolean   // only show interactive elements
}

export function serializePage(options: SerializerOptions = {}): string {
  const {
    includeTree = false,
    maxLength = 4000,
    interactiveOnly = false,
  } = options

  const parts: string[] = []

  // page info
  parts.push(`# Page: ${document.title}`)
  parts.push(`URL: ${window.location.href}`)
  parts.push('')

  // a11y tree (preferred over raw DOM)
  if (!includeTree) {
    parts.push('## Page Structure (Accessibility Tree)')
    const tree = extractA11yTree()
    parts.push(formatA11yTree(tree, interactiveOnly))
  } else {
    // raw DOM snapshot
    const snapshot = captureSnapshot()
    parts.push('## Interactive Elements')
    for (const el of snapshot.interactiveElements) {
      const label = el.label || el.placeholder || el.type || 'unknown'
      parts.push(`- [${el.tag}] "${label}" -> ${el.path}`)
    }
  }

  let output = parts.join('\n')

  // truncate if needed
  if (maxLength && output.length > maxLength) {
    output = output.slice(0, maxLength) + '\n\n[truncated...]'
  }

  return output
}

function formatA11yTree(nodes: A11yNode[], interactiveOnly: boolean, indent = 0): string {
  const lines: string[] = []

  for (const node of nodes) {
    if (interactiveOnly && !node.interactive && !hasInteractiveChild(node)) {
      continue
    }

    const prefix = '  '.repeat(indent)
    let line = `${prefix}[${node.role}]`

    if (node.name) line += ` "${node.name}"`
    if (node.value) line += ` value="${node.value}"`
    if (node.interactive) line += ` *`  // mark interactive
    line += ` -> ${node.path}`

    lines.push(line)

    if (node.children) {
      lines.push(formatA11yTree(node.children, interactiveOnly, indent + 1))
    }
  }

  return lines.join('\n')
}

function hasInteractiveChild(node: A11yNode): boolean {
  if (!node.children) return false
  return node.children.some(c => c.interactive || hasInteractiveChild(c))
}
