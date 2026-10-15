/**
 * Ask which Chrome account to use before email, booking, and other signed-in web tasks.
 */
import { getSettings } from './storage'
import {
  listChromeProfiles,
  resolveChromeProfile,
  formatProfileChoices,
  actionNeedsChromeAccount,
  type ChromeProfile,
} from './chromeProfiles'
import { prepareSendEmail, mergeClarifyReply as mergeEmailClarify } from './emailPlan'
import type { ParsedAction } from './types'
import type { PendingClarify } from './chat'

export type WebMissing = PendingClarify['missing']

function pickDefaultProfile(profiles: ChromeProfile[]): ChromeProfile | null {
  const settings = getSettings()
  const pref = settings.defaultChromeAccount
  if (pref && pref !== 'ask') {
    const found = profiles.find((p) => p.profileDir === pref)
    if (found) return found
  }
  if (profiles.length === 1) return profiles[0]
  return null
}

function chromeAccountQuestion(profiles: ChromeProfile[]): string {
  const list = formatProfileChoices(profiles)
  return (
    `Which Chrome account should I use? Pick the one you're signed into for this task:\n${list}\n\n` +
    `Reply with the email, profile name, or number (e.g. "1" or "work@gmail.com").`
  )
}

/** Resolve chrome profile on action if default is set; else flag missing. */
function applyChromeProfile(
  action: ParsedAction,
  missing: WebMissing,
): ParsedAction {
  const draft = { ...action }
  const profiles = listChromeProfiles()

  if (draft.chromeProfile) {
    const resolved = resolveChromeProfile(draft.chromeProfile, profiles)
    if (resolved) {
      draft.chromeProfile = resolved.profileDir
      return draft
    }
  }

  const defaultProfile = pickDefaultProfile(profiles)
  if (defaultProfile) {
    draft.chromeProfile = defaultProfile.profileDir
    return draft
  }

  if (getSettings().defaultChromeAccount === 'ask' || profiles.length > 1) {
    missing.push('chromeAccount')
  } else if (profiles.length === 1) {
    draft.chromeProfile = profiles[0].profileDir
  } else {
    missing.push('chromeAccount')
  }

  return draft
}

export function prepareWebAction(action: ParsedAction): {
  ready: ParsedAction
  missing: WebMissing
  question: string | null
} {
  if (!actionNeedsChromeAccount(action)) {
    if (action.action === 'send_email') return prepareSendEmail(action)
    return { ready: action, missing: [], question: null }
  }

  const missing: WebMissing = []
  let draft = applyChromeProfile(action, missing)

  // Chrome account must be chosen before email fields or navigation
  if (missing.includes('chromeAccount')) {
    return {
      ready: draft,
      missing,
      question: chromeAccountQuestion(listChromeProfiles()),
    }
  }

  if (action.action === 'send_email') {
    const emailPrep = prepareSendEmail(draft)
    draft = emailPrep.ready
    return {
      ready: draft,
      missing: emailPrep.missing,
      question: emailPrep.question,
    }
  }

  return { ready: draft, missing: [], question: null }
}

export function mergeWebClarifyReply(
  draft: ParsedAction,
  missing: WebMissing,
  reply: string,
): ParsedAction {
  const need = missing[0]
  const text = reply.trim()

  if (need === 'chromeAccount') {
    const profiles = listChromeProfiles()
    // Allow "1", "2" numeric pick
    const num = /^[1-9]\d*$/.test(text) ? Number(text) - 1 : -1
    const byNum = num >= 0 && num < profiles.length ? profiles[num] : null
    const resolved = byNum ?? resolveChromeProfile(text, profiles)
    const next = { ...draft }
    if (resolved) {
      next.chromeProfile = resolved.profileDir
    } else {
      next.chromeProfile = text
    }
    return next
  }

  return mergeEmailClarify(draft, missing, reply)
}
