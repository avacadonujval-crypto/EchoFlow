/**
 * When the user ends a command with "and send it", strip that phrase and
 * flag the action so the executor presses Enter after typing.
 */
import type { ParsedAction } from './types'

const SEND_IT_TAIL =
  /\s+(?:and\s+)?(?:then\s+)?(?:please\s+)?send\s+it\.?$/i
const SEND_TAIL = /\s+and\s+send\.?$/i
// Multilingual "send it" tails (Kannada, Hindi, Tamil, Telugu)
const SEND_IT_KN = /\s+(?:ಮತ್ತು\s+)?(?:ಕಳುಹಿಸು|ಕಳುಹಿಸಿ)\.?$/u
const SEND_IT_HI = /\s+(?:और\s+)?(?:भेज\s+दो|भेजो)\.?$/u
const SEND_IT_TA = /\s+(?:மற்றும்\s+)?(?:அனுப்பு|அனுப்புங்கள்)\.?$/u
const SEND_IT_TE = /\s+(?:మరియు\s+)?(?:పంపు|పంపండి)\.?$/u

function stripSendIt(t: string): { text: string; submit: boolean } {
  let submit = false
  for (const re of [SEND_IT_TAIL, SEND_TAIL, SEND_IT_KN, SEND_IT_HI, SEND_IT_TA, SEND_IT_TE]) {
    if (re.test(t)) {
      submit = true
      t = t.replace(re, '').trim()
      break
    }
  }
  return { text: t, submit }
}

export function parseSendIt(text: string): { text: string; submit: boolean } {
  return stripSendIt(text.trim())
}

export function applySendItToAction(
  action: ParsedAction,
  transcript: string,
): ParsedAction {
  const head = parseSendIt(transcript)
  let submit = head.submit
  const next: ParsedAction = {
    ...action,
    rawText: head.text || action.rawText,
  }

  if (next.responseText) {
    const msg = parseSendIt(next.responseText)
    if (msg.submit) submit = true
    next.responseText = msg.text
  }

  if (next.query && next.action === 'send_message') {
    const q = parseSendIt(next.query)
    if (q.submit) submit = true
    next.query = q.text
  }

  if (next.steps?.length) {
    next.steps = next.steps.map((s) => ({ ...s }))
    const last = next.steps[next.steps.length - 1]
    if (last.action === 'dictate' && last.responseText) {
      const msg = parseSendIt(last.responseText)
      if (msg.submit) submit = true
      last.responseText = msg.text
    }
  }

  if (submit) next.submit = true
  return next
}
