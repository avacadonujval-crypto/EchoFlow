import Store from 'electron-store'
import { randomUUID } from 'node:crypto'
import type {
  AppSettings,
  CommandAlias,
  ConnectedApp,
  HistoryEntry,
  Macro,
  Membership,
  Snippet,
  VoiceProfile,
  VoiceStudio,
} from './types'
import { DEFAULT_SETTINGS } from './types'
import { hasGeminiApiKey } from './secrets'
import { countWords, localDay, profileLimit, shiftDay } from '../shared/voice'

interface StoreSchema {
  settings: Omit<AppSettings, 'geminiApiKey' | 'geminiReady'>
  aliases: CommandAlias[]
  macros: Macro[]
  snippets: Snippet[]
  history: HistoryEntry[]
  connectedApps: ConnectedApp[]
  profiles: VoiceProfile[]
  activeProfileId: string
  membership: Membership
}

const EMPTY_MEMBERSHIP: Membership = {
  plan: 'personal',
  cadence: 'monthly',
  email: '',
  since: 0,
}

const StoreCtor = (Store as unknown as { default?: typeof Store }).default ?? Store

const store = new StoreCtor({
  name: 'echoflow-data',
  defaults: {
    settings: {
      onboardingComplete: false,
      pushToTalkKeys: ['Ctrl', 'Alt'],
      autoPaste: true,
      showOverlay: true,
      launchAtStartup: true,
      alwaysOnTop: false,
      defaultEmailClient: 'gmail',
      myEmail: '',
      displayName: '',
      speechLanguage: 'auto',
      defaultChromeAccount: 'ask',
    },
    aliases: [],
    macros: [],
    snippets: [],
    history: [],
    connectedApps: [],
    profiles: [],
    activeProfileId: '',
    membership: EMPTY_MEMBERSHIP,
  },
}) as unknown as Store<StoreSchema>

/** Public settings for the renderer — never includes the real API key. */
export function getSettings(): AppSettings {
  const settings = store.get('settings')
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    geminiApiKey: '',
    geminiReady: hasGeminiApiKey(),
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next = { ...current, ...partial }
  // Strip secrets / derived fields before persisting
  const {
    geminiApiKey: _k,
    geminiReady: _r,
    ...persistable
  } = next
  store.set('settings', persistable)
  return getSettings()
}

export function getAliases(): CommandAlias[] {
  return store.get('aliases')
}

export function saveAlias(alias: CommandAlias): CommandAlias[] {
  const aliases = getAliases().filter((a) => a.id !== alias.id)
  aliases.push(alias)
  store.set('aliases', aliases)
  return aliases
}

export function deleteAlias(id: string): CommandAlias[] {
  const aliases = getAliases().filter((a) => a.id !== id)
  store.set('aliases', aliases)
  return aliases
}

export function getMacros(): Macro[] {
  return store.get('macros')
}

export function saveMacro(macro: Macro): Macro[] {
  const macros = getMacros().filter((m) => m.id !== macro.id)
  macros.push(macro)
  store.set('macros', macros)
  return macros
}

export function deleteMacro(id: string): Macro[] {
  const macros = getMacros().filter((m) => m.id !== id)
  store.set('macros', macros)
  return macros
}

export function getSnippets(): Snippet[] {
  return store.get('snippets') ?? []
}

export function saveSnippet(snippet: Snippet): Snippet[] {
  const snippets = getSnippets().filter((item) => item.id !== snippet.id)
  snippets.push({
    ...snippet,
    phrase: snippet.phrase.trim().slice(0, 80),
    expansion: snippet.expansion.trim().slice(0, 4000),
  })
  store.set('snippets', snippets)
  return snippets
}

export function deleteSnippet(id: string): Snippet[] {
  const snippets = getSnippets().filter((item) => item.id !== id)
  store.set('snippets', snippets)
  return snippets
}

export function getHistory(): HistoryEntry[] {
  return store.get('history')
}

export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  const history = [entry, ...getHistory()].slice(0, 200)
  store.set('history', history)
  recordSpokenWords(entry.transcript)
  return history
}

function blankProfile(name: string, words = 0, sessions = 0): VoiceProfile {
  return {
    id: randomUUID(),
    name,
    createdAt: Date.now(),
    words,
    sessions,
    wordsToday: 0,
    lastDay: '',
    streak: 0,
    bestStreak: 0,
    dailyGoal: 120,
    days: {},
  }
}

function pruneDays(days: Record<string, number>, today: string): Record<string, number> {
  const cutoff = shiftDay(today, -60)
  const next: Record<string, number> = {}
  for (const [day, words] of Object.entries(days)) {
    if (day >= cutoff) next[day] = words
  }
  return next
}

function seedProfiles(): VoiceProfile[] {
  const history = getHistory()
  const words = history.reduce((sum, entry) => sum + countWords(entry.transcript), 0)
  const profile = blankProfile('Personal', words, history.length)
  const today = localDay()
  const days: Record<string, number> = {}
  for (const entry of history) {
    const day = localDay(entry.timestamp)
    days[day] = (days[day] ?? 0) + countWords(entry.transcript)
  }
  profile.days = pruneDays(days, today)
  profile.wordsToday = profile.days[today] ?? 0
  profile.lastDay = profile.wordsToday > 0 ? today : ''
  let streak = 0
  let cursor = today
  if ((profile.days[cursor] ?? 0) === 0) cursor = shiftDay(today, -1)
  while ((profile.days[cursor] ?? 0) > 0) {
    streak += 1
    cursor = shiftDay(cursor, -1)
  }
  profile.streak = streak
  profile.bestStreak = streak
  return [profile]
}

function ensureProfiles(): VoiceProfile[] {
  const existing = store.get('profiles') ?? []
  if (existing.length > 0) return existing
  const seeded = seedProfiles()
  store.set('profiles', seeded)
  store.set('activeProfileId', seeded[0].id)
  return seeded
}

export function getVoiceStudio(): VoiceStudio {
  const profiles = ensureProfiles()
  const activeId = store.get('activeProfileId') || profiles[0].id
  return { profiles, activeId }
}

export function spokenWordTotal(): number {
  return getVoiceStudio().profiles.reduce((sum, profile) => sum + profile.words, 0)
}

export function recordSpokenWords(text: string): VoiceStudio {
  const added = countWords(text)
  if (!added) return getVoiceStudio()
  const today = localDay()
  const yesterday = shiftDay(today, -1)
  const { profiles, activeId } = getVoiceStudio()
  const next = profiles.map((profile) => {
    if (profile.id !== activeId) return profile
    const sameDay = profile.lastDay === today
    const continued = profile.lastDay === yesterday || sameDay
    const streak = sameDay ? Math.max(profile.streak, 1) : continued ? profile.streak + 1 : 1
    const wordsToday = (profile.days[today] ?? 0) + added
    const days = pruneDays({ ...profile.days, [today]: wordsToday }, today)
    return {
      ...profile,
      words: profile.words + added,
      sessions: profile.sessions + 1,
      wordsToday,
      lastDay: today,
      streak,
      bestStreak: Math.max(profile.bestStreak, streak),
      days,
    }
  })
  store.set('profiles', next)
  return { profiles: next, activeId }
}

export function saveVoiceProfile(input: {
  id?: string
  name: string
  dailyGoal?: number
}): VoiceStudio {
  const name = input.name.trim().slice(0, 32)
  if (!name) return getVoiceStudio()
  const { profiles, activeId } = getVoiceStudio()
  if (!input.id && profiles.length >= profileLimit(getMembership().plan)) {
    return { profiles, activeId }
  }
  if (input.id) {
    const next = profiles.map((profile) =>
      profile.id === input.id
        ? {
            ...profile,
            name,
            dailyGoal:
              input.dailyGoal && input.dailyGoal > 0
                ? Math.min(2000, Math.round(input.dailyGoal))
                : profile.dailyGoal,
          }
        : profile,
    )
    store.set('profiles', next)
    return { profiles: next, activeId }
  }
  const created = blankProfile(name)
  if (input.dailyGoal && input.dailyGoal > 0) {
    created.dailyGoal = Math.min(2000, Math.round(input.dailyGoal))
  }
  const next = [...profiles, created]
  store.set('profiles', next)
  store.set('activeProfileId', created.id)
  return { profiles: next, activeId: created.id }
}

export function activateVoiceProfile(id: string): VoiceStudio {
  const studio = getVoiceStudio()
  if (!studio.profiles.some((profile) => profile.id === id)) return studio
  store.set('activeProfileId', id)
  return { ...studio, activeId: id }
}

export function deleteVoiceProfile(id: string): VoiceStudio {
  const studio = getVoiceStudio()
  if (studio.profiles.length <= 1) return studio
  const next = studio.profiles.filter((profile) => profile.id !== id)
  const activeId = studio.activeId === id ? next[0].id : studio.activeId
  store.set('profiles', next)
  store.set('activeProfileId', activeId)
  return { profiles: next, activeId }
}

export function getMembership(): Membership {
  return { ...EMPTY_MEMBERSHIP, ...(store.get('membership') ?? EMPTY_MEMBERSHIP) }
}

export function chooseMembership(choice: {
  plan: Membership['plan']
  cadence: Membership['cadence']
  email: string
}): Membership {
  const next: Membership = {
    plan: choice.plan,
    cadence: choice.cadence,
    email: choice.email.trim().slice(0, 120),
    since: choice.plan === 'personal' ? 0 : Date.now(),
  }
  store.set('membership', next)
  return next
}

export function clearHistory(): void {
  store.set('history', [])
}

export function getConnectedApps(): ConnectedApp[] {
  return store.get('connectedApps') ?? []
}

export function connectApp(app: { name: string; appId: string }): ConnectedApp[] {
  const apps = getConnectedApps().filter((a) => a.appId !== app.appId)
  apps.push({ appId: app.appId, name: app.name, connectedAt: Date.now() })
  apps.sort((a, b) => a.name.localeCompare(b.name))
  store.set('connectedApps', apps)
  return apps
}

export function disconnectApp(appId: string): ConnectedApp[] {
  const apps = getConnectedApps().filter((a) => a.appId !== appId)
  store.set('connectedApps', apps)
  return apps
}
