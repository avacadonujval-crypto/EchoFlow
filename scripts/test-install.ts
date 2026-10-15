import { matchLocalCommand } from '../electron/commands/matcher'
import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'
import { executeAction, wingetResolveId, wingetInstalledId } from '../electron/executor'

async function main() {
  console.log('=== matcher ===')
  for (const p of [
    'download telegram',
    'install vlc',
    'download and install obs studio',
    'download the spotify app',
    'install whatsapp',
    'uninstall spotify',
    'remove vlc',
    'remove the obs studio app',
    'open notepad',
  ]) {
    const { action } = matchLocalCommand(p, [], [])
    console.log(
      JSON.stringify(p).padEnd(40),
      '→',
      action ? `${action.action} ${action.target ?? ''}` : '(gemini)',
    )
  }

  console.log('\n=== planner ===')
  const key = getGeminiApiKey()
  for (const p of [
    'can you download telegram for me',
    'get rid of spotify from my computer',
  ]) {
    const a = await classifyWithGemini(key, p, [])
    console.log(JSON.stringify(p).padEnd(40), '→', a.action, a.target ?? '')
  }

  console.log('\n=== winget resolve (search only, no install) ===')
  for (const n of ['vlc', 'telegram', 'obs studio', 'zzz-nonexistent-app-xyz']) {
    console.log(n.padEnd(30), '→', await wingetResolveId(n))
  }

  console.log('\n=== winget installed resolve (list only, no uninstall) ===')
  for (const n of ['whatsapp', 'spotify', 'zzz-nonexistent-app-xyz']) {
    console.log(n.padEnd(30), '→', await wingetInstalledId(n))
  }

  console.log('\n=== executor (safe paths only) ===')
  // Already installed → no install spawned
  const r1 = await executeAction(
    { action: 'install_app', target: 'whatsapp', source: 'local', rawText: 'install whatsapp' },
    { autoPaste: false },
  )
  console.log('install whatsapp →', JSON.stringify(r1))
}

void main()
