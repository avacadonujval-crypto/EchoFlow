/**
 * Resolves and launches any installed app — Win32 and Microsoft Store.
 * Catalog comes from Get-StartApps (everything in the Start Menu),
 * launched via shell:AppsFolder AUMID, with `start` as fallback.
 */
import { spawn } from 'node:child_process'

export interface StartApp {
  name: string
  appId: string
}

let startApps: StartApp[] = []
let loadPromise: Promise<void> | null = null

/** Spoken name → executable, for classics that resolve instantly. */
const EXE_ALIASES: Record<string, string> = {
  cmd: 'cmd',
  'command prompt': 'cmd',
  'command line': 'cmd',
  powershell: 'powershell',
  terminal: 'wt',
  'windows terminal': 'wt',
  notepad: 'notepad',
  calculator: 'calc',
  calc: 'calc',
  paint: 'mspaint',
  'task manager': 'taskmgr',
  'control panel': 'control',
  'file explorer': 'explorer',
  explorer: 'explorer',
  files: 'explorer',
  word: 'winword',
  'microsoft word': 'winword',
  excel: 'excel',
  'microsoft excel': 'excel',
  powerpoint: 'powerpnt',
  'microsoft powerpoint': 'powerpnt',
  chrome: 'chrome',
  'google chrome': 'chrome',
  edge: 'msedge',
  'microsoft edge': 'msedge',
  firefox: 'firefox',
  'vs code': 'code',
  vscode: 'code',
  'visual studio code': 'code',
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function spawnDetached(file: string, args: string[]): void {
  const child = spawn(file, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.on('error', () => {
    // best effort
  })
  child.unref()
}

/** Re-scan installed apps (e.g. after a new app is installed). */
export function refreshAppCatalog(): Promise<void> {
  loadPromise = null
  return initAppLauncher()
}

export function initAppLauncher(): Promise<void> {
  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      const p = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-StartApps | ForEach-Object { $_.Name + "|" + $_.AppID }',
        ],
        { windowsHide: true },
      )
      let out = ''
      p.stdout?.on('data', (d: Buffer) => (out += d.toString()))
      p.on('close', () => {
        startApps = out
          .split(/\r?\n/)
          .map((line) => {
            const i = line.indexOf('|')
            if (i <= 0) return null
            return { name: line.slice(0, i).trim(), appId: line.slice(i + 1).trim() }
          })
          .filter((a): a is StartApp => Boolean(a?.name && a?.appId))
        console.log('[apps]', startApps.length, 'installed apps indexed')
        resolve()
      })
      p.on('error', () => {
        startApps = []
        resolve()
      })
    })
  }
  return loadPromise
}

function fuzzyStartApp(spoken: string): StartApp | null {
  const n = normalize(spoken)
  if (!n) return null
  let best: StartApp | null = null
  let bestScore = 0
  for (const app of startApps) {
    const an = normalize(app.name)
    let score = 0
    if (an === n) score = 100
    else if (an.startsWith(n)) score = 80 - Math.min(30, an.length - n.length)
    else if (an.includes(n)) score = 60 - Math.min(20, an.length - n.length)
    else {
      const nTokens = n.split(' ')
      const aTokens = new Set(an.split(' '))
      if (nTokens.every((t) => aTokens.has(t))) score = 55
    }
    if (score > bestScore) {
      bestScore = score
      best = app
    }
  }
  return bestScore >= 40 ? best : null
}

/** Resolve a spoken app name without launching (null = no confident match). */
export async function resolveApp(spoken: string): Promise<string | null> {
  const n = normalize(spoken)
  if (EXE_ALIASES[n]) return EXE_ALIASES[n]
  await initAppLauncher()
  return fuzzyStartApp(spoken)?.name ?? null
}

/** Launch any installed app by its spoken name. Returns the launched name. */
export async function launchApp(spoken: string): Promise<string> {
  const n = normalize(spoken)

  const exe = EXE_ALIASES[n]
  if (exe) {
    spawnDetached('cmd.exe', ['/c', 'start', '', exe])
    return spoken
  }

  await initAppLauncher()
  let hit = fuzzyStartApp(spoken)
  if (!hit) {
    // Maybe installed since the last scan — refresh once and retry
    await refreshAppCatalog()
    hit = fuzzyStartApp(spoken)
  }
  if (hit) {
    spawnDetached('explorer.exe', [`shell:AppsFolder\\${hit.appId}`])
    return hit.name
  }

  // Last resort: let the shell try (works for anything on PATH / app paths)
  spawnDetached('cmd.exe', ['/c', 'start', '', spoken])
  return spoken
}

/** Full indexed catalog (Start Menu / Store apps), sorted by name. */
export async function listInstalledApps(): Promise<StartApp[]> {
  await initAppLauncher()
  return [...startApps].sort((a, b) => a.name.localeCompare(b.name))
}