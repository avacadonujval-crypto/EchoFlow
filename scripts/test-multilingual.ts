import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'
import { isNonLatinScript } from '../shared/languages'

const CASES = [
  { text: 'ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ', expect: 'open_app', target: 'notepad' },
  { text: 'कैलकुलेटर खोलो', expect: 'open_app', target: 'calculator' },
  { text: 'ವಾಟ್ಸಾಪ್ ತೆರೆ', expect: 'open_app', target: 'whatsapp' },
  { text: 'நோட்பேட் திற', expect: 'open_app', target: 'notepad' },
  { text: 'open notepad and type ನಮಸ್ಕಾರ', expect: 'macro' },
  { text: 'ನಾನು ನಾಳೆ ಶಾಪ್‌ಗೆ ಹೋಗುತ್ತೇನೆ', expect: 'dictate' },
]

async function main() {
  console.log('=== script detection ===')
  for (const s of ['hello world', 'ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ', 'open notepad']) {
    console.log(JSON.stringify(s), '→ nonLatin=', isNonLatinScript(s))
  }

  console.log('\n=== planner (text-only) ===')
  const key = getGeminiApiKey()
  for (const c of CASES) {
    const t0 = Date.now()
    const a = await classifyWithGemini(key, c.text, [], 'auto')
    const ok =
      a.action === c.expect &&
      (c.target ? (a.target ?? '').toLowerCase().includes(c.target) : true)
    console.log(
      ok ? '✓' : '✗',
      `[${Date.now() - t0}ms]`,
      c.text.slice(0, 45).padEnd(46),
      '→',
      a.action,
      a.target ?? '',
      (a.responseText ?? '').slice(0, 30),
    )
  }
}

void main()
