/**
 * Global Ctrl+Alt push-to-talk.
 * A PowerShell watcher polls the key state and prints down/up.
 * The script is run from a file so quotes are not mangled on the command line.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const PTT_LABEL = 'Ctrl + Alt'

const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class EchoFlowKeyState {
  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int vKey);
}
"@
function Test-Down([int]$key) {
  return ([EchoFlowKeyState]::GetAsyncKeyState($key) -band 0x8000) -ne 0
}
$active = $false
while ($true) {
  $ctrl = (Test-Down 0x11) -or (Test-Down 0xA2) -or (Test-Down 0xA3)
  $alt = (Test-Down 0x12) -or (Test-Down 0xA4) -or (Test-Down 0xA5)
  $both = $ctrl -and $alt
  if ($both -and -not $active) {
    $active = $true
    Write-Output 'down'
    [Console]::Out.Flush()
  }
  elseif (-not $both -and $active) {
    $active = $false
    Write-Output 'up'
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds 25
}
`

export function startPushToTalk(emitter: {
  emit: (event: 'ptt-down' | 'ptt-up') => boolean
}): () => void {
  const scriptPath = path.join(os.tmpdir(), 'echoflow-ptt.ps1')
  fs.writeFileSync(scriptPath, SCRIPT.trimStart(), 'utf8')

  let stopped = false
  let child: ChildProcess | null = null
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  const listen = (proc: ChildProcess) => {
    let buffer = ''
    proc.stdout?.setEncoding('utf8')
    proc.stdout?.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const text = line.trim()
        if (text === 'down') emitter.emit('ptt-down')
        if (text === 'up') emitter.emit('ptt-up')
      }
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[hotkeys]', chunk.toString())
    })
  }

  const launch = () => {
    if (stopped) return
    child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    listen(child)
    child.on('exit', (code) => {
      console.error('[hotkeys] watcher exited', code)
      child = null
      if (stopped) return
      restartTimer = setTimeout(launch, 500)
    })
  }

  launch()

  return () => {
    stopped = true
    if (restartTimer) clearTimeout(restartTimer)
    try {
      child?.kill()
    } catch {
      // ignore
    }
  }
}
