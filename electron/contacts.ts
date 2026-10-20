/**
 * People EchoFlow has been told to message. A new or similar name is confirmed
 * before a message is sent, so a misheard contact is not assumed.
 */
import { randomUUID } from 'node:crypto'
import type { SavedContact } from './types'
import { getContacts, saveContact } from './storage'

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024f\u0900-\u097f\u0C80-\u0CFF\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function distance(a: string, b: string): number {
  const s = norm(a)
  const t = norm(b)
  if (s === t) return 0
  if (!s || !t) return Math.max(s.length, t.length)
  const rows = Array.from({ length: s.length + 1 }, (_, i) => i)
  for (let j = 1; j <= t.length; j++) {
    let prev = rows[0]
    rows[0] = j
    for (let i = 1; i <= s.length; i++) {
      const cur = rows[i]
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      rows[i] = Math.min(rows[i] + 1, rows[i - 1] + 1, prev + cost)
      prev = cur
    }
  }
  return rows[s.length]
}

export function listContacts(app?: string): SavedContact[] {
  const all = getContacts()
  if (!app) return all
  const key = norm(app)
  return all.filter((c) => norm(c.app) === key)
}

export function rememberContact(name: string, app: string): SavedContact {
  const clean = name.trim()
  const existing = listContacts(app).find((c) => norm(c.name) === norm(clean))
  if (existing) return existing
  const created: SavedContact = {
    id: randomUUID(),
    name: clean,
    app: app.trim() || 'whatsapp',
    createdAt: Date.now(),
  }
  saveContact(created)
  return created
}

export function matchContact(
  spoken: string,
  app: string,
): { exact: SavedContact | null; suggestions: SavedContact[] } {
  const people = listContacts(app)
  const exact = people.find((c) => norm(c.name) === norm(spoken)) ?? null
  if (exact) return { exact, suggestions: [] }

  const suggestions = people
    .map((c) => ({ c, d: distance(spoken, c.name) }))
    .filter(({ c, d }) => {
      const limit = Math.max(2, Math.round(norm(c.name).length * 0.34))
      return d > 0 && d <= limit
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(({ c }) => c)

  return { exact: null, suggestions }
}

const YES =
  /^(yes|yeah|yep|yup|correct|right|that's right|that is right|thats right|send it|go ahead|do it|confirm)[.!]?$/i

export function isYes(reply: string): boolean {
  return YES.test(reply.trim())
}

/** Pull a corrected name out of "no, Raj" / "I meant Raj". */
export function nameFromReply(reply: string): string {
  return reply
    .trim()
    .replace(/^(no[,.]?\s+|not that[,.]?\s+|i meant\s+|it's\s+|it is\s+|send(?:\s+it)?\s+to\s+)/i, '')
    .trim()
}
