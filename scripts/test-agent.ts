/**
 * Thorough agent test: STT (single call), classifier, matcher, silence trim.
 */
import fs from 'node:fs'
import path from 'node:path'
import { transcribeAudio, classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'
import { matchLocalCommand } from '../electron/commands/matcher'
import { trimSilence } from '../electron/micCapture'

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  const result = await fn()
  console.log(`[${Date.now() - t0}ms]`.padEnd(9), label, '→', JSON.stringify(result).slice(0, 120))
  return result
}

async function main() {
  console.log('=== 1. STT (single call, clean output) ===')
  const wav = fs.readFileSync(path.join(process.env.TEMP ?? '', 'tts-direct.wav'))
  await timed('transcribe "Open notepad and start typing"', () =>
    transcribeAudio(wav.toString('base64'), 'audio/wav'),
  )

  console.log('\n=== 2. Silence trim ===')
  // 2s silence + speech + 2s silence
  const raw = wav.subarray(44)
  const silence = Buffer.alloc(32000 * 2)
  const padded = Buffer.concat([silence, raw, silence])
  const trimmed = trimSilence(padded)
  console.log(
    'padded',
    (padded.length / 32000).toFixed(2) + 's',
    '→ trimmed',
    (trimmed.length / 32000).toFixed(2) + 's',
    '(speech was', (raw.length / 32000).toFixed(2) + 's)',
  )

  console.log('\n=== 3. Local matcher ===')
  const matcherCases: Array<[string, string]> = [
    ['open whatsapp and send a message to Chayapathi saying hello', 'send_message'],
    ['send a message to mom saying good night', 'send_message'],
    ['open cmd', 'open_app'],
    ['open whatsapp', 'open_app'],
    ['open youtube and search for lo-fi beats', 'youtube_search'],
    ['take a screenshot', 'system'],
    ['volume up', 'system'],
    ['lock the screen', 'system'],
    ['the meeting went well today', 'dictate'],
  ]
  let pass = 0
  for (const [phrase, expected] of matcherCases) {
    const { action } = matchLocalCommand(phrase, [], [])
    const got = action?.action ?? '(gemini)'
    const ok = got === expected
    if (ok) pass++
    console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(phrase).padEnd(62), got)
  }
  console.log(`matcher: ${pass}/${matcherCases.length}`)

  console.log('\n=== 4. Gemini classifier (fallback path) ===')
  const key = getGeminiApiKey()
  await timed('classify "please open the calculator app for me"', () =>
    classifyWithGemini(key, 'please open the calculator app for me'),
  )
  await timed('classify "I will open the shop tomorrow"', () =>
    classifyWithGemini(key, 'I will open the shop tomorrow and see how it goes'),
  )
  await timed('classify "text Chayapathi that I am on my way"', () =>
    classifyWithGemini(key, 'text Chayapathi on whatsapp that I am on my way'),
  )
}

void main()
