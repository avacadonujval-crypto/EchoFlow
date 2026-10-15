import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'

const CONNECTED = ['Notepad', 'WhatsApp', 'Microsoft Word', 'Spotify']

const CASES = [
  'open notepad write hello world and save it',
  'open word write a short leave letter make it bold and save',
  'open spotify and play my liked songs',
  'open notepad and write my shopping list milk eggs and bread',
  'just remember to call the electrician tomorrow',
]

async function main() {
  const key = getGeminiApiKey()
  for (const c of CASES) {
    const t0 = Date.now()
    const a = await classifyWithGemini(key, c, CONNECTED)
    const ms = Date.now() - t0
    const detail =
      a.action === 'macro'
        ? (a.steps ?? [])
            .map((s) => `${s.action}(${s.target ?? (s.responseText ?? '').slice(0, 30)})`)
            .join(' → ')
        : `target=${a.target ?? ''} text=${JSON.stringify((a.responseText ?? '').slice(0, 50))}`
    console.log(`[${ms}ms]`.padEnd(9), JSON.stringify(c).padEnd(62), '→', a.action, detail)
  }
}

void main()
