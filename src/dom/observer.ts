/**
 * wraps MutationObserver to track DOM changes
 * useful for agents to understand what changed after an action
 */

export interface DOMChange {
  type: 'added' | 'removed' | 'modified' | 'text'
  target: string  // selector path
  details: string
  timestamp: number
}

export class DOMObserver {
  private observer: MutationObserver | null = null
  private changes: DOMChange[] = []
  private maxChanges: number

  constructor(maxChanges = 100) {
    this.maxChanges = maxChanges
  }

  start(root: Element = document.body): void {
    if (this.observer) this.stop()

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        this.processMutation(mutation)
      }
    })

    this.observer.observe(root, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
    })
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = null
  }

  getChanges(): DOMChange[] {
    return [...this.changes]
  }

  clearChanges(): void {
    this.changes = []
  }

  private processMutation(mutation: MutationRecord): void {
    const timestamp = Date.now()
    const target = this.getPath(mutation.target as Element)

    switch (mutation.type) {
      case 'childList':
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element) {
            this.addChange({
              type: 'added',
              target,
              details: `Added ${node.tagName.toLowerCase()}`,
              timestamp,
            })
          }
        }
        for (const node of Array.from(mutation.removedNodes)) {
          if (node instanceof Element) {
            this.addChange({
              type: 'removed',
              target,
              details: `Removed ${node.tagName.toLowerCase()}`,
              timestamp,
            })
          }
        }
        break

      case 'attributes':
        this.addChange({
          type: 'modified',
          target,
          details: `${mutation.attributeName}: ${mutation.oldValue} -> ${(mutation.target as Element).getAttribute(mutation.attributeName!)}`,
          timestamp,
        })
        break

      case 'characterData':
        this.addChange({
          type: 'text',
          target,
          details: `Text changed`,
          timestamp,
        })
        break
    }
  }

  private addChange(change: DOMChange): void {
    this.changes.push(change)
    // keep buffer bounded
    if (this.changes.length > this.maxChanges) {
      this.changes = this.changes.slice(-this.maxChanges)
    }
  }

  private getPath(el: Element): string {
    if (!el || !el.tagName) return 'unknown'
    if (el.id) return `#${el.id}`
    return el.tagName.toLowerCase()
  }
}
