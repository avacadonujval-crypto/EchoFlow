/**
 * Spoken → real email address, plus Gmail / Outlook compose URLs.
 */

/** Phrases that mean the user's own configured email address. */
const MY_EMAIL_PHRASES: RegExp[] = [
  /^my\s+email(?:\s+address)?$/,
  /^email\s+of\s+mine$/,
  /^my\s+mail(?:\s+address)?$/,
  /^my\s+address$/,
  /^mine$/,
  /^me$/,
  /^myself$/,
]

/** True if the spoken phrase refers to the user's own email shortcut. */
export function isMyEmailShortcut(raw: string): boolean {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return MY_EMAIL_PHRASES.some((re) => re.test(t))
}

/**
 * Resolve recipient: shortcuts ("my email", "email of mine") → myEmail,
 * then spoken forms → real address.
 */
export function resolveEmailRecipient(raw: string, myEmail?: string): string {
  const trimmed = raw.trim()
  if (myEmail && isMyEmailShortcut(trimmed)) return myEmail
  return normalizeSpokenEmail(trimmed) ?? trimmed
}

/** Turn "john at gmail dot com" / "john.smith@gmail.com" into a real address. */
export function normalizeSpokenEmail(raw: string): string | null {
  let s = raw.trim().toLowerCase()
  if (!s) return null

  // Already an address
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s

  // Spoken forms: "at" / "dot" / spaced punctuation
  s = s
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s*\(dot\)\s*/gi, '.')
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s+period\s+/gi, '.')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, '')

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s
  return null
}

export function looksLikeEmail(raw: string, myEmail?: string): boolean {
  if (myEmail && isMyEmailShortcut(raw)) return true
  return normalizeSpokenEmail(raw) !== null
}

export type EmailProvider = 'gmail' | 'outlook'

export function parseEmailProvider(raw?: string): EmailProvider | 'ask' | null {
  if (!raw) return null
  const n = raw.toLowerCase().trim()
  if (/(gmail|google\s*mail)/.test(n)) return 'gmail'
  if (/(outlook|hotmail|live\.com|microsoft\s*mail)/.test(n)) return 'outlook'
  if (/(ask|either|which|choose)/.test(n)) return 'ask'
  return null
}

export function buildGmailComposeUrl(opts: {
  to: string
  subject?: string
  body?: string
}): string {
  const params = new URLSearchParams()
  params.set('view', 'cm')
  params.set('fs', '1')
  params.set('to', opts.to)
  if (opts.subject) params.set('su', opts.subject)
  if (opts.body) params.set('body', opts.body)
  return `https://mail.google.com/mail/?${params.toString()}`
}

export function buildOutlookComposeUrl(opts: {
  to: string
  subject?: string
  body?: string
}): string {
  const params = new URLSearchParams()
  params.set('to', opts.to)
  if (opts.subject) params.set('subject', opts.subject)
  if (opts.body) params.set('body', opts.body)
  return `https://outlook.live.com/mail/0/deeplink/compose?${params.toString()}`
}

export function buildComposeUrl(
  provider: EmailProvider,
  opts: { to: string; subject?: string; body?: string },
): string {
  return provider === 'outlook'
    ? buildOutlookComposeUrl(opts)
    : buildGmailComposeUrl(opts)
}
