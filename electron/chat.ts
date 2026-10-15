/**
 * Pending clarification + in-memory chat transcript for the hub Chat page.
 */
import { randomUUID } from 'node:crypto'
import type { ChatMessage, ParsedAction } from './types'

export interface PendingClarify {
  /** Incomplete action we're trying to finish (usually send_email). */
  draft: ParsedAction
  /** Which fields still need answers. */
  missing: Array<'chromeAccount' | 'provider' | 'to' | 'body' | 'subject'>
  question: string
  createdAt: number
}

let pending: PendingClarify | null = null
let messages: ChatMessage[] = []
let notify: ((messages: ChatMessage[]) => void) | null = null
let navigate: ((path: string) => void) | null = null

export function setChatNotifiers(
  onMessages: (messages: ChatMessage[]) => void,
  onNavigate: (path: string) => void,
): void {
  notify = onMessages
  navigate = onNavigate
}

export function getChatMessages(): ChatMessage[] {
  return [...messages]
}

export function clearChat(): ChatMessage[] {
  messages = []
  pending = null
  notify?.(messages)
  return messages
}

export function getPendingClarify(): PendingClarify | null {
  return pending
}

export function cancelClarify(): void {
  pending = null
}

function push(role: ChatMessage['role'], text: string): ChatMessage {
  const msg: ChatMessage = {
    id: randomUUID(),
    role,
    text,
    timestamp: Date.now(),
  }
  messages.push(msg)
  // Keep chat bounded
  if (messages.length > 200) messages = messages.slice(-200)
  notify?.(getChatMessages())
  return msg
}

export function pushUserMessage(text: string): void {
  push('user', text)
}

export function pushAssistantMessage(text: string): void {
  push('assistant', text)
}

export function pushSystemMessage(text: string): void {
  push('system', text)
}

/** Ask the user a clarifying question and remember the draft action. */
export function startClarify(
  draft: ParsedAction,
  missing: PendingClarify['missing'],
  question: string,
): void {
  pending = {
    draft: { ...draft, steps: draft.steps ? [...draft.steps] : undefined },
    missing: [...missing],
    question,
    createdAt: Date.now(),
  }
  push('assistant', question)
  navigate?.('/chat')
}

export function updatePendingDraft(partial: Partial<ParsedAction>): ParsedAction {
  if (!pending) {
    throw new Error('No pending clarification')
  }
  pending.draft = { ...pending.draft, ...partial }
  return pending.draft
}

export function setPendingMissing(missing: PendingClarify['missing']): void {
  if (!pending) return
  pending.missing = missing
}

export function clearPending(): void {
  pending = null
}
