/**
 * Pull a spoken time out of a command ("at 4 pm", "in 20 minutes", "tomorrow at 9").
 * The matched phrase is removed from contact and message fields so it is not sent.
 */

export interface SpokenWhen {
  at: number
  phrase: string
}

function atClock(
  now: number,
  hour: number,
  minute: number,
  ampm: string | undefined,
  tomorrow: boolean,
): number {
  const base = new Date(now)
  if (tomorrow) base.setDate(base.getDate() + 1)

  const stamp = (h: number) => {
    const d = new Date(base)
    d.setHours(h, minute, 0, 0)
    return d.getTime()
  }

  if (ampm) {
    const pm = /^p/i.test(ampm)
    let h = hour % 12
    if (pm) h += 12
    let at = stamp(h)
    if (!tomorrow && at <= now + 20_000) {
      const d = new Date(at)
      d.setDate(d.getDate() + 1)
      at = d.getTime()
    }
    return at
  }

  if (hour >= 13) return stamp(hour)

  const am = stamp(hour % 12)
  const pm = stamp((hour % 12) + 12)
  const future = [am, pm].filter((t) => tomorrow || t > now + 20_000).sort((a, b) => a - b)
  if (future.length) return future[0]
  const next = new Date(pm)
  next.setDate(next.getDate() + 1)
  return next.getTime()
}

export function parseWhen(text: string, now = Date.now()): SpokenWhen | null {
  const source = text.trim()
  if (!source) return null

  const relative = /\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i.exec(source)
  if (relative) {
    const n = Number(relative[1])
    const hours = /^h/i.test(relative[2])
    const at = now + n * (hours ? 3_600_000 : 60_000)
    return { at, phrase: relative[0] }
  }

  const tomorrow = /\btomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i.exec(source)
  if (tomorrow) {
    return {
      at: atClock(now, Number(tomorrow[1]), Number(tomorrow[2] ?? 0), tomorrow[3], true),
      phrase: tomorrow[0],
    }
  }

  const clock = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i.exec(source)
  if (clock) {
    return {
      at: atClock(now, Number(clock[1]), Number(clock[2] ?? 0), clock[3], false),
      phrase: clock[0],
    }
  }

  const h24 = /\bat\s+(\d{1,2}):(\d{2})\b/i.exec(source)
  if (h24) {
    return {
      at: atClock(now, Number(h24[1]), Number(h24[2]), undefined, false),
      phrase: h24[0],
    }
  }

  const bare = /\bat\s+(\d{1,2})\b/i.exec(source)
  if (bare && Number(bare[1]) >= 1 && Number(bare[1]) <= 12) {
    return {
      at: atClock(now, Number(bare[1]), 0, undefined, false),
      phrase: bare[0],
    }
  }

  if (/\bat\s+noon\b/i.test(source)) {
    const phrase = source.match(/\bat\s+noon\b/i)?.[0] ?? 'at noon'
    return { at: atClock(now, 12, 0, 'pm', false), phrase }
  }
  if (/\bat\s+midnight\b/i.test(source)) {
    const phrase = source.match(/\bat\s+midnight\b/i)?.[0] ?? 'at midnight'
    return { at: atClock(now, 12, 0, 'am', false), phrase }
  }

  return null
}

export function stripPhrase(value: string | undefined, phrase: string): string | undefined {
  if (!value) return value
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const next = value
    .replace(new RegExp(escaped, 'i'), ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return next
}

export function formatWhen(at: number, now = Date.now()): string {
  const d = new Date(at)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const sameDay = new Date(now).toDateString() === d.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (sameDay) return time
  if (tomorrow.toDateString() === d.toDateString()) return `tomorrow at ${time}`
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`
}
