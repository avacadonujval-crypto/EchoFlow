import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'

const CASES = [
  'open notepad and write a poem about rain',
  'open notepad and type hello world this is a test',
  'take a screenshot and then open paint',
  'open calculator',
  'I think we should reschedule the meeting to Thursday afternoon',
  'this is just a note about what I did today',
  'open chrome and search for typescript generics',
  'write an email to my boss saying I will be on leave tomorrow',
]

async function main() {
  const key = getGeminiApiKey()
  for (const c of CASES) {
    const t0 = Date.now()
    const a = await classifyWithGemini(key, c)
    const ms = Date.now() - t0
    let detail = `target=${a.target ?? ''} query=${a.query ?? ''}`
    if (a.action === 'macro') {
      detail = (a.steps ?? [])
        .map(
          (s) =>
            `${s.action}(${s.target ?? s.query ?? (s.responseText ?? '').slice(0, 40)})`,
        )
        .join(' → ')
    } else if (a.action === 'dictate') {
      detail = JSON.stringify((a.responseText ?? '').slice(0, 60))
    }
    console.log(`[${ms}ms]`.padEnd(9), JSON.stringify(c).padEnd(70), '→', a.action, detail)
  }
}

void main()
