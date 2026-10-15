/**
 * Supported speech / command languages for Gemini STT and intent planning.
 */
export interface SpeechLanguageOption {
  code: string
  label: string
  nativeName?: string
}

export const SPEECH_LANGUAGES: SpeechLanguageOption[] = [
  { code: 'auto', label: 'Auto-detect', nativeName: 'Any language' },
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'Urdu', nativeName: 'اردو' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'ko', label: 'Korean', nativeName: '한국어' },
  { code: 'zh', label: 'Chinese', nativeName: '中文' },
]

const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
  SPEECH_LANGUAGES.filter((l) => l.code !== 'auto').map((l) => [l.code, l.label]),
)

export function languageLabel(code: string): string {
  return LANGUAGE_NAMES[code] ?? code
}

/** True when transcript is mostly non-Latin — skip English-only local matcher. */
export function isNonLatinScript(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  let nonLatin = 0
  for (const ch of t) {
    const c = ch.codePointAt(0) ?? 0
    if (c > 0x024f && !/\s/.test(ch)) nonLatin++
  }
  return nonLatin / t.length > 0.12
}

export function buildTranscribePrompt(speechLanguage: string): string {
  const langHint =
    speechLanguage === 'auto'
      ? `The speaker may use ANY language — English, Kannada (ಕನ್ನಡ), Hindi, Tamil, Telugu, Malayalam, Marathi, Bengali, Spanish, Arabic, etc., or a mix.
Auto-detect the language(s) from the audio.
Write each language in its native script (Kannada in Kannada script, Hindi in Devanagari, etc.) unless the speaker clearly used romanized words.`
      : `The speaker is primarily using ${languageLabel(speechLanguage)}.
Transcribe in the correct native script for that language.`

  return `You are EchoFlow's speech-to-text engine.
${langHint}

Transcribe the audio carefully. The speaker may whisper, mumble, speak quickly, or talk quietly.
Cleanup rules (apply while transcribing):
- Remove filler words (um, uh, hmm, ಅದು, मतलब, etc.) unless they carry meaning
- Add real punctuation. End every sentence with a period, question mark, or exclamation mark.
- Use commas where a speaker would pause. Do not return a run-on sentence.
- If the speaker says the words period, comma, question mark, exclamation point, colon, or new line, write the mark instead of the word.
- Keep every other word EXACTLY as spoken — never rephrase or translate to another language
- Preserve app/brand names (YouTube, Chrome, WhatsApp, Gmail, Notepad) as spoken
- Preserve "send it" / "ಕಳುಹಿಸು" / "भेज दो" and email phrases when spoken
- For email addresses spoken as "name at domain dot com", write name@domain.com or as spoken
Return ONLY the final text — no quotes, labels, or commentary.
If there is no speech, return an empty string.`
}

export const MULTILINGUAL_PLANNER_NOTE = `

MULTILINGUAL (critical):
- The transcript may be in ANY language or a mix (Kannada, Hindi, Tamil, Telugu, English, etc.).
- Understand intent in whatever language was spoken. Output the same JSON action types.
- open_app / install_app / uninstall_app: "target" = Windows app name in English when known (whatsapp, chrome, notepad, calculator, spotify…) even if the user spoke another language.
- web_search / youtube_search: "query" = search terms in the language the user spoke (do NOT translate search queries unless they spoke English).
- send_message: "query" = contact name EXACTLY as spoken (any script); "response_text" = message in the user's language — never translate.
- send_email: same — body/subject in user's language; recipient as spoken.
- dictate: "response_text" = exact content in the user's language and script — NEVER translate dictation to English.
- reply / clarify: respond in the SAME language the user spoke.
- SEND IT (press Enter after typing): strip phrases like English "send it", Kannada "ಕಳುಹಿಸು"/"ಕಳುಹಿಸಿ", Hindi "भेज दो"/"भेजो", Tamil "அனுப்பு", Telugu "పంపు" from message text — do not include them in response_text.
- Examples:
  - "ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ" (Kannada) → {"action":"open_app","target":"notepad"}
  - "ವಾಟ್ಸಾಪ್ ತೆರೆ ಮತ್ತು ರಾಹುಲ್ ಗೆ ನಮಸ್ಕಾರ ಎಂದು ಸಂದೇಶ ಕಳುಹಿಸು" → send_message, target whatsapp, query ರಾಹುಲ್, response_text ನಮಸ್ಕಾರ
  - "कैलकुलेटर खोलो" (Hindi) → open_app calculator
  - "open notepad and type ನಮಸ್ಕಾರ" → macro: open notepad, dictate "ನಮಸ್ಕಾರ"
  - "YouTube ನಲ್ಲಿ programming search ಮಾಡು" → youtube_search, query programming`
