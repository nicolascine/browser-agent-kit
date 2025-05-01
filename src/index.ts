export { BrowserAgent } from './agent'
export type { AgentConfig } from './agent'

// DOM utilities
export { captureSnapshot } from './dom/snapshot'
export type { DOMSnapshot, ElementNode, InteractiveElement } from './dom/snapshot'
export { findElement } from './dom/selector'
export type { SelectorResult, SelectorStrategy } from './dom/selector'
export { DOMObserver } from './dom/observer'
export type { DOMChange } from './dom/observer'

// Actions
export { ActionRegistry } from './actions/registry'
export type { Action, ActionParam, ActionResult } from './actions/registry'
export { clickAction } from './actions/click'
export { typeAction } from './actions/type'
export { navigateAction } from './actions/navigate'

// Planner
export { ActionPlanner } from './planner/planner'
export type { Plan, PlanStep, PlannerConfig } from './planner/planner'
export { strategies, getStrategy } from './planner/strategies'

// Utils
export { extractA11yTree } from './utils/accessibility'
export type { A11yNode } from './utils/accessibility'
export { serializePage } from './utils/serializer'
export type { SerializerOptions } from './utils/serializer'
