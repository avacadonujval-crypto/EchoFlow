/**
 * Full E2E execution test — dummy text, real Windows actions.
 * Skips: lock PC (would lock screen).
 * Run: npx tsx scripts/test-e2e-full.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { matchLocalCommand } from '../electron/commands/matcher'
import { classifyWithGemini } from '../electron/gemini'
import { executeAction } from '../electron/executor'
import { getGeminiApiKey } from '../electron/secrets'
import { applySendItToAction } from '../electron/sendIt'
import type { ParsedAction } from '../shared/types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Row = { name: string; ok: boolean; detail: string; ms: number }

const rows: Row[] = []

async function run(name: string, fn: () => Promise<string>) {
  const t0 = Date.now()
  process.stdout.write(`\n▶ ${name}… `)
  try {
    const detail = await fn()
    const ms = Date.now() - t0
    rows.push({ name, ok: true, detail, ms })
    console.log(`✓ (${(ms / 1000).toFixed(1)}s) ${detail.slice(0, 120)}`)
  } catch (e) {
    const ms = Date.now() - t0
    const detail = e instanceof Error ? e.message : String(e)
    rows.push({ name, ok: false, detail, ms })
    console.log(`✗ (${(ms / 1000).toFixed(1)}s) ${detail}`)
  }
}

function fromMatcher(phrase: string): ParsedAction {
  const { action } = matchLocalCommand(phrase, [], [])
  if (!action) throw new Error(`Matcher missed: ${phrase}`)
  return applySendItToAction(action, phrase)
}

async function main() {
  console.log('=== EchoFlow FULL E2E (dummy data, real execution) ===')
  console.log('Windows will open apps/browsers — do not use the PC for ~3 min.\n')

  // ── 1. Open app ──
  await run('Open Notepad', async () => {
    const r = await executeAction(fromMatcher('open notepad'), { autoPaste: false })
    return r.message
  })
  await sleep(1500)

  // ── 2. Dictation + send it (into Notepad) ──
  await run('Dictate dummy text + Enter (send it)', async () => {
    const r = await executeAction(
      {
        action: 'dictate',
        responseText: 'EchoFlow E2E dummy dictation test.',
        submit: true,
        source: 'local',
        rawText: 'EchoFlow E2E dummy dictation test and send it',
      },
      { autoPaste: false },
    )
    return r.message
  })
  await sleep(800)

  // ── 3. Multi-step macro: notepad + poem + save ──
  await run('Macro: Notepad + dummy poem + Ctrl+S', async () => {
    const key = getGeminiApiKey()
    const action = await classifyWithGemini(
      key,
      'open notepad and write EchoFlow dummy poem line one and save it',
    )
    const r = await executeAction(action, { autoPaste: false })
    return `${action.action} → ${r.message}`
  })
  await sleep(2000)

  // ── 4. Web search (Chrome guest) ──
  await run('Chrome guest search (dummy query)', async () => {
    const r = await executeAction(fromMatcher('open chrome and search echoflow dummy test query'), {
      autoPaste: false,
    })
    return r.message
  })
  await sleep(2000)

  // ── 5. YouTube search ──
  await run('YouTube search (dummy)', async () => {
    const r = await executeAction(
      fromMatcher('open youtube and search echoflow dummy lo fi test'),
      { autoPaste: false },
    )
    return r.message
  })
  await sleep(1500)

  // ── 6. Open URL ──
  await run('Open URL (example.com)', async () => {
    const r = await executeAction(
      { action: 'open_url', target: 'https://example.com', source: 'local', rawText: '' },
      { autoPaste: false },
    )
    return r.message
  })
  await sleep(1000)

  // ── 7. File search ──
  await run('File search (search-ms dummy)', async () => {
    const key = getGeminiApiKey()
    const action = await classifyWithGemini(
      key,
      'open file explorer and see if I have a document called echoflow-dummy-budget',
    )
    const r = await executeAction(action, { autoPaste: false })
    return r.message
  })
  await sleep(1500)

  // ── 8. System: screenshot ──
  await run('Screenshot (Win+Shift+S)', async () => {
    const r = await executeAction(fromMatcher('take a screenshot'), { autoPaste: false })
    return r.message
  })
  await sleep(1000)

  // ── 9. System: volume up (harmless) ──
  await run('Volume up', async () => {
    const r = await executeAction(fromMatcher('volume up'), { autoPaste: false })
    return r.message
  })

  // ── 10. Install — already installed ──
  await run('Install (already-installed check: WhatsApp)', async () => {
    const r = await executeAction(fromMatcher('install whatsapp'), { autoPaste: false })
    return r.message
  })

  // ── 11. Install — Google fallback (fake app) ──
  await run('Install fallback (fake app → Google)', async () => {
    const r = await executeAction(
      {
        action: 'install_app',
        target: 'echoflow-fake-nonexistent-app-xyz',
        source: 'local',
        rawText: 'download echoflow-fake-nonexistent-app-xyz',
      },
      { autoPaste: false },
    )
    return r.message
  })
  await sleep(2000)

  // ── 12. Install — real winget (small: 7-Zip if not present) ──
  await run('Install real app via winget (7-Zip)', async () => {
    const r = await executeAction(fromMatcher('install 7zip'), { autoPaste: false })
    return r.message
  })
  await sleep(3000)

  // ── 13. Uninstall — fake name (opens settings, no removal) ──
  await run('Uninstall fallback (fake app → Settings)', async () => {
    const r = await executeAction(
      {
        action: 'uninstall_app',
        target: 'echoflow-fake-nonexistent-app-xyz',
        source: 'local',
        rawText: 'uninstall echoflow-fake-nonexistent-app-xyz',
      },
      { autoPaste: false },
    )
    return r.message
  })
  await sleep(1500)

  // ── 14. Email dummy ──
  await run('Email dummy (Gmail compose, dummy address)', async () => {
    const r = await executeAction(
      {
        action: 'send_email',
        target: 'gmail',
        query: 'echoflow.dummy.test@example.com',
        subject: 'EchoFlow E2E dummy',
        responseText: 'This is a dummy test message from EchoFlow automated E2E. Do not reply.',
        source: 'local',
        rawText: '',
      },
      { autoPaste: false },
    )
    return r.message
  })
  await sleep(2000)

  // ── 15. WhatsApp dummy message ──
  await run('WhatsApp dummy message (fake contact)', async () => {
    const r = await executeAction(
      applySendItToAction(
        {
          action: 'send_message',
          target: 'whatsapp',
          query: 'EchoFlow Dummy Contact XYZ',
          responseText: 'EchoFlow E2E dummy WhatsApp test — ignore this message.',
          source: 'local',
          rawText:
            'send a message to EchoFlow Dummy Contact XYZ saying EchoFlow E2E dummy WhatsApp test and send it',
        },
        'send a message to EchoFlow Dummy Contact XYZ saying EchoFlow E2E dummy WhatsApp test and send it',
      ),
      { autoPaste: false },
    )
    return r.message
  })
  await sleep(2000)

  // ── 16. Calculator macro ──
  await run('Open Calculator + type dummy math', async () => {
    const key = getGeminiApiKey()
    const action = await classifyWithGemini(key, 'open calculator and type 2+2=')
    const r = await executeAction(action, { autoPaste: false })
    return r.message
  })
  await sleep(1500)

  // ── 17. Automation file verify ──
  await run('Notepad automation file write verify', async () => {
    const file = path.join(process.env.TEMP ?? '', 'echoflow-e2e-verify.txt')
    fs.writeFileSync(file, '')
    const { spawn, execFile } = await import('node:child_process')
    const { runAutomation } = await import('../electron/executor')
    spawn('notepad.exe', [file], { detached: true, stdio: 'ignore' })
    await sleep(2500)
    await runAutomation([
      { text: 'EchoFlow E2E file verify dummy text.', delayMs: 300 },
      { keys: '^s', delayMs: 600 },
    ])
    await sleep(500)
    execFile('taskkill', ['/im', 'notepad.exe', '/f'])
    await sleep(400)
    const content = fs.readFileSync(file, 'utf8')
    fs.unlinkSync(file)
    if (!content.includes('EchoFlow E2E file verify')) throw new Error('File content mismatch')
    return 'File written and saved correctly'
  })

  // ── SUMMARY ──
  console.log('\n\n=== E2E RESULTS ===')
  const pass = rows.filter((r) => r.ok).length
  const fail = rows.filter((r) => !r.ok).length
  for (const r of rows) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name} (${(r.ms / 1000).toFixed(1)}s)`)
    if (!r.ok) console.log(`   → ${r.detail}`)
  }
  console.log(`\nTotal: ${pass} passed, ${fail} failed out of ${rows.length}`)
  console.log('Skipped: lock PC (would lock your screen)')

  if (fail > 0) process.exit(1)
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
