/**
 * End-to-end smoke: local matcher + Gemini classify (main-process style).
 * Run: npx tsx scripts/test-app-flow.ts
 */
import { matchLocalCommand } from '../electron/commands/matcher'
import { classifyWithGemini, testGeminiKey } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'

async function main() {
  console.log('--- Local matcher ---')
  const samples = [
    'Open youtube and search for the best video which teaches us programming',
    'open chrome',
    'please remind me to drink water later',
  ]
  for (const input of samples) {
    const { action, isDictation } = matchLocalCommand(input, [], [])
    console.log(
      JSON.stringify({
        input,
        isDictation,
        action: action?.action,
        query: action?.query,
        target: action?.target,
        source: action?.source,
      }),
    )
  }

  const key = getGeminiApiKey()
  console.log('\n--- Gemini key present ---', key.length > 10)

  console.log('\n--- Gemini testKey ---')
  let result = await testGeminiKey(key)
  if (!result.ok && result.error?.includes('429')) {
    console.log('Quota 429 — waiting 35s then retry…')
    await new Promise((r) => setTimeout(r, 35000))
    result = await testGeminiKey(key)
  }
  console.log(result)

  if (result.ok) {
    console.log('\n--- Gemini classify (fuzzy command) ---')
    const classified = await classifyWithGemini(
      key,
      'can you pull up yt and find something that teaches programming for beginners',
    )
    console.log(classified)
  } else {
    console.log('\nSkipping classify — key test failed.')
    console.log(
      'Note: limit:0 on free tier usually means billing/quota is not enabled for this Google project.',
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
