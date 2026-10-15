/**
 * Validate / complete send_email actions; ask in chat when slots are missing.
 */
import {
  looksLikeEmail,
  resolveEmailRecipient,
  isMyEmailShortcut,
  parseEmailProvider,
} from './email'
import { getSettings } from './storage'
import type { ParsedAction } from './types'
import type { PendingClarify } from './chat'

export function prepareSendEmail(action: ParsedAction): {
  ready: ParsedAction
  missing: PendingClarify['missing']
  question: string | null
} {
  const settings = getSettings()
  const draft: ParsedAction = {
    ...action,
    action: 'send_email',
  }

  // Normalize recipient — shortcuts ("my email") and spoken addresses
  if (draft.query) {
    draft.query = resolveEmailRecipient(draft.query, settings.myEmail)
  }

  // Provider: explicit → setting → gmail default; "ask" stays ask
  const parsed = parseEmailProvider(draft.target)
  if (parsed === 'gmail' || parsed === 'outlook') {
    draft.target = parsed
  } else if (parsed === 'ask' || draft.target === 'ask') {
    draft.target = 'ask'
  } else if (!draft.target) {
    draft.target =
      settings.defaultEmailClient === 'ask'
        ? 'ask'
        : settings.defaultEmailClient || 'gmail'
  } else {
    // Unknown target string — fall back to default
    draft.target =
      settings.defaultEmailClient === 'outlook' ? 'outlook' : 'gmail'
  }

  const missing: PendingClarify['missing'] = []
  if (!draft.query || !looksLikeEmail(draft.query, settings.myEmail)) missing.push('to')
  if (!draft.responseText?.trim()) missing.push('body')
  if (draft.target === 'ask') missing.push('provider')

  let question: string | null = null
  if (missing.includes('to')) {
    const who = draft.query?.trim() || 'them'
    if (isMyEmailShortcut(who) && !getSettings().myEmail) {
      question =
        'You said "my email" but I don\'t have your address yet — add it in Settings, or type it here.'
    } else if (looksLikeEmail(who, getSettings().myEmail)) {
      question = `I couldn't read that address. What's the full email address?`
    } else {
      question = `What's the email address for ${who}? (you can type e.g. name@gmail.com, or say "my email" if it's saved in Settings)`
    }
  } else if (missing.includes('provider')) {
    question =
      'Should I send this from Gmail or Outlook? Reply with "gmail" or "outlook".'
  } else if (missing.includes('body')) {
    question = 'What should the email say?'
  }

  return { ready: draft, missing, question }
}

/** Merge a short user reply into a pending email draft. */
export function mergeClarifyReply(
  draft: ParsedAction,
  missing: PendingClarify['missing'],
  reply: string,
): ParsedAction {
  const text = reply.trim()
  const next = { ...draft }
  const need = missing[0]

  if (need === 'provider') {
    const p = parseEmailProvider(text)
    if (p === 'gmail' || p === 'outlook') {
      next.target = p
    } else if (/^g/.test(text.toLowerCase())) {
      next.target = 'gmail'
    } else if (/^o/.test(text.toLowerCase())) {
      next.target = 'outlook'
    } else {
      // Keep ask — will re-prompt
      next.target = 'ask'
    }
    return next
  }

  if (need === 'to') {
    const settings = getSettings()
    next.query = resolveEmailRecipient(text, settings.myEmail)
    return next
  }

  if (need === 'body') {
    next.responseText = text
    return next
  }

  if (need === 'subject') {
    next.subject = text
    return next
  }

  // Free-form: try provider, then email, else treat as body
  const p = parseEmailProvider(text)
  if ((p === 'gmail' || p === 'outlook') && missing.includes('provider')) {
    next.target = p
    return next
  }
  const email = resolveEmailRecipient(text, getSettings().myEmail)
  if (looksLikeEmail(email, getSettings().myEmail) && missing.includes('to')) {
    next.query = email
    return next
  }
  if (missing.includes('body')) {
    next.responseText = text
  }
  return next
}
