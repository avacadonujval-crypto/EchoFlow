/**
 * Lightweight smoke tests for the local command matcher (no Electron required).
 * Run: npx tsx scripts/test-matcher.ts
 */
import { matchLocalCommand } from '../electron/commands/matcher'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const cases: Array<{ input: string; action: string; query?: string }> = [
  {
    input: 'Open youtube and search for the best video which teaches us programming',
    action: 'youtube_search',
    query: 'the best video which teaches us programming',
  },
  { input: 'open chrome', action: 'open_app' },
  { input: 'search for react hooks', action: 'web_search' },
  { input: 'take a screenshot', action: 'system' },
  { input: 'Hello team, here are my notes', action: 'dictate' },
]

for (const c of cases) {
  const { action } = matchLocalCommand(c.input, [], [])
  assert(!!action, `Expected action for: ${c.input}`)
  assert(action!.action === c.action, `Expected ${c.action}, got ${action!.action} for: ${c.input}`)
  if (c.query) {
    assert(action!.query === c.query, `Query mismatch: ${action!.query}`)
  }
  console.log('ok', c.action, '←', c.input.slice(0, 50))
}

console.log('All matcher tests passed.')
