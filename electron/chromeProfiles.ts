/**
 * Detect Chrome profiles (signed-in Google accounts) and open URLs in the
 * correct profile so Gmail, Outlook, booking sites, etc. use the right login.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ChromeProfile {
  /** Folder name under User Data — e.g. "Default", "Profile 1". */
  profileDir: string
  /** Chrome display name — e.g. "Person 1", "Work". */
  label: string
  /** Google account email when signed in, else empty. */
  email: string
}

let cachedProfiles: ChromeProfile[] | null = null
let cacheAt = 0
const CACHE_MS = 60_000

function chromeUserDataDir(): string {
  return path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
}

function readLocalStateProfiles(): ChromeProfile[] {
  const localStatePath = path.join(chromeUserDataDir(), 'Local State')
  if (!fs.existsSync(localStatePath)) return []
  try {
    const raw = fs.readFileSync(localStatePath, 'utf8')
    const data = JSON.parse(raw) as {
      profile?: { info_cache?: Record<string, { name?: string; user_name?: string }> }
    }
    const cache = data.profile?.info_cache ?? {}
    return Object.entries(cache).map(([profileDir, info]) => ({
      profileDir,
      label: (info.name ?? profileDir).trim(),
      email: (info.user_name ?? '').trim(),
    }))
  } catch {
    return []
  }
}

/** List Chrome profiles with cached Google account info. */
export function listChromeProfiles(refresh = false): ChromeProfile[] {
  if (!refresh && cachedProfiles && Date.now() - cacheAt < CACHE_MS) {
    return cachedProfiles
  }
  cachedProfiles = readLocalStateProfiles()
  cacheAt = Date.now()
  return cachedProfiles
}

/** Match spoken account name/email to a Chrome profile. */
export function resolveChromeProfile(
  spoken: string,
  profiles: ChromeProfile[] = listChromeProfiles(),
): ChromeProfile | null {
  const t = spoken.trim().toLowerCase()
  if (!t || !profiles.length) return null

  // Exact profile dir
  const byDir = profiles.find((p) => p.profileDir.toLowerCase() === t)
  if (byDir) return byDir

  // Exact email
  const byEmail = profiles.find((p) => p.email.toLowerCase() === t)
  if (byEmail) return byEmail

  // Partial email or label
  const byPartial = profiles.find(
    (p) =>
      (p.email && p.email.toLowerCase().includes(t)) ||
      p.label.toLowerCase().includes(t) ||
      t.includes(p.label.toLowerCase()),
  )
  if (byPartial) return byPartial

  // "personal" / "work" heuristics on label
  if (/personal|home|main|primary/.test(t)) {
    return profiles.find((p) => /personal|home|main|primary/i.test(p.label)) ?? profiles[0]
  }
  if (/work|office|company/.test(t)) {
    return profiles.find((p) => /work|office|company/i.test(p.label)) ?? profiles[1] ?? null
  }

  // First word of email before @
  const local = t.split('@')[0]
  if (local) {
    const byLocal = profiles.find((p) => p.email.toLowerCase().startsWith(local + '@'))
    if (byLocal) return byLocal
  }

  return null
}

export function formatProfileChoices(profiles: ChromeProfile[]): string {
  if (!profiles.length) return 'No Chrome profiles found — sign into Google in Chrome first.'
  return profiles
    .map((p, i) => {
      const who = p.email || p.label
      return `${i + 1}. ${who}${p.email && p.label !== p.email ? ` (${p.label})` : ''}`
    })
    .join('\n')
}

async function findChromeExe(): Promise<string> {
  const candidates = [
    path.join(
      process.env['PROGRAMFILES'] ?? 'C:\\Program Files',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
    path.join(
      process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  try {
    const { stdout } = await execFileAsync('where.exe', ['chrome'], { timeout: 5000 })
    const line = stdout.split(/\r?\n/).find((l) => l.trim().endsWith('.exe'))
    if (line?.trim()) return line.trim()
  } catch {
    // fall through
  }
  return 'chrome'
}

/** Open a URL in a specific Chrome profile (signed-in account). */
export async function openInChromeProfile(profileDir: string, url: string): Promise<void> {
  const chrome = await findChromeExe()
  const userData = chromeUserDataDir()
  const args = [
    `--user-data-dir=${userData}`,
    `--profile-directory=${profileDir}`,
    url,
  ]
  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

/** Domains that need the user's signed-in Chrome session (not guest mode). */
export function isAuthenticatedWebUrl(url: string): boolean {
  const u = url.toLowerCase()
  const hosts = [
    'mail.google',
    'gmail.com',
    'outlook.live',
    'outlook.office',
    'office.com',
    'calendar.google',
    'drive.google',
    'docs.google',
    'makemytrip',
    'booking.com',
    'airbnb',
    'irctc',
    'goibibo',
    'cleartrip',
    'yatra.com',
    'linkedin.com',
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'amazon.',
    'flipkart',
    'paytm',
    'phonepe',
    'netflix.com',
    'hotstar',
  ]
  return hosts.some((h) => u.includes(h))
}

export function actionNeedsChromeAccount(action: {
  action: string
  target?: string
  chromeProfile?: string
}): boolean {
  if (action.action === 'send_email') return true
  if (action.action === 'open_url' && action.target) {
    return isAuthenticatedWebUrl(action.target)
  }
  return false
}
