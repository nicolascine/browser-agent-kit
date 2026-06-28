/**
 * The CodeAct loop: instead of returning a JSON plan, the model writes a small
 * JavaScript snippet that drives the page through the `agent` API. We execute it,
 * verify it worked, and (optionally) keep it as a reusable skill.
 *
 * NOTE: `new Function` is NOT a security sandbox. In a real browser the agent's
 * code would run in a sandboxed iframe with only the `agent` API exposed. This
 * prototype runs in Node to prove the loop end-to-end.
 */
import type { Agent } from './agent'

export type LLM = (prompt: string) => Promise<string>

export function buildPrompt(goal: string, observation: string): string {
  return `You are an agent running INSIDE a web page. Write a short async JavaScript
snippet that accomplishes the goal by driving the page. These are in scope:

  await agent.type(cssSelector, text)   // type into an input
  await agent.click(cssSelector)        // click an element
  agent.observe()                       // -> the accessibility view (string)

Use only CSS selectors you can see in the page below. Output ONLY the JavaScript
statements — no markdown fences, no function wrapper, no explanation.

## Page (accessibility view)
${observation}

## Goal
${goal}`
}

export function stripFences(s: string): string {
  const m = s.match(/```(?:js|javascript)?\n([\s\S]*?)```/)
  return (m ? m[1] : s).trim()
}

export async function writeCode(llm: LLM, goal: string, observation: string): Promise<string> {
  return stripFences(await llm(buildPrompt(goal, observation)))
}

export async function runCode(code: string, agent: Agent): Promise<void> {
  // eslint-disable-next-line no-new-func
  const fn = new Function('agent', `"use strict"; return (async () => {\n${code}\n})()`)
  await fn(agent)
}
