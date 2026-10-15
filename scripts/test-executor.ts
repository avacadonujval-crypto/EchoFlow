/**
 * Execute a few safe actions (opens browser / notepad).
 * Run: npx tsx scripts/test-executor.ts
 */
import { executeAction } from '../electron/executor'
import { matchLocalCommand } from '../electron/commands/matcher'

async function run(transcript: string) {
  const { action } = matchLocalCommand(transcript, [], [])
  if (!action) {
    console.log('NO MATCH', transcript)
    return
  }
  console.log('ACTION', action.action, action.query ?? action.target)
  const result = await executeAction(action, { autoPaste: false })
  console.log('RESULT', result)
}

async function main() {
  await run('Open youtube and search for the best video which teaches us programming')
  await new Promise((r) => setTimeout(r, 1500))
  await run('open notepad')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
