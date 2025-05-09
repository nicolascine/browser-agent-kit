import { BrowserAgent } from '../src/agent'

/**
 * Example: auto-fill a contact form
 *
 * This shows how to use BrowserAgent with any LLM provider
 * to fill out a web form from structured data
 */

// you'd replace this with your actual LLM call
async function callLLM(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  })

  const data = await response.json()
  return data.choices[0].message.content
}

const agent = new BrowserAgent({
  llmCall: callLLM,
  verbose: true,
})

// fill out a form
const result = await agent.run(`
  Fill out the contact form with:
  - Name: Nico Silva
  - Email: hello@example.com
  - Message: I'm interested in your services
  Then submit the form.
`)

console.log('Result:', result)
