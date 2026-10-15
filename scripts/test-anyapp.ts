import { matchLocalCommand } from '../electron/commands/matcher'
import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'

const PHRASES = [
  'open calculator and search what 2 plus 2 is',
  'open calculator and calculate 55 times 3',
  'open cmd and show my ip address',
  'open notepad and write hello there',
]

async function main() {
  console.log('=== matcher routing ===')
  for (const p of [...PHRASES, 'open calculator', 'open chrome and search cats']) {
    const { action } = matchLocalCommand(p, [], [])
    console.log(
      JSON.stringify(p).padEnd(50),
      '→',
      action ? `${action.action} ${action.target ?? ''}` : '(gemini planner)',
    )
  }

  console.log('\n=== planner ===')
  const key = getGeminiApiKey()
  for (const p of PHRASES) {
    const t0 = Date.now()
    const a = await classifyWithGemini(key, p, ['Notepad', 'WhatsApp'])
    const detail =
      a.action === 'macro'
        ? (a.steps ?? [])
            .map((s) => `${s.action}(${JSON.stringify(s.target ?? s.responseText ?? '')})`)
            .join(' → ')
        : `${a.target ?? ''} ${JSON.stringify(a.responseText ?? '')}`
    console.log(`[${Date.now() - t0}ms]`.padEnd(9), JSON.stringify(p).padEnd(50), '→', a.action, detail)
  }
}

void main()
