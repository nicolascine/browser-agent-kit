import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

// note: we test selector logic with jsdom
// not ideal but good enough for unit tests

describe('selector strategies', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`
      <html>
        <body>
          <nav>
            <a href="/home" id="nav-home">Home</a>
            <a href="/about">About Us</a>
          </nav>
          <main>
            <h1>Welcome</h1>
            <form>
              <label for="email">Email</label>
              <input type="email" id="email" name="email" placeholder="you@example.com" />
              <button type="submit" aria-label="Send message">Submit</button>
            </form>
          </main>
        </body>
      </html>
    `)
  })

  it('should find element by id', () => {
    const doc = dom.window.document
    const el = doc.querySelector('#nav-home')
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe('Home')
  })

  it('should find interactive elements', () => {
    const doc = dom.window.document
    const inputs = doc.querySelectorAll('input, button, a')
    expect(inputs.length).toBe(4) // 2 links + 1 input + 1 button
  })

  it('should find element by aria-label', () => {
    const doc = dom.window.document
    const btn = doc.querySelector('[aria-label="Send message"]')
    expect(btn).not.toBeNull()
    expect(btn?.tagName).toBe('BUTTON')
  })

  it('should find input by placeholder', () => {
    const doc = dom.window.document
    const input = doc.querySelector('[placeholder="you@example.com"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('email')
  })
})
