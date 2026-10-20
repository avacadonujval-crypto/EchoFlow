import { clipboard, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'
import { launchApp, resolveApp } from './appLauncher'
import {
  buildComposeUrl,
  normalizeSpokenEmail,
  type EmailProvider,
} from './email'
import { openInChromeProfile } from './chromeProfiles'
import type { ParsedAction } from './types'
import { runDesktopAction } from './desktop'

const execFileAsync = promisify(execFile)

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

interface AutoStep {
  /** SendKeys sequence, e.g. "^f" or "{ENTER}" */
  keys?: string
  /** Literal text (special characters auto-escaped) */
  text?: string
  /** Delay after this step */
  delayMs?: number
}

function escapeSendKeys(text: string): string {
  return text
    .replace(/([+^%~(){}[\]])/g, '{$1}')
    .replace(/\r?\n/g, '{ENTER}')
}

/**
 * Run a whole keystroke recipe in ONE PowerShell process.
 * (One process per keystroke costs ~700ms each in startup alone.)
 */
export async function runAutomation(steps: AutoStep[]): Promise<void> {
  const lines = ['Add-Type -AssemblyName System.Windows.Forms']
  for (const step of steps) {
    const payload = step.keys ?? (step.text ? escapeSendKeys(step.text) : '')
    if (payload) {
      lines.push(
        `[System.Windows.Forms.SendKeys]::SendWait('${payload.replace(/'/g, "''")}')`,
      )
    }
    if (step.delayMs) lines.push(`Start-Sleep -Milliseconds ${step.delayMs}`)
  }
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    lines.join('; '),
  ])
}

/**
 * Bring an app's window to the foreground (title substring match, restores
 * minimized windows, Alt-tap trick to satisfy SetForegroundWindow rules).
 * Polls until the window exists — replaces blind fixed waits after launch.
 */
async function focusAppWindow(nameSubstring: string, timeoutMs = 7000): Promise<boolean> {
  const needle = nameSubstring.replace(/'/g, "''").toLowerCase()
  const script = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FW {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int c);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte sc, uint fl, UIntPtr ex);
  delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
  public static bool Focus(string needle) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, 512);
      if (sb.ToString().ToLower().Contains(needle)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    if (found == IntPtr.Zero) return false;
    ShowWindow(found, 9);
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    SetForegroundWindow(found);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    return true;
  }
}
"@
$deadline = (Get-Date).AddMilliseconds(${timeoutMs})
while ((Get-Date) -lt $deadline) {
  if ([FW]::Focus('${needle}')) { Write-Output 'FOUND'; exit 0 }
  Start-Sleep -Milliseconds 300
}
Write-Output 'NOTFOUND'
`
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ])
    return stdout.includes('FOUND')
  } catch {
    return false
  }
}

async function pasteText(text: string): Promise<void> {
  // Paste: clipboard + SendKeys, with a brief settle delay
  clipboard.writeText(text)
  await sleep(60)
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")',
  ])
  await sleep(80)
}

async function openApp(target: string): Promise<string> {
  const t = target.trim()
  if (t.includes('://') || t.startsWith('http') || /^[a-z][\w.-]*:$/i.test(t)) {
    await openUrl(t)
    return t
  }
  // Resolves anything installed: Win32, Store apps (WhatsApp…), Start Menu entries
  return launchApp(t)
}

async function pressEnter(): Promise<void> {
  await runAutomation([{ keys: '{ENTER}' }])
}

/**
 * Open a chat app and send a message to a contact.
 * WhatsApp recipe: Ctrl+F chat search → contact → open top result → send.
 */
async function sendAppMessage(
  app: string,
  contact: string,
  message: string,
  submit = true,
): Promise<string> {
  const launched = await openApp(app || 'whatsapp')
  // Wait for the app window and force it to the foreground before typing
  await sleep(1200)
  await focusAppWindow(launched, 9000)
  await sleep(800)

  const kind = `${app} ${launched}`.toLowerCase()
  if (kind.includes('whatsapp')) {
    await runAutomation([
      { keys: '^f', delayMs: 800 },
      { text: contact, delayMs: 1800 },
      { keys: '{DOWN}{ENTER}', delayMs: 1200 },
      { text: message, delayMs: 300 },
      { keys: '{ENTER}' },
    ])
    return `Sent "${message}" to ${contact} on WhatsApp`
  }

  if (kind.includes('telegram')) {
    await runAutomation([
      { keys: '{ESC}', delayMs: 400 },
      { text: contact, delayMs: 1500 },
      { keys: '{DOWN}{ENTER}', delayMs: 1000 },
      { text: message, delayMs: 300 },
      { keys: '{ENTER}' },
    ])
    return `Sent "${message}" to ${contact} on Telegram`
  }

  // Generic app: type the message into whatever field has focus
  await runAutomation([{ text: message }])
  if (submit) {
    await sleep(200)
    await pressEnter()
    return `Sent message in ${launched}`
  }
  return `Typed message in ${launched} — press Enter to send`
}

async function openUrl(url: string): Promise<void> {
  // Windows file search: a bare "search-ms:query=x" silently does nothing —
  // it needs a location crumb, and ShellExecute handles the & reliably.
  if (url.toLowerCase().startsWith('search-ms:')) {
    let uri = url
    if (!/crumb=/i.test(uri)) uri += `&crumb=location:${os.homedir()}`
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Process '${uri.replace(/'/g, "''")}'`,
    ])
    return
  }
  try {
    if (shell && typeof shell.openExternal === 'function') {
      await shell.openExternal(url)
      return
    }
  } catch {
    // fall through
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn('cmd.exe', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('error', reject)
    child.unref()
    resolve()
  })
}

const BROWSERS: Record<string, { exe: string; arg: string; urlViaOmnibox: boolean }> = {
  // Chromium guest windows bypass the profile picker but IGNORE startup
  // URLs, so the URL is typed into the omnibox after the window opens.
  chrome: { exe: 'chrome', arg: '--guest', urlViaOmnibox: true },
  'google chrome': { exe: 'chrome', arg: '--guest', urlViaOmnibox: true },
  msedge: { exe: 'msedge', arg: '--guest', urlViaOmnibox: true },
  edge: { exe: 'msedge', arg: '--guest', urlViaOmnibox: true },
  firefox: { exe: 'firefox', arg: '-private-window', urlViaOmnibox: false },
}

/**
 * Open a URL in a fresh guest/private window of a specific browser, so the
 * profile picker or an already-running instance can't swallow the navigation.
 */
async function openInBrowserGuest(browser: string, url: string): Promise<boolean> {
  const b = BROWSERS[browser.toLowerCase().trim()]
  if (!b) return false
  const args = b.urlViaOmnibox ? [b.exe, b.arg] : [b.exe, b.arg, url]
  const child = spawn('cmd.exe', ['/c', 'start', '', ...args], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  if (b.urlViaOmnibox) {
    await sleep(3000) // guest window opens focused
    await runAutomation([
      { keys: '^l', delayMs: 300 },
      { text: url, delayMs: 200 },
      { keys: '{ENTER}' },
    ])
  }
  return true
}

async function youtubeSearch(query: string, browser?: string): Promise<void> {
  const q = encodeURIComponent(query)
  const url = `https://www.youtube.com/results?search_query=${q}`
  if (browser && (await openInBrowserGuest(browser, url))) return
  await openUrl(url)
}

async function webSearch(query: string, browser?: string): Promise<void> {
  const q = encodeURIComponent(query)
  const url = `https://www.google.com/search?q=${q}`
  if (browser && (await openInBrowserGuest(browser, url))) return
  await openUrl(url)
}

interface WingetRow {
  id: string
  source: string
}

/** Parse winget's fixed-width table output into package rows. */
function parseWingetRows(stdout: string): WingetRow[] {
  const lines = stdout.split(/\r?\n/)
  const headerIdx = lines.findIndex((l) => /^Name\s+Id\s+/.test(l))
  if (headerIdx === -1) return []
  const header = lines[headerIdx]
  const idCol = header.indexOf('Id')
  const sourceCol = header.indexOf('Source')
  const rows = lines.slice(headerIdx + 2).filter((l) => l.trim())
  const parsed: WingetRow[] = []
  for (const row of rows) {
    const tail = sourceCol >= 0 ? row.slice(sourceCol).trim() : row.trim().split(/\s+/).pop() ?? ''
    const source = tail.split(/\s+/)[0]?.toLowerCase() ?? ''
    const id = row.slice(idCol).trim().split(/\s+/)[0]
    if (id) parsed.push({ id, source })
  }
  return parsed
}

/** Parse winget's fixed-width table output and pick the best package id. */
function parseWingetTable(stdout: string, spoken: string): string | null {
  return pickWingetRow(parseWingetRows(stdout), spoken)?.id ?? null
}

/** Prefer winget community packages over Microsoft Store listings. */
function pickWingetRow(rows: WingetRow[], spoken: string): WingetRow | null {
  if (!rows.length) return null
  const needle = spoken.toLowerCase()
  const wingetRows = rows.filter((r) => r.source === 'winget')
  const pool = wingetRows.length ? wingetRows : rows
  const nameMatch = (r: WingetRow) => r.id.toLowerCase().includes(needle.replace(/\s+/g, ''))
  return pool.find(nameMatch) ?? pool[0] ?? null
}

/** Find the best winget package id for a spoken app name (online catalog). */
export async function wingetResolveId(name: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'winget',
      ['search', name, '--count', '8', '--accept-source-agreements'],
      { timeout: 20000 },
    )
    const row = pickWingetRow(parseWingetRows(stdout), name)
    // Skip Microsoft Store-only hits — user gets a Google download search instead.
    if (!row || row.source === 'msstore') return null
    return row.id
  } catch {
    return null
  }
}

/** Find an INSTALLED package id for a spoken app name. */
export async function wingetInstalledId(name: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'winget',
      ['list', name, '--accept-source-agreements'],
      { timeout: 20000 },
    )
    return parseWingetTable(stdout, name)
  } catch {
    return null
  }
}

/**
 * Download & install an app by spoken name: winget community repo in a visible
 * terminal (progress + UAC prompts stay visible); Google search as fallback.
 */
async function installApp(name: string): Promise<string> {
  const existing = await resolveApp(name)
  if (existing) {
    return `${existing} is already installed — say "open ${existing}" instead`
  }

  const id = await wingetResolveId(name)
  if (id) {
    const child = spawn(
      'cmd.exe',
      [
        '/c',
        'start',
        'EchoFlow installer',
        'cmd',
        '/k',
        `winget install --id ${id} --source winget --accept-source-agreements --accept-package-agreements`,
      ],
      { detached: true, stdio: 'ignore', windowsHide: true },
    )
    child.unref()
    return `Installing ${name} (${id}) — check the installer window`
  }

  const query = `${name} download windows official site`
  await webSearch(query, 'chrome')
  return `Couldn't auto-install "${name}" — opened Google in Chrome to find the official download`
}

/**
 * Open Gmail/Outlook compose with fields filled, then Ctrl+Enter to send.
 * Requires the user to already be signed in to that webmail in the browser.
 */
async function sendEmail(opts: {
  provider: EmailProvider
  to: string
  subject?: string
  body: string
  chromeProfile?: string
}): Promise<string> {
  const to = normalizeSpokenEmail(opts.to) ?? opts.to.trim()
  const url = buildComposeUrl(opts.provider, {
    to,
    subject: opts.subject,
    body: opts.body,
  })
  if (opts.chromeProfile) {
    await openInChromeProfile(opts.chromeProfile, url)
  } else {
    await openUrl(url)
  }
  // Webmail compose needs a moment to paint before Ctrl+Enter lands
  await sleep(4500)
  const focusNeedle = opts.provider === 'gmail' ? 'gmail' : 'outlook'
  const focused = await focusAppWindow(focusNeedle, 5000)
  if (!focused) {
    await focusAppWindow('chrome', 2000)
    await focusAppWindow('edge', 1500)
  }
  await runAutomation([{ keys: '^{ENTER}' }])
  const via = opts.provider === 'gmail' ? 'Gmail' : 'Outlook'
  const account = opts.chromeProfile ? ` (Chrome: ${opts.chromeProfile})` : ''
  return `Sent email to ${to} via ${via}${account}`
}

/**
 * Uninstall an app by spoken name via winget in a visible terminal, so the
 * user sees exactly what's being removed and any confirmation prompts.
 * Falls back to the Windows "Installed apps" settings page.
 */
async function uninstallApp(name: string): Promise<string> {
  const id = await wingetInstalledId(name)
  if (id) {
    const child = spawn(
      'cmd.exe',
      [
        '/c',
        'start',
        'EchoFlow uninstaller',
        'cmd',
        '/k',
        `winget uninstall --id "${id}" --accept-source-agreements`,
      ],
      { detached: true, stdio: 'ignore', windowsHide: true },
    )
    child.unref()
    return `Uninstalling ${name} (${id}) — check the uninstaller window`
  }

  await openUrl('ms-settings:appsfeatures')
  return `Couldn't match "${name}" to an installed package — opened Installed Apps settings`
}

async function systemAction(target: string, query?: string, text?: string): Promise<string> {
  const desktop = await runDesktopAction(target, query, text)
  if (desktop) return desktop
  switch (target) {
    case 'screenshot':
      // Win+Shift+S via keybd_event
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void Chord() {
    const byte VK_LWIN = 0x5B, VK_SHIFT = 0x10, VK_S = 0x53, KEYUP = 0x0002;
    keybd_event(VK_LWIN, 0, 0, UIntPtr.Zero);
    keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);
    keybd_event(VK_S, 0, 0, UIntPtr.Zero);
    keybd_event(VK_S, 0, KEYUP, UIntPtr.Zero);
    keybd_event(VK_SHIFT, 0, KEYUP, UIntPtr.Zero);
    keybd_event(VK_LWIN, 0, KEYUP, UIntPtr.Zero);
  }
}
"@
[K]::Chord()
`,
      ])
      return 'Screenshot ready'
    case 'volume_up':
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `
Add-Type @"
using System.Runtime.InteropServices;
public class V { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, System.UIntPtr dwExtraInfo); }
"@
1..4 | ForEach-Object { [V]::keybd_event(0xAF, 0, 0, [UIntPtr]::Zero); [V]::keybd_event(0xAF, 0, 2, [UIntPtr]::Zero) }
`,
      ])
      return 'Volume up'
    case 'volume_down':
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `
Add-Type @"
using System.Runtime.InteropServices;
public class V { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, System.UIntPtr dwExtraInfo); }
"@
1..4 | ForEach-Object { [V]::keybd_event(0xAE, 0, 0, [UIntPtr]::Zero); [V]::keybd_event(0xAE, 0, 2, [UIntPtr]::Zero) }
`,
      ])
      return 'Volume down'
    case 'mute':
    case 'unmute':
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `
Add-Type @"
using System.Runtime.InteropServices;
public class V { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, System.UIntPtr dwExtraInfo); }
"@
[V]::keybd_event(0xAD, 0, 0, [UIntPtr]::Zero); [V]::keybd_event(0xAD, 0, 2, [UIntPtr]::Zero)
`,
      ])
      return target === 'unmute' ? 'Unmuted' : 'Muted'
    case 'lock':
      await execFileAsync('rundll32.exe', ['user32.dll,LockWorkStation'])
      return 'Locked'
    default:
      throw new Error(`Unknown system action: ${target}`)
  }
}

export async function executeAction(
  action: ParsedAction,
  options: { autoPaste: boolean },
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.action) {
      case 'dictate': {
        const text = action.responseText ?? action.rawText
        if (options.autoPaste) {
          await pasteText(text)
          if (action.submit) {
            await sleep(150)
            await pressEnter()
            return { success: true, message: 'Typed and sent (Enter)' }
          }
          return { success: true, message: 'Typed into active field' }
        }
        clipboard.writeText(text)
        if (action.submit) {
          await sleep(150)
          await runAutomation([{ text, delayMs: 100 }, { keys: '{ENTER}' }])
          return { success: true, message: 'Typed and sent (Enter)' }
        }
        return { success: true, message: 'Copied to clipboard' }
      }
      case 'open_app': {
        if (!action.target) throw new Error('No app target')
        const launched = await openApp(action.target)
        return { success: true, message: `Opened ${launched}` }
      }
      case 'send_message': {
        const contact = action.query
        const message = action.responseText ?? ''
        if (!contact || !message) throw new Error('Need a contact and a message')
        const submit = Boolean(action.submit)
        const result = await sendAppMessage(
          action.target || 'whatsapp',
          contact,
          message,
          submit,
        )
        return { success: true, message: result }
      }
      case 'open_url':
        if (!action.target) throw new Error('No URL')
        if (action.chromeProfile) {
          await openInChromeProfile(action.chromeProfile, action.target)
        } else {
          await openUrl(action.target)
        }
        return {
          success: true,
          message: action.chromeProfile
            ? `Opened in Chrome (${action.chromeProfile}): ${action.target}`
            : `Opened ${action.target}`,
        }
      case 'youtube_search': {
        const q = action.query ?? action.target
        if (!q) throw new Error('No search query')
        await youtubeSearch(q, action.query ? action.target : undefined)
        return { success: true, message: `YouTube: ${q}` }
      }
      case 'web_search': {
        const q = action.query ?? action.target
        if (!q) throw new Error('No search query')
        await webSearch(q, action.query ? action.target : undefined)
        return { success: true, message: `Search: ${q}` }
      }
      case 'system':
        if (!action.target) throw new Error('No system target')
        return {
          success: true,
          message: await systemAction(action.target, action.query, action.responseText),
        }
      case 'keys': {
        // Keyboard shortcut in the focused app (SendKeys syntax, e.g. "^s")
        if (!action.target) throw new Error('No key sequence')
        await runAutomation([{ keys: action.target }])
        return { success: true, message: `Pressed ${action.target}` }
      }
      case 'install_app': {
        if (!action.target) throw new Error('No app to install')
        const message = await installApp(action.target)
        return { success: true, message }
      }
      case 'uninstall_app': {
        if (!action.target) throw new Error('No app to uninstall')
        const message = await uninstallApp(action.target)
        return { success: true, message }
      }
      case 'send_email': {
        const to = action.query
        const body = action.responseText ?? ''
        if (!to || !body) throw new Error('Need a recipient and a message body')
        const provider =
          (action.target || 'gmail').toLowerCase() === 'outlook' ? 'outlook' : 'gmail'
        const message = await sendEmail({
          provider,
          to,
          subject: action.subject,
          body,
          chromeProfile: action.chromeProfile,
        })
        return { success: true, message }
      }
      case 'clarify':
        return {
          success: true,
          message: action.responseText ?? 'Need a bit more info',
        }
      case 'reply':
        return {
          success: true,
          message: action.responseText ?? 'Done',
        }
      case 'macro': {
        const steps = action.steps ?? []
        // The app opened earlier in this workflow — typing/shortcut steps
        // must land in ITS window, so we re-focus it before each one.
        let focusTarget: string | null = null
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]
          if (step.action === 'open_app' && step.target) {
            focusTarget = await openApp(step.target)
            await sleep(800)
          } else if (step.action === 'dictate' || step.action === 'keys') {
            if (focusTarget) {
              await focusAppWindow(focusTarget)
              await sleep(400)
            }
            if (step.action === 'dictate') {
              // SendKeys, not clipboard — keeps the user's clipboard intact
              const content = step.responseText ?? step.rawText
              await runAutomation([{ text: content }])
            } else {
              await executeAction(step, options)
            }
          } else {
            await executeAction(step, options)
          }
          if (i < steps.length - 1) await sleep(400)
        }
        if (action.submit) {
          await sleep(300)
          await pressEnter()
          return { success: true, message: `Ran ${steps.length} steps and sent (Enter)` }
        }
        return { success: true, message: `Ran ${steps.length} steps` }
      }
      case 'unknown':
        return {
          success: false,
          message: action.responseText ?? `Could not understand: "${action.rawText}"`,
        }
      default:
        return { success: false, message: 'Unhandled action' }
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Execution failed',
    }
  }
}

export { pasteText }
