/**
 * Everyday laptop and phone phrases, matched locally so they work without a guess.
 */
import type { ParsedAction } from './types'

function action(raw: string, partial: Omit<ParsedAction, 'source' | 'rawText'>): ParsedAction {
  return { source: 'local', rawText: raw, ...partial }
}

function clockReply(raw: string, kind: 'time' | 'date'): ParsedAction {
  const now = new Date()
  const text =
    kind === 'time'
      ? now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return action(raw, { action: 'reply', responseText: text })
}

export function matchDaily(raw: string, n: string): ParsedAction | null {
  if (/^(?:what(?:'s| is) the time|what time is it|tell me the time)$/.test(n)) return clockReply(raw, 'time')
  if (/^(?:what(?:'s| is) (?:the date|today)|what day is it|tell me the date)$/.test(n)) {
    return clockReply(raw, 'date')
  }

  if (/^(?:play|pause|resume)(?:\s+(?:the\s+)?(?:music|song|video|media))?$/.test(n)) {
    return action(raw, { action: 'system', target: 'media_play' })
  }
  if (/^next(?:\s+(?:track|song))?$/.test(n) || n === 'skip' || n === 'skip this song') {
    return action(raw, { action: 'system', target: 'media_next' })
  }
  if (/^(?:previous|prev)(?:\s+(?:track|song))?$/.test(n) || n === 'last song' || n === 'go back a song') {
    return action(raw, { action: 'system', target: 'media_prev' })
  }

  const playOn = n.match(/^play\s+(.+?)\s+on\s+(spotify|youtube)$/)
  if (playOn) {
    const query = playOn[1].trim()
    if (playOn[2] === 'youtube') return action(raw, { action: 'youtube_search', query })
    return action(raw, {
      action: 'open_url',
      target: `spotify:search:${encodeURIComponent(query)}`,
    })
  }

  if (/^(?:brightness|screen)\s+up$/.test(n) || n === 'brighter' || n === 'turn up the brightness') {
    return action(raw, { action: 'system', target: 'brightness_up' })
  }
  if (/^(?:brightness|screen)\s+down$/.test(n) || n === 'dimmer' || n === 'turn down the brightness' || n === 'dim the screen') {
    return action(raw, { action: 'system', target: 'brightness_down' })
  }

  if (/^(?:turn\s+)?(?:on\s+)?(?:wi\s*fi|wifi|wireless)(?:\s+on)?$/.test(n) || n === 'connect wifi' || n === 'connect to wifi') {
    return action(raw, { action: 'system', target: 'wifi_on' })
  }
  if (/^(?:turn\s+)?(?:off\s+)?(?:wi\s*fi|wifi|wireless)\s+off$/.test(n) || n === 'disconnect wifi' || n === 'turn off wifi' || n === 'turn wifi off') {
    return action(raw, { action: 'system', target: 'wifi_off' })
  }

  if (n === 'show desktop' || n === 'show the desktop') return action(raw, { action: 'system', target: 'show_desktop' })
  if (n === 'minimize' || n === 'minimize this window' || n === 'minimize the window') {
    return action(raw, { action: 'system', target: 'minimize' })
  }
  if (n === 'maximize' || n === 'maximize this window' || n === 'full screen this window') {
    return action(raw, { action: 'system', target: 'maximize' })
  }
  if (n === 'close this window' || n === 'close the window' || n === 'close window') {
    return action(raw, { action: 'system', target: 'close_window' })
  }
  if (n === 'switch window' || n === 'switch windows' || n === 'next window' || n === 'alt tab') {
    return action(raw, { action: 'system', target: 'switch_window' })
  }
  if (n === 'task view' || n === 'show windows') return action(raw, { action: 'system', target: 'task_view' })

  if (n === 'copy' || n === 'copy that' || n === 'copy this') return action(raw, { action: 'keys', target: '^c' })
  if (n === 'paste' || n === 'paste that' || n === 'paste this') return action(raw, { action: 'keys', target: '^v' })
  if (n === 'cut' || n === 'cut that') return action(raw, { action: 'keys', target: '^x' })
  if (n === 'undo' || n === 'undo that') return action(raw, { action: 'keys', target: '^z' })
  if (n === 'redo' || n === 'redo that') return action(raw, { action: 'keys', target: '^y' })
  if (n === 'select all') return action(raw, { action: 'keys', target: '^a' })

  const folder = n.match(
    /^(?:open|show)\s+(?:my\s+|the\s+)?(downloads|documents|desktop|pictures|photos|videos|recycle bin|camera|calendar|clock|phone|my phone|phone link|settings|bluetooth settings|wifi settings|display settings|sound settings)$/,
  )
  if (folder) {
    const name = folder[1]
    const urls: Record<string, string> = {
      downloads: 'shell:Downloads',
      documents: 'shell:Personal',
      desktop: 'shell:Desktop',
      pictures: 'shell:My Pictures',
      photos: 'ms-photos:',
      videos: 'shell:My Video',
      'recycle bin': 'shell:RecycleBinFolder',
      camera: 'microsoft.windows.camera:',
      calendar: 'outlookcal:',
      clock: 'ms-clock:',
      phone: 'ms-phone:',
      'my phone': 'ms-phone:',
      'phone link': 'ms-phone:',
      settings: 'ms-settings:',
      'bluetooth settings': 'ms-settings:bluetooth',
      'wifi settings': 'ms-settings:network-wifi',
      'display settings': 'ms-settings:display',
      'sound settings': 'ms-settings:sound',
    }
    return action(raw, { action: 'open_url', target: urls[name] })
  }

  if (/^(?:battery|battery level|how much battery|what(?:'s| is) my battery)(?:\s+(?:left|level|percentage))?$/.test(n)) {
    return action(raw, { action: 'system', target: 'battery' })
  }
  if (/^(?:turn\s+)?night light(?:\s+on|\s+off)?$/.test(n) || n === 'blue light') {
    return action(raw, { action: 'system', target: 'night_light' })
  }
  if (n === 'do not disturb' || n === 'focus' || n === 'turn on do not disturb' || n === 'turn off do not disturb') {
    return action(raw, { action: 'open_url', target: 'ms-settings:quiethours' })
  }

  if (n === 'sleep' || n === 'go to sleep' || n === 'sleep the computer' || n === 'put the computer to sleep') {
    return action(raw, { action: 'system', target: 'sleep' })
  }
  if (/^(?:shut down|shutdown|turn off)(?:\s+(?:the\s+)?(?:pc|computer|laptop))?$/.test(n)) {
    return action(raw, { action: 'system', target: 'shutdown' })
  }
  if (/^restart(?:\s+(?:the\s+)?(?:pc|computer|laptop))?$/.test(n) || n === 'reboot') {
    return action(raw, { action: 'system', target: 'restart' })
  }
  if (n === 'sign out' || n === 'log out' || n === 'log off') {
    return action(raw, { action: 'system', target: 'sign_out' })
  }
  if (n === 'empty recycle bin' || n === 'empty the recycle bin' || n === 'clear recycle bin') {
    return action(raw, { action: 'system', target: 'empty_recycle' })
  }

  if (/^(?:what(?:'s| is) the weather|weather|check the weather)(?:\s+(.+))?$/.test(n)) {
    const where = n.match(/weather(?:\s+(?:in|for))?\s+(.+)$/)?.[1]
    const q = where && where !== 'the weather' ? `weather ${where}` : 'weather'
    return action(raw, { action: 'web_search', query: q })
  }
  if (n === 'news' || n === 'show me the news' || n === "what's the news") {
    return action(raw, { action: 'web_search', query: 'news' })
  }

  const directions = n.match(/^(?:directions to|navigate to|take me to|how do i get to)\s+(.+)$/)
  if (directions) {
    return action(raw, {
      action: 'open_url',
      target: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directions[1])}`,
    })
  }
  const maps = n.match(/^(?:open\s+)?maps(?:\s+(?:for|of|to))?\s+(.+)$/)
  if (maps && maps[1] !== 'maps') {
    return action(raw, {
      action: 'open_url',
      target: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(maps[1])}`,
    })
  }

  const build = raw.match(
    /^(?:please\s+)?(?:build|make|create)\s+(?:me\s+)?(?:a\s+)?(?:new\s+)?(?:website|site|web\s*app|webapp|landing\s+page|app)\b(?:\s+(.+))?$/i,
  )
  if (build) {
    const extra = (build[1] ?? '').replace(/^(?:for|about|called|named)\s+/i, '').trim()
    return action(raw, {
      action: 'system',
      target: 'build',
      responseText: extra ? raw.trim() : '',
    })
  }

  const note = raw.match(/^(?:take|make|write)\s+(?:a\s+)?note(?:\s+(?:saying|that says))?\s+(.+)$/i)
  if (note?.[1]) {
    return action(raw, {
      action: 'macro',
      steps: [
        { action: 'open_app', target: 'notepad', source: 'local', rawText: raw },
        { action: 'dictate', responseText: note[1].trim(), source: 'local', rawText: raw },
      ],
    })
  }

  const timer = n.match(/^(?:set\s+)?(?:a\s+)?timer(?:\s+for)?\s+(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)$/)
  if (timer) {
    return action(raw, { action: 'system', target: 'notify', responseText: 'Timer' })
  }

  const remind = raw.match(/^remind me(?:\s+to)?\s+(.+)$/i)
  if (remind?.[1]) {
    return action(raw, { action: 'system', target: 'notify', responseText: remind[1].trim() })
  }

  const callNumber = n.match(/^call\s+(\+?\d[\d\s().-]{5,})$/)
  if (callNumber) {
    return action(raw, { action: 'system', target: 'call', query: callNumber[1] })
  }
  const callName = n.match(/^call\s+(.+)$/)
  if (callName && !callName[1].startsWith('me')) {
    return action(raw, { action: 'system', target: 'call', query: callName[1].trim() })
  }

  const text = raw.match(/^(?:text|sms|message)\s+(.+?)\s+(?:saying|say)\s+(.+)$/i)
  if (text && !n.startsWith('send ')) {
    return action(raw, {
      action: 'send_message',
      target: 'whatsapp',
      query: text[1].trim(),
      responseText: text[2].trim(),
    })
  }

  return null
}
