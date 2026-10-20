/** Speak a short clarification with the Windows voice. */
import { spawn } from 'node:child_process'

export function speak(text: string): void {
  const clean = text.replace(/\s+/g, ' ').replace(/["\r\n]/g, '').trim().slice(0, 180)
  if (!clean) return
  const safe = clean.replace(/'/g, "''")
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${safe}')`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  )
  child.unref()
}
