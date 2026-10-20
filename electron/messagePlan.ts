/**
 * Finish a send_message action, or ask who / what before anything is sent.
 */
import type { ParsedAction } from './types'
import type { PendingClarify } from './chat'
import { isYes, matchContact, nameFromReply, rememberContact } from './contacts'
import { formatWhen, parseWhen, stripPhrase } from './when'
import { mergeWebClarifyReply, prepareWebAction } from './webSessionPlan'
import { actionNeedsChromeAccount } from './chromeProfiles'

export function applySpokenSchedule(action: ParsedAction, transcript: string): ParsedAction {
  const when = parseWhen(transcript)
  if (!when) return action
  return {
    ...action,
    runAt: when.at,
    query: stripPhrase(action.query, when.phrase),
    responseText: stripPhrase(action.responseText, when.phrase),
    subject: stripPhrase(action.subject, when.phrase),
  }
}

export function prepareMessage(action: ParsedAction): {
  ready: ParsedAction
  missing: PendingClarify['missing']
  question: string | null
} {
  if (action.action !== 'send_message') {
    return { ready: action, missing: [], question: null }
  }

  const draft: ParsedAction = {
    ...action,
    target: (action.target || 'whatsapp').trim() || 'whatsapp',
  }
  const app = draft.target || 'whatsapp'
  const contact = draft.query?.trim() ?? ''
  const body = draft.responseText?.trim() ?? ''

  if (!contact) {
    return {
      ready: draft,
      missing: ['contact'],
      question: 'Who should I send that to?',
    }
  }
  if (!body) {
    return {
      ready: draft,
      missing: ['message'],
      question: `What should I say to ${contact}?`,
    }
  }

  const hit = matchContact(contact, app)
  if (hit.exact) {
    draft.query = hit.exact.name
    return { ready: draft, missing: [], question: null }
  }
  if (hit.suggestions.length === 1) {
    return {
      ready: draft,
      missing: ['confirmContact'],
      question: `Did you mean ${hit.suggestions[0].name}? Say yes, or say the correct name.`,
    }
  }
  if (hit.suggestions.length > 1) {
    const names = hit.suggestions.map((c) => c.name).join(', ')
    return {
      ready: draft,
      missing: ['confirmContact'],
      question: `Which person did you mean: ${names}?`,
    }
  }
  return {
    ready: draft,
    missing: ['confirmContact'],
    question: `I heard ${contact}. Is that who you meant? Say yes, or say the correct name.`,
  }
}

export function mergeMessageReply(
  draft: ParsedAction,
  missing: PendingClarify['missing'],
  reply: string,
): ParsedAction {
  const text = reply.trim()
  const next = { ...draft }
  const need = missing[0]
  const app = next.target || 'whatsapp'

  if (need === 'contact') {
    next.query = nameFromReply(text) || text
    return next
  }
  if (need === 'message') {
    next.responseText = text
    return next
  }
  if (need === 'confirmContact') {
    if (isYes(text)) {
      if (next.query) rememberContact(next.query, app)
      return next
    }
    const people = matchContact(text, app)
    const picked =
      people.exact ??
      people.suggestions.find((c) => c.name.toLowerCase() === text.toLowerCase())
    if (picked) {
      next.query = picked.name
      rememberContact(picked.name, app)
      return next
    }
    next.query = nameFromReply(text) || text
    return next
  }
  return next
}

export function prepareTask(action: ParsedAction): {
  ready: ParsedAction
  missing: PendingClarify['missing']
  question: string | null
} {
  if (action.action === 'send_message') return prepareMessage(action)
  if (action.action === 'send_email' || actionNeedsChromeAccount(action)) return prepareWebAction(action)
  return { ready: action, missing: [], question: null }
}

export function mergeTaskReply(
  draft: ParsedAction,
  missing: PendingClarify['missing'],
  reply: string,
): ParsedAction {
  const need = missing[0]
  if (need === 'contact' || need === 'message' || need === 'confirmContact') {
    return mergeMessageReply(draft, missing, reply)
  }
  return mergeWebClarifyReply(draft, missing, reply)
}

export function scheduleLine(action: ParsedAction): string {
  const when = action.runAt ? formatWhen(action.runAt) : ''
  if (action.action === 'send_message') {
    const who = action.query || 'them'
    const app = action.target || 'WhatsApp'
    const text = action.responseText || ''
    return when
      ? `I'll send "${text}" to ${who} on ${app} at ${when}.`
      : `Sending "${text}" to ${who} on ${app}.`
  }
  if (action.action === 'send_email') {
    const who = action.query || 'them'
    return when ? `I'll email ${who} at ${when}.` : `Sending the email to ${who}.`
  }
  return when ? `I'll do that at ${when}.` : 'Doing that now.'
}
