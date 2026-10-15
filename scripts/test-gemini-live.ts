import { testGeminiKey, classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'

async function main() {
  const t = await testGeminiKey()
  console.log('test', t)
  if (!t.ok) process.exit(1)
  const c = await classifyWithGemini(
    getGeminiApiKey(),
    'can you pull up yt and find something that teaches programming for beginners',
  )
  console.log('classify', c)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
