import { parseWhen, stripPhrase } from '../electron/when'
import { applySpokenSchedule, prepareMessage } from '../electron/messagePlan'
import type { ParsedAction } from '../shared/types'

const now = new Date('2026-10-20T10:00:00').getTime()

function at(text: string): string {
  const hit = parseWhen(text, now)
  if (!hit) return 'none'
  return `${new Date(hit.at).toLocaleString()} | ${hit.phrase}`
}

const cases = [
  'send a message to Chayapathi at 4 pm saying hello',
  'send a message to Chayapathi at 4:30 PM saying hello',
  'remind me in 20 minutes',
  'email Alex tomorrow at 9 am',
]
for (const line of cases) {
  console.log(line, '→', at(line))
}

const action: ParsedAction = {
  action: 'send_message',
  target: 'whatsapp',
  query: 'Chayapathi at 4 pm',
  responseText: 'hello',
  source: 'local',
  rawText: 'send a message to Chayapathi at 4 pm saying hello',
}
const scheduled = applySpokenSchedule(action, action.rawText)
console.log('stripped contact:', scheduled.query, 'at', scheduled.runAt && new Date(scheduled.runAt).toLocaleString())
console.log('phrase gone from hello?', stripPhrase('hello at 4 pm', 'at 4 pm'))

const ask = prepareMessage({
  action: 'send_message',
  target: 'whatsapp',
  query: 'Chayapathi',
  responseText: 'hello',
  source: 'local',
  rawText: 'send a message to Chayapathi saying hello',
})
console.log('first-time question:', ask.question)
