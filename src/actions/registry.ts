export interface Action {
  name: string
  description: string
  parameters: ActionParam[]
  execute: (params: Record<string, any>) => Promise<ActionResult>
}

export interface ActionParam {
  name: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
  description: string
}

export interface ActionResult {
  success: boolean
  message: string
  data?: any
}

export class ActionRegistry {
  private actions = new Map<string, Action>()

  register(action: Action): void {
    this.actions.set(action.name, action)
  }

  get(name: string): Action | undefined {
    return this.actions.get(name)
  }

  list(): Action[] {
    return Array.from(this.actions.values())
  }

  // generate a description of all actions for LLM context
  describe(): string {
    return this.list().map(a => {
      const params = a.parameters.map(p =>
        `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
      ).join('\n')
      return `${a.name}: ${a.description}\n${params}`
    }).join('\n\n')
  }

  async execute(name: string, params: Record<string, any>): Promise<ActionResult> {
    const action = this.actions.get(name)
    if (!action) {
      return { success: false, message: `Unknown action: ${name}` }
    }

    // validate required params
    for (const param of action.parameters) {
      if (param.required && !(param.name in params)) {
        return { success: false, message: `Missing required parameter: ${param.name}` }
      }
    }

    try {
      return await action.execute(params)
    } catch (err) {
      return { success: false, message: `Action failed: ${(err as Error).message}` }
    }
  }
}
