import { ActionRegistry } from './actions/registry'
import { clickAction } from './actions/click'
import { typeAction } from './actions/type'
import { navigateAction } from './actions/navigate'
import { ActionPlanner, Plan } from './planner/planner'
import { DOMObserver } from './dom/observer'
import { captureSnapshot, DOMSnapshot } from './dom/snapshot'
import { serializePage } from './utils/serializer'

export interface AgentConfig {
  llmCall: (prompt: string) => Promise<string>
  verbose?: boolean
}

export class BrowserAgent {
  private registry: ActionRegistry
  private planner: ActionPlanner
  private observer: DOMObserver
  private config: AgentConfig

  constructor(config: AgentConfig) {
    this.config = config
    this.registry = new ActionRegistry()
    this.observer = new DOMObserver()

    // register built-in actions
    this.registry.register(clickAction)
    this.registry.register(typeAction)
    this.registry.register(navigateAction)

    this.planner = new ActionPlanner(this.registry, {
      llmCall: config.llmCall,
      maxSteps: 10,
    })
  }

  /**
   * execute a goal described in natural language
   */
  async run(goal: string): Promise<{ success: boolean; results: any[] }> {
    this.observer.start()

    try {
      if (this.config.verbose) {
        console.log(`[BrowserAgent] goal: ${goal}`)
        console.log(`[BrowserAgent] planning...`)
      }

      const plan = await this.planner.plan(goal)

      if (this.config.verbose) {
        console.log(`[BrowserAgent] plan:`, plan.steps.map(s => `${s.action}: ${s.reasoning}`))
      }

      const results = await this.planner.executePlan(plan)
      const success = results.every(r => r.success)

      return { success, results }
    } finally {
      this.observer.stop()
    }
  }

  /**
   * get a snapshot of the current page state
   */
  snapshot(): DOMSnapshot {
    return captureSnapshot()
  }

  /**
   * get a text description of the page (for LLM context)
   */
  describe(): string {
    return serializePage()
  }

  /**
   * register a custom action
   */
  registerAction(action: Parameters<ActionRegistry['register']>[0]): void {
    this.registry.register(action)
  }

  /**
   * get list of DOM changes since last check
   */
  getChanges() {
    const changes = this.observer.getChanges()
    this.observer.clearChanges()
    return changes
  }
}
