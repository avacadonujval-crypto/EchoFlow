import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'
import { executeAction } from '../electron/executor'

async function main() {
  const phrase = 'open notepad and write a short two line poem about the sea'
  const t0 = Date.now()
  const action = await classifyWithGemini(getGeminiApiKey(), phrase)
  console.log(
    `plan [${Date.now() - t0}ms]:`,
    action.action,
    (action.steps ?? []).map((s) => s.action).join(' → '),
  )
  const t1 = Date.now()
  const result = await executeAction(action, { autoPaste: true })
  console.log(`execute [${Date.now() - t1}ms]:`, JSON.stringify(result))
}

void main()
