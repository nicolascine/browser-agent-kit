import { ActionRegistry, ActionResult } from '../actions/registry'
import { serializePage } from '../utils/serializer'

export interface Plan {
  goal: string
  steps: PlanStep[]
}

export interface PlanStep {
  action: string
  params: Record<string, any>
  reasoning: string
}

export interface PlannerConfig {
  // function that calls an LLM to generate a plan
  llmCall: (prompt: string) => Promise<string>
  maxSteps?: number
}

/**
 * the planner takes a goal and the current page state,
 * then uses an LLM to generate a sequence of actions
 */
export class ActionPlanner {
  private registry: ActionRegistry
  private config: PlannerConfig

  constructor(registry: ActionRegistry, config: PlannerConfig) {
    this.registry = registry
    this.config = config
  }

  async plan(goal: string): Promise<Plan> {
    const pageContext = serializePage({ interactiveOnly: true })
    const actionsDesc = this.registry.describe()

    const prompt = `You are a browser automation agent. Given the current page state and available actions, create a plan to achieve the goal.

## Current page
${pageContext}

## Available actions
${actionsDesc}

## Goal
${goal}

## Instructions
Return a JSON array of steps. Each step has: action (string), params (object), reasoning (string).
Only use available actions. Be specific with selectors.
Return ONLY the JSON array, no other text.`

    const response = await this.config.llmCall(prompt)

    // parse LLM response
    let steps: PlanStep[]
    try {
      steps = JSON.parse(response)
    } catch {
      // try to extract JSON from response
      const match = response.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('Could not parse plan from LLM response')
      steps = JSON.parse(match[0])
    }

    // validate steps
    const maxSteps = this.config.maxSteps || 10
    if (steps.length > maxSteps) {
      steps = steps.slice(0, maxSteps)
    }

    return { goal, steps }
  }

  async executePlan(plan: Plan): Promise<ActionResult[]> {
    const results: ActionResult[] = []

    for (const step of plan.steps) {
      console.log(`[agent] executing: ${step.action}`, step.params)
      console.log(`[agent] reasoning: ${step.reasoning}`)

      const result = await this.registry.execute(step.action, step.params)
      results.push(result)

      if (!result.success) {
        console.warn(`[agent] step failed: ${result.message}`)
        // could re-plan here but keeping it simple for now
        break
      }

      // wait between actions for page to update
      await new Promise(r => setTimeout(r, 500))
    }

    return results
  }
}
