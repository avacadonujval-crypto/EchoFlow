import { matchLocalCommand } from '../electron/commands/matcher'
import { resolveApp } from '../electron/appLauncher'

const phrases = [
  'open whatsapp and send a message to Chayapathi saying hello',
  'send a message to Rahul on whatsapp saying I will be late',
  'send a message to mom saying good night',
  'open whatsapp',
  'open cmd',
  'open command prompt',
  'open camera',
  'open word',
  'open spotify',
  'I will open the shop tomorrow and see how it goes',
  'the meeting went well today',
]

for (const p of phrases) {
  const { action, isDictation } = matchLocalCommand(p, [], [])
  console.log(
    JSON.stringify(p).padEnd(70),
    '→',
    action
      ? `${action.action} target=${action.target ?? ''} query=${action.query ?? ''} msg=${action.responseText ?? ''}`
      : `(gemini fallback) dictation=${isDictation}`,
  )
}

async function apps() {
  for (const name of ['whatsapp', 'cmd', 'camera', 'word', 'telegram', 'settings']) {
    console.log('resolve', name.padEnd(10), '→', await resolveApp(name))
  }
}
void apps()
