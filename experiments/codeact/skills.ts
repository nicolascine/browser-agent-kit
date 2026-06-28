/**
 * Skill library. A skill is a piece of JavaScript the agent WROTE at runtime,
 * stored as a SKILL.md (à la agentskills.io) and reused later without an LLM.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'skills')

export interface Skill {
  name: string
  description: string
  site: string
  code: string
  path: string
}

export function saveSkill(s: Omit<Skill, 'path'>): string {
  const dir = join(DIR, s.name)
  mkdirSync(dir, { recursive: true })
  const md = `---
name: ${s.name}
description: ${s.description}
site: ${s.site}
author: agent (written at runtime)
---

The agent wrote this skill the first time it solved the task on ${s.site}.
On later runs it is loaded and executed directly — no LLM call.

\`\`\`js
${s.code.trim()}
\`\`\`
`
  const path = join(dir, 'SKILL.md')
  writeFileSync(path, md)
  return path
}

/** naive retrieval: same site + a shared keyword with the description */
export function findSkill(site: string, goal: string): Skill | null {
  if (!existsSync(DIR)) return null
  const kws = goal.toLowerCase().split(/\W+/).filter((w) => w.length > 4)
  for (const name of readdirSync(DIR)) {
    const p = join(DIR, name, 'SKILL.md')
    if (!existsSync(p)) continue
    const md = readFileSync(p, 'utf8')
    const fm = Object.fromEntries([...md.matchAll(/^(\w+):\s*(.+)$/gm)].map((m) => [m[1], m[2].trim()]))
    if (fm.site !== site) continue
    const code = (md.match(/```js\n([\s\S]*?)```/) || [, ''])[1]
    const desc = (fm.description || '').toLowerCase()
    if (kws.some((k) => desc.includes(k))) {
      return { name, description: fm.description, site, code, path: p }
    }
  }
  return null
}
