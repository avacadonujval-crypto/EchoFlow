import type { ParsedAction } from './types'
import { getGeminiApiKeys } from './secrets'
import { buildTranscribePrompt, MULTILINGUAL_PLANNER_NOTE } from './languages'

const SYSTEM_PROMPT = `You are EchoFlow's intent planner for a Windows desktop voice assistant.

FIRST decide which of these the transcript is:
1. A PROCESS — the user is instructing the computer to DO something: open apps, search, send messages, control the system, or a multi-step workflow.
2. DICTATION — the user is just speaking text that should be written down (a sentence, thought, email body, notes). Never "execute" dictation, never drop or reword its words.

Return ONLY valid JSON (no markdown) with this shape:
{
  "action": "open_app" | "open_url" | "web_search" | "youtube_search" | "send_message" | "send_email" | "system" | "reply" | "dictate" | "macro" | "keys" | "install_app" | "uninstall_app" | "clarify" | "unknown",
  "target": "string or empty",
  "query": "string or empty",
  "response_text": "string or empty",
  "subject": "string or empty",
  "steps": []
}

Single-action rules:
- open_app: target is the app name as spoken (whatsapp, cmd, word, chrome, spotify, notepad…) — ANY installed app works, including Microsoft Store apps
- install_app: user wants to DOWNLOAD/INSTALL an app that isn't on the PC; target is the app name (e.g. "download telegram", "install vlc for me" → install_app, target telegram/vlc)
- uninstall_app: user wants to UNINSTALL/REMOVE an app from the PC; target is the app name (e.g. "uninstall spotify", "remove vlc from my computer" → uninstall_app, target spotify/vlc)
- open_url: target is a full https URL. Use for booking/travel sites (MakeMyTrip, Booking.com, IRCTC, Airbnb, Goibibo), Gmail, Outlook, Amazon orders, etc. EchoFlow opens these in the user's chosen Chrome account (signed-in profile) — do NOT use guest mode.
- youtube_search: query is the search terms; open YouTube search results
- web_search: query is Google search terms; if the user names a browser (chrome, edge, firefox), set target to that browser (e.g. "open chrome and search cats" → web_search, target chrome, query cats)
- send_message: user wants to send a chat message. target = app (whatsapp, telegram, teams… default whatsapp), query = contact/person name EXACTLY as spoken, response_text = the message text only. Leave clock times ("at 4 pm", "in 10 minutes") out of query and response_text.
- send_email: user wants to SEND an email (not just compose for dictation). target = "gmail" | "outlook" | "ask" (ask when they didn't say which AND it's ambiguous), query = recipient email address OR shortcut phrases "my email" / "email of mine" (EchoFlow resolves those to the user's saved address), subject = optional subject line, response_text = email body. Default provider is gmail when they say "email" / "send an email" without naming Outlook. EchoFlow asks which Chrome account to use if needed, then opens Gmail/Outlook in that signed-in profile. If the recipient is only a person's name with NO email address, still return send_email with query set to that name — EchoFlow will ask for the address in chat.
- SEND IT: when the user ends with "and send it" / "then send it", do NOT include those words in response_text — EchoFlow presses Enter automatically after typing.
- clarify: when a person, app, time, or instruction could mean more than one thing, ask ONE short question in response_text. Do not guess a contact, pick a similar name, or invent a missing detail. Prefer send_email / send_message with the words you actually heard over clarify when the name and message are clear.
- system: target is one of screenshot, volume_up, volume_down, mute, unmute, lock
- dictate: the words are content to be typed; put them in response_text EXACTLY as spoken (only fix punctuation)
  - Also use dictate when the user asks you to COMPOSE content (an email, message, note) WITHOUT asking to send it and WITHOUT naming an app to open: write the content yourself in response_text so it is typed into the focused field
- reply: conversational answer only (a question to the assistant); put the answer in response_text — never leave it empty
- unknown: cannot interpret

Email examples:
- "send an email to alex at gmail dot com saying I'll be late" → {"action":"send_email","target":"gmail","query":"alex@gmail.com","response_text":"I'll be late"}
- "email bob@company.com from outlook about the meeting saying can we reschedule" → {"action":"send_email","target":"outlook","query":"bob@company.com","subject":"the meeting","response_text":"can we reschedule"}
- "send an email to Sarah saying hello" → {"action":"send_email","target":"gmail","query":"Sarah","response_text":"hello"}
- "send that email from outlook or gmail" (ambiguous provider) → {"action":"send_email","target":"ask","query":"...","response_text":"..."}

Multi-step PROCESS (action "macro"):
- Use when the request needs MULTIPLE ordered steps (e.g. open an app THEN act inside it). "steps" is the ordered list; each step uses the same single-action fields above (never nest another macro).
- To write/type content inside an app after opening it, add a step {"action":"dictate","response_text":"<the text>"} — it types into the focused app.
- If the user asks you to COMPOSE content (a poem, email, note, list), write that content yourself in the step's response_text.
- keys step: {"action":"keys","target":"<SendKeys sequence>"} presses a keyboard shortcut in the focused app. Syntax: ^ = Ctrl, % = Alt, + = Shift; special keys in braces: {ENTER}, {TAB}, {ESC}, {DOWN}, {F5}. Examples: "^s" = Ctrl+S, "^n" = Ctrl+N, "^+p" = Ctrl+Shift+P.
- Only use keys for shortcuts you are CONFIDENT about (save ^s, new ^n, select all ^a, bold ^b, find ^f). Alt (%) sequences are forbidden. If you don't know a reliable shortcut for the task, just open the app and stop.
- Example: "open spotify and play my liked songs" → there is no reliable shortcut, so just {"action":"open_app","target":"spotify"}
- Example: "open notepad and write a poem about rain" →
  {"action":"macro","steps":[{"action":"open_app","target":"notepad"},{"action":"dictate","response_text":"<a short poem about rain>"}]}
- Example: "take a screenshot and open paint" →
  {"action":"macro","steps":[{"action":"system","target":"screenshot"},{"action":"open_app","target":"paint"}]}
- Example: "open notepad, write hello and save it" →
  {"action":"macro","steps":[{"action":"open_app","target":"notepad"},{"action":"dictate","response_text":"hello"},{"action":"keys","target":"^s"}]}
- WORKS FOR ANY APP: translate what the user wants to happen INSIDE the app into the exact characters to type (dictate step) and/or confident shortcuts (keys step). The dictate step sends real keystrokes to the focused app.
- Example: "open calculator and search what 2 plus 2 is" → Calculator takes typed input, so:
  {"action":"macro","steps":[{"action":"open_app","target":"calculator"},{"action":"dictate","response_text":"2+2="}]}
- Example: "open cmd and show my ip address" →
  {"action":"macro","steps":[{"action":"open_app","target":"cmd"},{"action":"dictate","response_text":"ipconfig\n"}]}
- End typed commands/calculations with "\n" or "=" when they must be submitted.
- FINDING FILES: to search the user's files/documents, use open_url with the Windows search protocol — {"action":"open_url","target":"search-ms:query=<file name>"} — it opens File Explorer showing matching files. Example: "open file explorer and see if I have a document called budget" → {"action":"open_url","target":"search-ms:query=budget"}
- BROWSER SEARCHES are ONE single web_search action (it opens the browser itself in a fresh window) — never add an open_app step for the browser. "open chrome and show me nike shoes" → {"action":"web_search","target":"chrome","query":"nike shoes"}
- NEVER put {KEY} sequences like {TAB} or {ENTER} inside dictate response_text — dictate is literal text only ("\n" for new lines is fine). Key presses always go in separate keys steps.`

const CONNECTED_APPS_NOTE = `

CONNECTED APPS:
The user has connected these apps for full in-app automation: {APPS}.
- For CONNECTED apps you may freely plan macros that operate INSIDE the app using dictate and keys steps (open the app first unless the user says it is already open).
- Use the connected app's exact name as the open_app target when the user refers to it.
- In-app automation works for ALL apps; the connected list just tells you the user's favorites and their exact names.`

const PROMPT_TAIL = `

COMMAND vs DICTATION:
- It is a PROCESS only when the user is instructing the computer (open/launch/send/search/play/take screenshot/lock/write in an app…).
- Example: "open whatsapp and send a message to Rahul saying I will be late" → send_message, target whatsapp, query Rahul, response_text "I will be late"
- Example: "I will open the shop tomorrow" → dictate (it's a sentence about the speaker, not an instruction to the computer)`

// Lite models first: same STT quality in testing, ~2x faster (no thinking)
const MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
] as const

// After a 429/5xx, skip that key+model combo for a while instead of
// paying a ~1s failed request on every voice session.
const COOLDOWN_MS = 5 * 60 * 1000
const cooldowns = new Map<string, number>()

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractText(data: unknown): string {
  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = d.candidates?.[0]?.content?.parts ?? []
  return parts
    .map((p) => p.text ?? '')
    .join('')
    .trim()
}

async function generateContent(
  apiKey: string,
  model: string,
  parts: unknown[],
  maxOutputTokens = 1024,
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens,
      },
    }),
  })
  const body = await res.text()
  if (!res.ok) return { ok: false, status: res.status, body }
  try {
    const text = extractText(JSON.parse(body))
    return { ok: true, text }
  } catch {
    return { ok: false, status: res.status, body: 'Invalid JSON response' }
  }
}

async function generateWithFallback(
  parts: unknown[],
  maxOutputTokens = 1024,
  apiKeyOverride?: string,
): Promise<string> {
  const keys = apiKeyOverride ? [apiKeyOverride, ...getGeminiApiKeys()] : getGeminiApiKeys()
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)))
  if (!uniqueKeys.length) {
    throw new Error('Speech is not set up on this install. Reinstall EchoFlow from the website.')
  }
  const errors: string[] = []

  for (const key of uniqueKeys) {
    for (const model of MODELS) {
      const comboId = `${model}/${key.slice(-4)}`
      const coolUntil = cooldowns.get(comboId) ?? 0
      if (Date.now() < coolUntil) {
        errors.push(`${comboId}→cooldown`)
        continue
      }
      const result = await generateContent(key, model, parts, maxOutputTokens)
      if (result.ok && result.text.trim()) return result.text
      if (result.ok && !result.text.trim()) {
        errors.push(`${comboId}→empty`)
        continue
      }
      if (!result.ok) {
        errors.push(`${comboId}→${result.status}`)
        if (result.status === 429 || result.status >= 500 || result.status === 404) {
          cooldowns.set(comboId, Date.now() + COOLDOWN_MS)
        }
      }
    }
  }

  console.error('[language] unavailable', errors.slice(0, 6).join(', '))
  throw new Error('Language service is temporarily unavailable')
}

export async function testGeminiKey(apiKey?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const text = await generateWithFallback(
      [{ text: 'Reply with exactly: OK' }],
      1024,
      apiKey,
    )
    if (!text.trim()) return { ok: false, error: 'Empty response' }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

const VALID_ACTIONS = new Set<string>([
  'dictate',
  'open_app',
  'open_url',
  'web_search',
  'youtube_search',
  'send_message',
  'system',
  'reply',
  'macro',
  'keys',
  'install_app',
  'uninstall_app',
  'send_email',
  'clarify',
  'unknown',
])

interface RawStep {
  action?: string
  target?: string
  query?: string
  response_text?: string
  subject?: string
}

export async function classifyWithGemini(
  apiKey: string,
  transcript: string,
  connectedApps: string[] = [],
  speechLanguage = 'auto',
): Promise<ParsedAction> {
  const connectedNote = connectedApps.length
    ? CONNECTED_APPS_NOTE.replace('{APPS}', connectedApps.join(', '))
    : ''
  const langNote =
    speechLanguage !== 'auto'
      ? `\nUser's preferred speech language: ${speechLanguage}.`
      : ''
  const prompt = `${SYSTEM_PROMPT}${MULTILINGUAL_PLANNER_NOTE}${connectedNote}${PROMPT_TAIL}${langNote}\n\nTranscript: """${transcript}"""`
  const text = await generateWithFallback(
    [{ text: prompt }],
    2048, // room for composed content in macro steps
    apiKey,
  )
  const cleaned = stripFences(text)

  let parsed: RawStep & { steps?: RawStep[]; subject?: string }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return {
      action: 'unknown',
      responseText: transcript,
      source: 'gemini',
      rawText: transcript,
    }
  }

  const action = (
    VALID_ACTIONS.has(parsed.action ?? '') ? parsed.action : 'unknown'
  ) as ParsedAction['action']

  // Models sometimes embed {TAB}/{ENTER} inside dictate text — split those
  // into real key presses so they aren't typed literally.
  const explodeDictate = (s: RawStep): RawStep[] => {
    const text = s.response_text ?? ''
    if (s.action !== 'dictate' || !/\{[A-Z0-9]+\}/.test(text)) return [s]
    return text
      .split(/(\{[A-Z0-9]+\})/)
      .filter(Boolean)
      .map((part) =>
        /^\{[A-Z0-9]+\}$/.test(part)
          ? { action: 'keys', target: part }
          : { action: 'dictate', response_text: part },
      )
  }

  let steps: ParsedAction[] | undefined
  if (action === 'macro' && Array.isArray(parsed.steps)) {
    steps = parsed.steps
      .filter(
        (s): s is RawStep =>
          !!s && VALID_ACTIONS.has(s.action ?? '') && s.action !== 'macro',
      )
      .flatMap(explodeDictate)
      // Alt sequences can switch windows / close apps — never execute them
      .filter((s) => !(s.action === 'keys' && (s.target ?? '').includes('%')))
      .map((s) => ({
        action: s.action as ParsedAction['action'],
        target: s.target || undefined,
        query: s.query || undefined,
        responseText: s.response_text || undefined,
        subject: s.subject || undefined,
        source: 'gemini' as const,
        rawText: transcript,
      }))
  }
  if (action === 'macro' && (!steps || steps.length === 0)) {
    return {
      action: 'unknown',
      responseText: transcript,
      source: 'gemini',
      rawText: transcript,
    }
  }

  return {
    action,
    target: parsed.target || undefined,
    query: parsed.query || undefined,
    responseText: parsed.response_text || undefined,
    subject: parsed.subject || undefined,
    steps,
    source: 'gemini',
    rawText: transcript,
  }
}

/** Speech-to-text for a single push-to-talk clip. */
export async function transcribeAudio(
  base64: string,
  mimeType: string,
  speechLanguage = 'auto',
): Promise<string> {
  const prompt = buildTranscribePrompt(speechLanguage)

  const raw = await generateWithFallback(
    [
      {
        inline_data: {
          mime_type: mimeType || 'audio/wav',
          data: base64,
        },
      },
      { text: prompt },
    ],
    2048,
  )

  const text = raw
    .replace(/^```[\s\S]*?\n/, '')
    .replace(/```$/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(transcript|transcription)\s*:\s*/i, '')
    .trim()

  // Models label non-speech audio like "<noise>" or "[Music]" — treat as empty
  if (/^[<[(].{0,30}[>\])]$/.test(text)) return ''
  return text
}

/**
 * Cleanup: remove fillers, fix punctuation, keep meaning.
 */
export async function cleanDictationText(transcript: string): Promise<string> {
  if (!transcript.trim()) return ''

  const prompt = `You are a transcription cleanup assistant.
Your ONLY allowed edits:
1. Delete filler words (um, uh, you know)
2. Fix punctuation and capitalization

STRICT RULES:
- Do NOT rephrase, reorder, replace, or add ANY words
- Do NOT "improve" grammar or word choice
- Every remaining word must appear exactly as in the input
- If unsure, return the input unchanged

CRITICAL: Respond with JSON only: {"text": "cleaned transcript"}

Transcript:
"""${transcript}"""`

  const raw = await generateWithFallback([{ text: prompt }], 1024)
  const cleaned = stripFences(raw)
  try {
    const parsed = JSON.parse(cleaned) as { text?: string }
    if (parsed.text && typeof parsed.text === 'string') return parsed.text.trim()
  } catch {
    // fall through
  }
  const m = cleaned.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (m) {
    try {
      return JSON.parse(`"${m[1]}"`) as string
    } catch {
      return m[1]
    }
  }
  return transcript.trim()
}
