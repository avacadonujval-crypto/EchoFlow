/**
 * Windows actions a person usually does by hand: media keys, brightness, folders, phone, power.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { buildInStudio } from './studio'

const execFileAsync = promisify(execFile)

async function ps(command: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { windowsHide: true, timeout: 20000 },
  )
  return String(stdout ?? '').trim()
}

async function tap(vk: number, times = 1): Promise<void> {
  const body = Array.from({ length: times }, () => `[K]::Tap(${vk})`).join('; ')
  await ps(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void Tap(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
  }
}
"@
${body}
`)
}

async function chord(keys: number[]): Promise<void> {
  const down = keys.map((k) => `[K]::keybd_event(${k}, 0, 0, [UIntPtr]::Zero)`).join('; ')
  const up = [...keys].reverse().map((k) => `[K]::keybd_event(${k}, 0, 2, [UIntPtr]::Zero)`).join('; ')
  await ps(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
${down}; ${up}
`)
}

async function brightness(delta: number): Promise<string> {
  const script = `
$cur = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop
$level = [int]$cur.CurrentBrightness
$next = [Math]::Max(0, [Math]::Min(100, $level + (${delta})))
$methods = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop
Invoke-CimMethod -InputObject $methods -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = $next } | Out-Null
Write-Output $next
`
  const next = await ps(script)
  return `Brightness ${next || 'updated'}%`
}

async function wifi(on: boolean): Promise<string> {
  if (!on) {
    await ps('netsh wlan disconnect')
    return 'Wi-Fi disconnected'
  }
  const profiles = await ps('netsh wlan show profiles')
  const name = profiles.match(/All User Profile\s*:\s*(.+)/i)?.[1]?.trim()
  if (!name) return 'No saved Wi-Fi network to join'
  await ps(`netsh wlan connect name="${name.replace(/"/g, '')}"`)
  return `Connecting to ${name}`
}

export async function runDesktopAction(
  target: string,
  query?: string,
  text?: string,
): Promise<string | null> {
  switch (target) {
    case 'media_play':
      await tap(0xb3)
      return 'Play / pause'
    case 'media_next':
      await tap(0xb0)
      return 'Next track'
    case 'media_prev':
      await tap(0xb1)
      return 'Previous track'
    case 'brightness_up':
      return brightness(15)
    case 'brightness_down':
      return brightness(-15)
    case 'wifi_on':
      return wifi(true)
    case 'wifi_off':
      return wifi(false)
    case 'show_desktop':
      await chord([0x5b, 0x44])
      return 'Desktop'
    case 'minimize':
      await chord([0x5b, 0x28])
      return 'Minimized'
    case 'maximize':
      await chord([0x5b, 0x26])
      return 'Maximized'
    case 'close_window':
      await chord([0x12, 0x73])
      return 'Closed the window'
    case 'switch_window':
      await chord([0x12, 0x09])
      return 'Switched window'
    case 'task_view':
      await chord([0x5b, 0x09])
      return 'Task view'
    case 'night_light':
      await ps('Start-Process "ms-settings:nightlight"')
      return 'Opened night light'
    case 'battery': {
      const level = await ps(
        '(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty EstimatedChargeRemaining)',
      )
      if (!level) return 'No battery on this PC. It is running on power.'
      return `Battery ${level}%`
    }
    case 'sleep':
      await ps(`
Add-Type -Name EchoSleep -Namespace EchoFlow -MemberDefinition '[DllImport("Powrprof.dll")] public static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);'
[EchoFlow.EchoSleep]::SetSuspendState($false, $false, $false) | Out-Null
`)
      return 'Going to sleep'
    case 'shutdown':
      await ps('shutdown /s /t 5')
      return 'Shutting down in 5 seconds'
    case 'restart':
      await ps('shutdown /r /t 5')
      return 'Restarting in 5 seconds'
    case 'sign_out':
      await ps('shutdown /l')
      return 'Signing out'
    case 'empty_recycle':
      await ps('Clear-RecycleBin -Force -ErrorAction SilentlyContinue')
      return 'Recycle bin emptied'
    case 'notify':
      return (text || 'Reminder').slice(0, 180)
    case 'call': {
      const digits = (query ?? '').replace(/[^\d+]/g, '')
      if (digits.length < 6) throw new Error('Need a phone number')
      await ps(`Start-Process "tel:${digits}"`)
      return `Calling ${digits}`
    }
    case 'open_phone':
      await ps('Start-Process "ms-phone:"')
      return 'Opened your phone'
    case 'build': {
      const brief = (text || query || '').trim()
      if (!brief) throw new Error('Say what the website should be')
      return buildInStudio(brief)
    }
    default:
      return null
  }
}
