import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'

const CONNECTED = ['WhatsApp', 'Notepad', 'Google Chrome', 'File Explorer', 'Word']

const CASES: string[] = [
  'open file explorer and see if I have a document called progress',
  'open chrome and show me what nike shoes to buy now',
  'open word and write a thank you letter to my teacher',
  'open excel and create a monthly budget sheet',
  'open outlook and write an email to hr about sick leave',
  'open whatsapp and send a message to Chayapathi saying good evening',
  'open vs code and open my echoflow project',
  'open terminal and check my node version',
  'open git bash and show the git status',
  'open sticky notes and write buy groceries tomorrow',
  'open paint and draw a circle',
  'open photos and show my recent pictures',
  'open teams and message the project group saying meeting at 5',
  'open docker desktop and show my containers',
  'open claude and ask what is the capital of france',
]

async function main() {
  const key = getGeminiApiKey()
  let ok = 0
  for (const c of CASES) {
    const t0 = Date.now()
    try {
      const a = await classifyWithGemini(key, c, CONNECTED)
      const detail =
        a.action === 'macro'
          ? (a.steps ?? [])
              .map((s) => `${s.action}(${JSON.stringify((s.target ?? s.responseText ?? '').slice(0, 45))})`)
              .join(' → ')
          : `target=${JSON.stringify(a.target ?? '')} query=${JSON.stringify(a.query ?? '')}`
      console.log(`[${Date.now() - t0}ms]`.padEnd(9), JSON.stringify(c).padEnd(68), '→', a.action, detail)
      ok++
    } catch (err) {
      console.log('FAIL', JSON.stringify(c), err instanceof Error ? err.message : err)
    }
  }
  console.log(`\n${ok}/${CASES.length} classified without errors`)
}

void main()
