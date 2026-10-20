import { matchDaily } from '../electron/daily'

const lines = [
  'pause',
  'next song',
  'brightness up',
  'turn off wifi',
  'open downloads',
  'what time is it',
  'call mom',
  'call 9876543210',
  'text Chayapathi saying hello',
  'remind me to buy milk at 6 pm',
  'set a timer for 10 minutes',
  'directions to the airport',
  'shut down the computer',
  'take a note saying buy milk',
  'play boiling water on youtube',
]

for (const line of lines) {
  const n = line.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const hit = matchDaily(line, n)
  console.log(line, '→', hit ? `${hit.action} ${hit.target ?? ''} ${hit.query ?? ''} ${hit.responseText ?? ''}`.trim() : 'MISS')
}
