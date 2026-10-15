/**
 * Audit every capability listed in "EchoFlow - Everything It Can Do.docx".
 * Run: npx tsx scripts/test-features-audit.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { matchLocalCommand } from '../electron/commands/matcher'
import { listInstalledApps, resolveApp } from '../electron/appLauncher'
import { normalizeSpokenEmail, resolveEmailRecipient } from '../electron/email'
import { prepareSendEmail } from '../electron/emailPlan'
import { parseSendIt } from '../electron/sendIt'
import { classifyWithGemini } from '../electron/gemini'
import { wingetResolveId, wingetInstalledId } from '../electron/executor'
import { isNonLatinScript } from '../shared/languages'
import { getGeminiApiKey } from '../electron/secrets'
import type { ParsedAction } from '../shared/types'

type Result = { feature: string; status: 'pass' | 'fail' | 'partial' | 'skip'; detail: string }

const results: Result[] = []

function record(feature: string, status: Result['status'], detail: string) {
  results.push({ feature, status, detail })
  const icon = { pass: '✓', fail: '✗', partial: '~', skip: '-' }[status]
  console.log(`${icon} ${feature}: ${detail}`)
}

function assertMatch(input: string, expected: string, field: 'action' | 'target' | 'query' = 'action') {
  const { action } = matchLocalCommand(input, [], [])
  if (!action) return false
  const val = (action as Record<string, unknown>)[field]
  if (field === 'action') return action.action === expected
  if (typeof val === 'string') return val.toLowerCase().includes(String(expected).toLowerCase())
  return false
}

async function testMatcherExamples() {
  const cases: Array<[string, string, string?]> = [
    ['open whatsapp', 'open_app', 'whatsapp'],
    ['open calculator', 'open_app', 'calc'],
    ['open chrome', 'open_app', 'chrome'],
    ['open file explorer', 'open_app', 'explorer'],
    ['go to github.com', 'open_url', 'github'],
    ['open youtube and search lo-fi beats', 'youtube_search', 'lo-fi'],
    ['search for programming tutorials', 'web_search', 'programming'],
    ['open chrome and search best nike shoes', 'web_search', 'nike'],
    ['take a screenshot', 'system', 'screenshot'],
    ['volume up', 'system', 'volume_up'],
    ['volume down', 'system', 'volume_down'],
    ['mute', 'system', 'mute'],
    ['lock my computer', 'system', 'lock'],
    ['download telegram', 'install_app', 'telegram'],
    ['install vlc', 'install_app', 'vlc'],
    ['uninstall spotify', 'uninstall_app', 'spotify'],
    ['remove vlc', 'uninstall_app', 'vlc'],
    [
      'open whatsapp and send a message to Rahul saying I will be late',
      'send_message',
      'rahul',
    ],
    [
      'send an email to alex at gmail dot com saying I will be late',
      'send_email',
      'alex',
    ],
  ]

  let passed = 0
  for (const [input, action, hint] of cases) {
    const { action: a } = matchLocalCommand(input, [], [])
    const ok =
      a?.action === action &&
      (!hint ||
        [a.target, a.query, a.responseText]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .replace(/-/g, ' ')
          .includes(hint.toLowerCase().replace(/-/g, ' ')))
    if (ok) passed++
    else record('Matcher: ' + input.slice(0, 50), 'fail', `got ${a?.action ?? 'none'}`)
  }
  record(
    'Open apps, web, system, install/uninstall, messaging, email (local matcher)',
    passed === cases.length ? 'pass' : 'partial',
    `${passed}/${cases.length} example phrases matched correctly`,
  )
}

function testDictationVsCommand() {
  const dictation = matchLocalCommand('I think we should reschedule the meeting', [], [])
  const cmd = matchLocalCommand('open notepad', [], [])
  const ok =
    dictation.isDictation &&
    dictation.action?.action === 'dictate' &&
    cmd.action?.action === 'open_app'
  record(
    'Dictation vs command separation',
    ok ? 'pass' : 'fail',
    ok ? 'plain speech → dictate; open notepad → open_app' : 'classification wrong',
  )
}

function testSendIt() {
  const en = parseSendIt('hello world and send it')
  const kn = parseSendIt('ನಮಸ್ಕಾರ ಕಳುಹಿಸಿ')
  const ok = en.submit && en.text === 'hello world' && kn.submit
  record(
    '"And send it" + multilingual send tails',
    ok ? 'pass' : 'fail',
    `EN submit=${en.submit}, KN submit=${kn.submit}`,
  )
}

function testEmail() {
  const addr = normalizeSpokenEmail('alex at gmail dot com')
  const prep = prepareSendEmail({
    action: 'send_email',
    query: 'Sarah',
    responseText: 'hello',
    source: 'local',
    rawText: 'send email to Sarah saying hello',
  })
  const shortcut = resolveEmailRecipient('my email', 'me@test.com')
  const ok = addr === 'alex@gmail.com' && prep.missing.includes('to') && shortcut === 'me@test.com'
  record(
    'Email: spoken address, clarify flow, my-email shortcut',
    ok ? 'pass' : 'fail',
    `addr=${addr}, missing=${prep.missing.join(',')}, shortcut=${shortcut}`,
  )
}

async function testAppIndex() {
  const apps = await listInstalledApps()
  const resolves = await Promise.all(
    ['whatsapp', 'notepad', 'chrome', 'calculator', 'word'].map((n) => resolveApp(n)),
  )
  const count = apps.length
  const resolved = resolves.filter(Boolean).length
  record(
    'App index (140+ apps) + fuzzy resolve',
    count >= 50 && resolved >= 3 ? 'pass' : 'partial',
    `${count} apps indexed; ${resolved}/5 common names resolve (${resolves.join(', ')})`,
  )
}

async function testWinget() {
  const vlc = await wingetResolveId('vlc')
  const fake = await wingetResolveId('zzz-nonexistent-echoflow-xyz')
  record(
    'Install: winget resolve (community repo, not msstore-only)',
    vlc ? 'pass' : 'partial',
    `VLC id=${vlc ?? 'none'}; fake=${fake ?? 'null (expected)'}`,
  )
}

function testCodeModules() {
  const checks: Array<[string, string]> = [
    ['Voice: mic pre-roll', 'electron/micCapture.ts'],
    ['Voice: hotkey PTT', 'electron/hotkeys.ts'],
    ['Voice: overlay', 'electron/overlay.ts'],
    ['Voice: Gemini STT', 'electron/gemini.ts'],
    ['Chat clarify page', 'src/pages/ChatPage.tsx'],
    ['Settings: speech language', 'shared/languages.ts'],
    ['Storage: history/aliases', 'electron/storage.ts'],
    ['Send-it Enter key', 'electron/sendIt.ts'],
  ]
  let ok = 0
  for (const [name, file] of checks) {
    const exists = fs.existsSync(path.join(process.cwd(), file))
    if (exists) ok++
    else record(name, 'fail', `missing ${file}`)
  }
  record('Core modules present in codebase', ok === checks.length ? 'pass' : 'partial', `${ok}/${checks.length}`)
}

async function testGeminiPlanner() {
  const key = getGeminiApiKey()
  if (!key) {
    record('Gemini planner (complex + multilingual)', 'skip', 'no API key')
    return
  }

  const cases: Array<{ text: string; expect: string; hint?: string }> = [
    { text: 'open notepad and write a poem about rain', expect: 'macro' },
    { text: 'open notepad, write hello and save it', expect: 'macro' },
    { text: 'take a screenshot and open paint', expect: 'macro' },
    { text: 'open file explorer and see if I have a document called budget', expect: 'open_url', hint: 'search-ms' },
    { text: 'ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ', expect: 'open_app', hint: 'notepad' },
    { text: 'कैलकुलेटर खोलो', expect: 'open_app', hint: 'calc' },
    { text: 'open notepad and type ನಮಸ್ಕಾರ', expect: 'macro' },
    { text: 'ನಾನು ನಾಳೆ ಶಾಪ್‌ಗೆ ಹೋಗುತ್ತೇನೆ', expect: 'dictate' },
  ]

  let passed = 0
  for (const c of cases) {
    try {
      const a = await classifyWithGemini(key, c.text, [], 'auto')
      let ok = a.action === c.expect
      if (ok && c.hint) {
        const blob = JSON.stringify(a).toLowerCase()
        ok = blob.includes(c.hint.toLowerCase())
      }
      if (ok) passed++
      else
        record('Planner: ' + c.text.slice(0, 40), 'fail', `expected ${c.expect}, got ${a.action}`)
    } catch (e) {
      record('Planner: ' + c.text.slice(0, 40), 'fail', String(e))
    }
  }
  record(
    'Gemini planner: macros, file search, multilingual',
    passed >= cases.length - 1 ? 'pass' : passed >= cases.length - 3 ? 'partial' : 'fail',
    `${passed}/${cases.length} planner cases OK (needs internet + Gemini quota)`,
  )
}

async function testNonLatinSkipMatcher() {
  const kn = matchLocalCommand('ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ', [], [])
  const skip = isNonLatinScript('ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ') && !kn.action
  record(
    'Multilingual: non-Latin skips English-only matcher → Gemini',
    skip ? 'pass' : 'partial',
    skip ? 'Kannada routed to planner' : 'matcher returned action (may still work)',
  )
}

async function main() {
  console.log('=== EchoFlow Feature Audit (vs Everything It Can Do.docx) ===\n')

  await testMatcherExamples()
  testDictationVsCommand()
  testSendIt()
  testEmail()
  await testAppIndex()
  await testWinget()
  testCodeModules()
  await testNonLatinSkipMatcher()
  await testGeminiPlanner()

  console.log('\n=== SUMMARY ===')
  const pass = results.filter((r) => r.status === 'pass').length
  const partial = results.filter((r) => r.status === 'partial').length
  const fail = results.filter((r) => r.status === 'fail').length
  const skip = results.filter((r) => r.status === 'skip').length
  console.log(`Pass: ${pass} | Partial: ${partial} | Fail: ${fail} | Skip: ${skip}`)

  const cannotAutoTest = [
    'Live mic capture / whisper / muted-mic warning (needs hardware + PTT)',
    'Auto-paste into focused field (needs Electron UI + focused window)',
    'WhatsApp/Telegram UI automation (needs app open + contact exists)',
    'Gmail/Outlook send (needs browser signed in)',
    'Actual winget install/uninstall spawn (skipped — would modify system)',
    'Hub tap-to-speak / Apps task box (needs running Electron app)',
  ]
  console.log('\n=== Manual / live tests only ===')
  for (const line of cannotAutoTest) console.log('•', line)

  if (fail > 0) process.exit(1)
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
