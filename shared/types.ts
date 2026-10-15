export type ActionType =
  | 'dictate'
  | 'open_app'
  | 'open_url'
  | 'web_search'
  | 'youtube_search'
  | 'send_message'
  | 'system'
  | 'reply'
  | 'macro'
  | 'keys'
  | 'install_app'
  | 'uninstall_app'
  | 'send_email'
  | 'clarify'
  | 'unknown'

export interface InstalledApp {
  name: string
  appId: string
}

export interface ConnectedApp {
  appId: string
  name: string
  connectedAt: number
}

export interface ParsedAction {
  action: ActionType
  /** App name, URL, email provider (gmail/outlook), key sequence, etc. */
  target?: string
  /** Search query, chat contact, or email recipient address. */
  query?: string
  responseText?: string
  /** Email subject (send_email). */
  subject?: string
  /** Press Enter after typing (user said "and send it"). */
  submit?: boolean
  /** Chrome profile directory for signed-in web tasks (Default, Profile 1…). */
  chromeProfile?: string
  steps?: ParsedAction[]
  source: 'local' | 'gemini' | 'dictation'
  rawText: string
}

export interface CommandAlias {
  id: string
  phrase: string
  action: ActionType
  target: string
  query?: string
  createdAt: number
}

export interface MacroStep {
  action: ActionType
  target?: string
  query?: string
  delayMs?: number
}

export interface Macro {
  id: string
  phrase: string
  steps: MacroStep[]
  createdAt: number
}

/** A short spoken name that expands into the full text. */
export interface Snippet {
  id: string
  phrase: string
  expansion: string
  createdAt: number
}

export interface HistoryEntry {
  id: string
  transcript: string
  action: ActionType
  target?: string
  source: 'local' | 'gemini' | 'dictation'
  success: boolean
  timestamp: number
}

export type EmailClient = 'gmail' | 'outlook' | 'ask'

/** Chrome profile detected from the user's Google Chrome install. */
export interface ChromeProfileInfo {
  profileDir: string
  label: string
  email: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: number
}

export interface AppSettings {
  onboardingComplete: boolean
  /** Always empty in the renderer — the real key never leaves the main process. */
  geminiApiKey: string
  /** Whether AI fallback is available (built-in / env key). */
  geminiReady: boolean
  pushToTalkKeys: string[]
  autoPaste: boolean
  showOverlay: boolean
  launchAtStartup: boolean
  alwaysOnTop: boolean
  /** Preferred mail app when the user doesn't say Gmail/Outlook. */
  defaultEmailClient: EmailClient
  /** Your email — shortcuts like "my email" / "email of mine" resolve to this. */
  myEmail: string
  /** Name shown in the center of the window. */
  displayName: string
  /** Speech language: auto-detect or a specific ISO-style code (kn, hi, ta…). */
  speechLanguage: string
  /** Chrome profile dir for email/booking, or "ask" to pick in Chat each time. */
  defaultChromeAccount: string
}

export interface OverlayState {
  visible: boolean
  listening: boolean
  processing: boolean
  transcript: string
  status: string
}

export interface SessionResult {
  transcript: string
  action?: ParsedAction
  result?: { success: boolean; message: string }
  error?: string
}

export type MembershipPlan = 'personal' | 'studio' | 'maison'
export type BillingCadence = 'monthly' | 'yearly'

export interface VoiceProfile {
  id: string
  name: string
  createdAt: number
  /** Lifetime words spoken on this voice. */
  words: number
  sessions: number
  wordsToday: number
  /** Local calendar day, YYYY-MM-DD. */
  lastDay: string
  streak: number
  bestStreak: number
  /** Words the person intends to speak today. */
  dailyGoal: number
  /** Recent days → words, kept for about two months. */
  days: Record<string, number>
}

export interface VoiceStudio {
  profiles: VoiceProfile[]
  activeId: string
}

export interface Membership {
  plan: MembershipPlan
  cadence: BillingCadence
  email: string
  /** When the plan was chosen. 0 means the included plan. */
  since: number
}

export interface EchoFlowApi {
  getSettings: () => Promise<AppSettings>
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  testGeminiKey: () => Promise<{ ok: boolean; error?: string }>
  listAliases: () => Promise<CommandAlias[]>
  saveAlias: (alias: CommandAlias) => Promise<CommandAlias[]>
  deleteAlias: (id: string) => Promise<CommandAlias[]>
  listMacros: () => Promise<Macro[]>
  saveMacro: (macro: Macro) => Promise<Macro[]>
  deleteMacro: (id: string) => Promise<Macro[]>
  listSnippets: () => Promise<Snippet[]>
  saveSnippet: (snippet: Snippet) => Promise<Snippet[]>
  deleteSnippet: (id: string) => Promise<Snippet[]>
  listHistory: () => Promise<HistoryEntry[]>
  clearHistory: () => Promise<HistoryEntry[]>
  listChromeProfiles: () => Promise<ChromeProfileInfo[]>
  listInstalledApps: () => Promise<InstalledApp[]>
  listConnectedApps: () => Promise<ConnectedApp[]>
  connectApp: (app: InstalledApp) => Promise<ConnectedApp[]>
  disconnectApp: (appId: string) => Promise<ConnectedApp[]>
  openExternal: (url: string) => Promise<void>
  getVersion: () => Promise<string>
  showHub: () => Promise<void>
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
  sendTranscript: (text: string) => Promise<void>
  sendPartial: (text: string) => Promise<void>
  sendAudio: (base64: string, mimeType: string) => Promise<void>
  getChatMessages: () => Promise<ChatMessage[]>
  clearChat: () => Promise<ChatMessage[]>
  cancelClarify: () => Promise<void>
  onVoiceStart: (cb: () => void) => () => void
  onVoiceStop: (cb: () => void) => () => void
  onOverlayState: (
    cb: (state: {
      listening: boolean
      processing: boolean
      transcript: string
      status: string
    }) => void,
  ) => () => void
  onSessionResult: (cb: (result: SessionResult) => void) => () => void
  onHistoryUpdated: (cb: () => void) => () => void
  onChatUpdated: (cb: (messages: ChatMessage[]) => void) => () => void
  onNavigate: (cb: (path: string) => void) => () => void
  getVoiceStudio: () => Promise<VoiceStudio>
  saveVoiceProfile: (input: { id?: string; name: string; dailyGoal?: number }) => Promise<VoiceStudio>
  activateVoiceProfile: (id: string) => Promise<VoiceStudio>
  deleteVoiceProfile: (id: string) => Promise<VoiceStudio>
  getMembership: () => Promise<Membership>
  chooseMembership: (choice: {
    plan: MembershipPlan
    cadence: BillingCadence
    email: string
  }) => Promise<Membership>
  windowMinimize: () => Promise<void>
  windowToggleMaximize: () => Promise<void>
  windowClose: () => Promise<void>
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  geminiApiKey: '',
  geminiReady: true,
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
}
