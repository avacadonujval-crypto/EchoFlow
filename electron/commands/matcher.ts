import type { CommandAlias, Macro, ParsedAction, Snippet } from '../types'
import { parseSendIt } from '../sendIt'

const APP_CATALOG: Array<{ names: string[]; target: string; kind: 'app' | 'url' }> = [
  { names: ['chrome', 'google chrome'], target: 'chrome', kind: 'app' },
  { names: ['edge', 'microsoft edge'], target: 'msedge', kind: 'app' },
  { names: ['firefox'], target: 'firefox', kind: 'app' },
  { names: ['notepad'], target: 'notepad', kind: 'app' },
  { names: ['calculator', 'calc'], target: 'calc', kind: 'app' },
  { names: ['explorer', 'file explorer', 'files'], target: 'explorer', kind: 'app' },
  { names: ['spotify'], target: 'spotify:', kind: 'url' },
  { names: ['discord'], target: 'discord:', kind: 'url' },
  { names: ['slack'], target: 'slack:', kind: 'url' },
  { names: ['vscode', 'vs code', 'visual studio code', 'code'], target: 'code', kind: 'app' },
  { names: ['settings', 'windows settings'], target: 'ms-settings:', kind: 'url' },
  { names: ['youtube'], target: 'https://www.youtube.com', kind: 'url' },
  { names: ['gmail', 'mail'], target: 'https://mail.google.com', kind: 'url' },
  { names: ['google'], target: 'https://www.google.com', kind: 'url' },
  { names: ['twitter', 'x'], target: 'https://x.com', kind: 'url' },
  { names: ['github'], target: 'https://github.com', kind: 'url' },
  { names: ['notion'], target: 'https://www.notion.so', kind: 'url' },
]

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Like normalize, but keeps @ and . so email addresses survive. */
function normalizeKeepEmail(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s@.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyFindApp(name: string): { target: string; kind: 'app' | 'url' } | null {
  const n = normalize(name)
  for (const app of APP_CATALOG) {
    if (app.names.some((alias) => n.includes(alias) || alias.includes(n))) {
      return { target: app.target, kind: app.kind }
    }
  }
  return null
}

function escapePhrase(phrase: string): string {
  return phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
}

/** If the spoken line is or contains a snippet name, return the text to type. */
export function applySnippets(text: string, snippets: Snippet[]): string | null {
  const usable = snippets.filter((item) => item.phrase.trim() && item.expansion.trim())
  if (!usable.length || !text.trim()) return null

  const sorted = [...usable].sort((a, b) => b.phrase.trim().length - a.phrase.trim().length)
  const spoken = normalize(text)
  const exact = sorted.find((item) => normalize(item.phrase) === spoken)
  if (exact) return exact.expansion.trim()

  let result = text
  let changed = false
  for (const snippet of sorted) {
    const re = new RegExp(`(?:^|[\\s])${escapePhrase(snippet.phrase)}(?=$|[\\s.,!?;:])`, 'gi')
    if (!re.test(result)) continue
    re.lastIndex = 0
    result = result.replace(re, (full) => `${/^\s/.test(full) ? full[0] : ''}${snippet.expansion.trim()}`)
    changed = true
  }
  return changed ? result.replace(/[ \t]{2,}/g, ' ').trim() : null
}

function matchAlias(text: string, aliases: CommandAlias[]): ParsedAction | null {
  const n = normalize(text)
  const hit = aliases.find((a) => n === normalize(a.phrase) || n.includes(normalize(a.phrase)))
  if (!hit) return null
  return {
    action: hit.action,
    target: hit.target,
    query: hit.query,
    source: 'local',
    rawText: text,
  }
}

function matchMacro(text: string, macros: Macro[]): ParsedAction | null {
  const n = normalize(text)
  const hit = macros.find((m) => n === normalize(m.phrase) || n.includes(normalize(m.phrase)))
  if (!hit) return null
  return {
    action: 'macro',
    target: hit.phrase,
    steps: hit.steps.map((s) => ({
      action: s.action,
      target: s.target,
      query: s.query,
      source: 'local' as const,
      rawText: text,
    })),
    source: 'local',
    rawText: text,
  }
}

/** Detect intent-style commands vs plain dictation. */
function looksLikeCommand(text: string): boolean {
  const n = normalize(text)
  const starters = [
    'open',
    'launch',
    'start',
    'go to',
    'goto',
    'search',
    'look up',
    'find',
    'play',
    'close',
    'quit',
    'volume',
    'mute',
    'unmute',
    'lock',
    'screenshot',
    'take a screenshot',
    'show',
    'run',
    'navigate',
    'send',
    'message',
    'text',
    'reply to',
  ]
  return starters.some((s) => n.startsWith(s) || n.includes(` ${s} `))
}

/**
 * Local offline rules engine. Returns null when Gemini fallback should run
 * (command-like but unmatched) OR when text is plain dictation.
 */
export function matchLocalCommand(
  text: string,
  aliases: CommandAlias[],
  macros: Macro[],
): { action: ParsedAction | null; isDictation: boolean } {
  const raw = text.trim()
  if (!raw) return { action: null, isDictation: true }

  const aliasHit = matchAlias(raw, aliases)
  if (aliasHit) return { action: aliasHit, isDictation: false }

  const macroHit = matchMacro(raw, macros)
  if (macroHit) return { action: macroHit, isDictation: false }

  const n = normalize(raw)

  // "open whatsapp and send a message to X saying Y" / "send a message to X on whatsapp saying Y"
  const CHAT_APPS = 'whatsapp|telegram|teams|slack|discord|signal'
  const sendMsg =
    n.match(
      new RegExp(
        `(?:open\\s+)?(${CHAT_APPS})\\s+and\\s+send\\s+(?:a\\s+)?message\\s+to\\s+(.+?)\\s+(?:saying|that\\s+says|say(?:ing)?|telling(?:\\s+(?:him|her|them))?)\\s+(.+)`,
      ),
    ) ||
    n.match(
      new RegExp(
        `send\\s+(?:a\\s+)?message\\s+to\\s+(.+?)\\s+on\\s+(${CHAT_APPS})\\s+(?:saying|say)\\s+(.+)`,
      ),
    ) ||
    n.match(
      new RegExp(
        `send\\s+(?:a\\s+)?(${CHAT_APPS})\\s+message\\s+to\\s+(.+?)\\s+(?:saying|say)\\s+(.+)`,
      ),
    )
  if (sendMsg) {
    // Normalize capture order: app / contact / message
    const apps = CHAT_APPS.split('|')
    const app = apps.includes(sendMsg[1]) ? sendMsg[1] : sendMsg[2]
    const contact = apps.includes(sendMsg[1]) ? sendMsg[2] : sendMsg[1]
    const msgRaw =
      raw.match(/(?:saying|that says|say(?:ing)?|telling(?:\s+(?:him|her|them))?)\s+(.+)$/i)?.[1]?.trim() ??
      sendMsg[3].trim()
    const msg = parseSendIt(msgRaw)
    return {
      action: {
        action: 'send_message',
        target: app,
        query: contact.trim(),
        responseText: msg.text,
        submit: msg.submit || undefined,
        source: 'local',
        rawText: raw,
      },
      isDictation: false,
    }
  }

  // "send a message to X saying Y" (no app) → default WhatsApp
  const sendMsgDefault = n.match(
    /^send\s+(?:a\s+)?message\s+to\s+(.+?)\s+(?:saying|say)\s+(.+)/,
  )
  if (sendMsgDefault) {
    const msgRaw =
      raw.match(/(?:saying|say)\s+(.+)$/i)?.[1]?.trim() ?? sendMsgDefault[2].trim()
    const msg = parseSendIt(msgRaw)
    return {
      action: {
        action: 'send_message',
        target: 'whatsapp',
        query: sendMsgDefault[1].trim(),
        responseText: msg.text,
        submit: msg.submit || undefined,
        source: 'local',
        rawText: raw,
      },
      isDictation: false,
    }
  }

  // YouTube search: "open youtube and search for X" / "search youtube for X"
  const ytAndSearch =
    n.match(/(?:open\s+)?youtube(?:\s+and)?\s+(?:search(?:\s+for)?|find|look\s+up)\s+(.+)/) ||
    n.match(/search\s+(?:on\s+)?youtube\s+(?:for\s+)?(.+)/) ||
    n.match(/youtube\s+search\s+(?:for\s+)?(.+)/)
  if (ytAndSearch?.[1]) {
    return {
      action: {
        action: 'youtube_search',
        query: ytAndSearch[1].trim(),
        source: 'local',
        rawText: raw,
      },
      isDictation: false,
    }
  }

  // Google / web search
  const webSearch =
    n.match(/^(?:search(?:\s+the)?\s+web\s+(?:for\s+)?|google\s+|search\s+(?:for\s+)?|look\s+up\s+)(.+)/)
  if (webSearch?.[1] && !n.includes('youtube')) {
    return {
      action: {
        action: 'web_search',
        query: webSearch[1].trim(),
        source: 'local',
        rawText: raw,
      },
      isDictation: false,
    }
  }

  // "download X" / "install X" / "download and install X"
  const installMatch = n.match(
    /^(?:download(?:\s+and\s+install)?|install)\s+(?:the\s+)?(.+?)(?:\s+app(?:lication)?)?$/,
  )
  if (installMatch?.[1] && !installMatch[1].includes(' and ')) {
    return {
      action: {
        action: 'install_app',
        target: installMatch[1].trim(),
        source: 'local',
        rawText: raw,
      },
      isDictation: false,
    }
  }

  // "uninstall X" / "remove X"
  const uninstallMatch = n.match(
    /^(?:uninstall|remove)\s+(?:the\s+)?(.+?)(?:\s+app(?:lication)?)?$/,
  )
  if (uninstallMatch?.[1] && !uninstallMatch[1].includes(' and ')) {
    return {
      action: {
        action: 'uninstall_app',
        target: uninstallMatch[1].trim(),
        source: 'local',
        rawText: raw,
      },
      isDictation: false,
    }
  }

  // Email: "send an email to X from gmail saying Y" / "email X about Z saying Y"
  // Use a lighter normalize so addresses like bob@company.com keep @ and .
  {
    const e = normalizeKeepEmail(raw)
    const about = e.match(
      /^(?:send\s+(?:an?\s+)?(?:email|mail)|email|mail)\s+(?:to\s+)?(.+?)(?:\s+from\s+(gmail|outlook|hotmail))?\s+about\s+(.+?)\s+(?:saying|that\s+says)\s+(.+)$/,
    )
    const full = e.match(
      /^(?:send\s+(?:an?\s+)?(?:email|mail)|email|mail)\s+(?:to\s+)?(.+?)(?:\s+from\s+(gmail|outlook|hotmail))?(?:\s+(?:with\s+subject|subject)\s+(.+?))?\s+(?:saying|that\s+says)\s+(.+)$/,
    )
    const simple = e.match(
      /^(?:send\s+(?:an?\s+)?(?:email|mail)|email|mail)\s+(?:to\s+)?(.+?)\s+(?:saying|that\s+says)\s+(.+)$/,
    )

    let emailTo = ''
    let emailBody = ''
    let emailSubject: string | undefined
    let targetProvider: string | undefined

    if (about) {
      emailTo = about[1].trim()
      targetProvider = about[2]?.trim()
      emailSubject = about[3].trim()
      emailBody = about[4].trim()
    } else if (full) {
      emailTo = full[1].trim()
      targetProvider = full[2]?.trim()
      emailSubject = full[3]?.trim() || undefined
      emailBody = full[4].trim()
    } else if (simple) {
      emailTo = simple[1].trim()
      emailBody = simple[2].trim()
    }

    if (emailTo && emailBody) {
      if (targetProvider === 'hotmail') targetProvider = 'outlook'
      const bodyParsed = parseSendIt(emailBody)
      const headParsed = parseSendIt(raw)
      return {
        action: {
          action: 'send_email',
          target: targetProvider || undefined,
          query: emailTo,
          subject: emailSubject,
          responseText: bodyParsed.text,
          submit: bodyParsed.submit || headParsed.submit || undefined,
          source: 'local',
          rawText: raw,
        },
        isDictation: false,
      }
    }
  }

  // Open URL-ish
  const openMatch = n.match(/^(?:open|launch|start|go\s+to|goto|show|run)\s+(.+)/)
  if (openMatch?.[1]) {
    let rest = openMatch[1].trim()

    // "open chrome and go to youtube and search for X"
    const chainedYt = rest.match(
      /(.+?)\s+and\s+(?:go\s+to\s+)?youtube(?:\s+and)?\s+(?:search(?:\s+for)?|find)\s+(.+)/,
    )
    if (chainedYt) {
      return {
        action: {
          action: 'macro',
          target: 'open+youtube',
          steps: [
            {
              action: 'open_app',
              target: 'chrome',
              source: 'local',
              rawText: raw,
            },
            {
              action: 'youtube_search',
              query: chainedYt[2].trim(),
              source: 'local',
              rawText: raw,
            },
          ],
          source: 'local',
          rawText: raw,
        },
        isDictation: false,
      }
    }

    const andSearch = rest.match(/(.+?)\s+and\s+search(?:\s+for)?\s+(.+)/)
    if (andSearch) {
      const app = fuzzyFindApp(andSearch[1])
      const query = andSearch[2].trim()
      if (app && (normalize(andSearch[1]).includes('youtube') || app.target.includes('youtube'))) {
        return {
          action: {
            action: 'youtube_search',
            query,
            source: 'local',
            rawText: raw,
          },
          isDictation: false,
        }
      }
      // "open chrome and search X" → fresh guest window so existing
      // tabs/windows can't swallow the search (checked before the generic
      // google branch so "google chrome" keeps its browser target)
      if (app && ['chrome', 'msedge', 'firefox'].includes(app.target)) {
        return {
          action: {
            action: 'web_search',
            target: app.target,
            query,
            source: 'local',
            rawText: raw,
          },
          isDictation: false,
        }
      }
      if (app?.kind === 'url' || normalize(andSearch[1]).includes('google')) {
        return {
          action: {
            action: 'web_search',
            query,
            source: 'local',
            rawText: raw,
          },
          isDictation: false,
        }
      }
    }

    if (rest.startsWith('http://') || rest.startsWith('https://') || rest.includes('.com') || rest.includes('.org')) {
      const url = rest.startsWith('http') ? rest : `https://${rest.replace(/\s+/g, '')}`
      return {
        action: { action: 'open_url', target: url, source: 'local', rawText: raw },
        isDictation: false,
      }
    }

    // Compound requests ("open calculator and …") must keep the whole task —
    // let the Gemini planner build a multi-step macro instead of dropping
    // everything after "and".
    const app = rest.includes(' and ') ? null : fuzzyFindApp(rest)
    if (app) {
      return {
        action: {
          action: app.kind === 'url' ? 'open_url' : 'open_app',
          target: app.target,
          source: 'local',
          rawText: raw,
        },
        isDictation: false,
      }
    }

    // "open <anything>" — the launcher resolves any installed app
    // (WhatsApp, CMD, Word…) from the Start Menu catalog
    if (rest.split(' ').length <= 4 && !rest.includes(' and ')) {
      return {
        action: {
          action: 'open_app',
          target: rest,
          source: 'local',
          rawText: raw,
        },
        isDictation: false,
      }
    }
  }

  // System actions
  if (/^(take\s+a\s+)?screenshot$/.test(n) || n === 'capture screen') {
    return {
      action: { action: 'system', target: 'screenshot', source: 'local', rawText: raw },
      isDictation: false,
    }
  }
  if (/^volume\s+up$/.test(n) || n === 'increase volume' || n === 'turn up the volume') {
    return {
      action: { action: 'system', target: 'volume_up', source: 'local', rawText: raw },
      isDictation: false,
    }
  }
  if (/^volume\s+down$/.test(n) || n === 'decrease volume' || n === 'turn down the volume') {
    return {
      action: { action: 'system', target: 'volume_down', source: 'local', rawText: raw },
      isDictation: false,
    }
  }
  if (/^(mute|unmute)(\s+volume)?$/.test(n) || n === 'mute sound') {
    return {
      action: {
        action: 'system',
        target: n.includes('unmute') ? 'unmute' : 'mute',
        source: 'local',
        rawText: raw,
      },
      isDictation: false,
    }
  }
  if (/^lock(?:\s+(?:(?:my|the)\s+)?(?:screen|pc|computer))?$/i.test(n)) {
    return {
      action: { action: 'system', target: 'lock', source: 'local', rawText: raw },
      isDictation: false,
    }
  }

  if (looksLikeCommand(raw)) {
    // Command-like but unmatched → Gemini fallback
    return { action: null, isDictation: false }
  }

  // Plain dictation
  return {
    action: {
      action: 'dictate',
      responseText: raw,
      source: 'dictation',
      rawText: raw,
    },
    isDictation: true,
  }
}
