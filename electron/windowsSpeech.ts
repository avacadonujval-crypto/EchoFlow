/**
 * Hold-to-talk Windows STT using System.Speech (on-device).
 * startSession() on PTT down, stopSession() on PTT up → transcript.
 */
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'

const SESSION_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
try {
  $engine.SetInputToDefaultAudioDevice()
} catch {
  Write-Output 'ERROR:NO_MIC'
  [Console]::Out.Flush()
  exit 1
}
$engine.UnloadAllGrammars()
$engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$script:finals = New-Object System.Collections.Generic.List[string]
$script:partial = ''

$engine.add_SpeechRecognized({
  param($sender, $e)
  if ($null -ne $e.Result -and -not [string]::IsNullOrWhiteSpace($e.Result.Text)) {
    $script:finals.Add($e.Result.Text.Trim())
    Write-Output ('FINAL:' + $e.Result.Text.Trim())
    [Console]::Out.Flush()
  }
})
$engine.add_SpeechHypothesized({
  param($sender, $e)
  if ($null -ne $e.Result -and -not [string]::IsNullOrWhiteSpace($e.Result.Text)) {
    $script:partial = $e.Result.Text.Trim()
    Write-Output ('PARTIAL:' + $script:partial)
    [Console]::Out.Flush()
  }
})

$engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
Write-Output 'READY'
[Console]::Out.Flush()

# Block until parent writes stop / closes stdin
$null = [Console]::In.ReadLine()

try { $engine.RecognizeAsyncStop() } catch {}
Start-Sleep -Milliseconds 500
$joined = ($script:finals -join ' ').Trim()
if ([string]::IsNullOrWhiteSpace($joined) -and -not [string]::IsNullOrWhiteSpace($script:partial)) {
  $joined = $script:partial
}
Write-Output ('DONE:' + $joined)
[Console]::Out.Flush()
try { $engine.Dispose() } catch {}
`

let session: ChildProcessWithoutNullStreams | null = null
let latestPartial = ''
let latestFinals: string[] = []
let ready = false

export function isSpeechSessionActive(): boolean {
  return session !== null && !session.killed
}

export function startSpeechSession(onPartial?: (text: string) => void): void {
  stopSpeechSessionSync()
  latestPartial = ''
  latestFinals = []
  ready = false

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', SESSION_SCRIPT],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  )
  session = child

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  let buffer = ''
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      if (line === 'READY') {
        ready = true
        continue
      }
      if (line.startsWith('PARTIAL:')) {
        latestPartial = line.slice('PARTIAL:'.length).trim()
        const display = [...latestFinals, latestPartial].filter(Boolean).join(' ')
        onPartial?.(display)
      } else if (line.startsWith('FINAL:')) {
        const t = line.slice('FINAL:'.length).trim()
        if (t) latestFinals.push(t)
        latestPartial = ''
        onPartial?.(latestFinals.join(' '))
      } else if (line.startsWith('DONE:')) {
        const t = line.slice('DONE:'.length).trim()
        if (t) {
          latestFinals = [t]
          latestPartial = ''
        }
      } else if (line.startsWith('ERROR:')) {
        console.error('[speech]', line)
      }
    }
  })

  child.stderr.on('data', (chunk: string) => {
    console.error('[speech:err]', chunk)
  })

  child.on('exit', () => {
    if (session === child) session = null
  })
}

function stopSpeechSessionSync(): void {
  if (!session) return
  try {
    session.stdin.write('stop\n')
  } catch {
    // ignore
  }
  try {
    session.kill()
  } catch {
    // ignore
  }
  session = null
}

export function stopSpeechSession(): Promise<string> {
  const child = session
  if (!child) {
    return Promise.resolve([...latestFinals, latestPartial].filter(Boolean).join(' ').trim())
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      session = null
      const text = [...latestFinals, latestPartial].filter(Boolean).join(' ').trim()
      resolve(text)
    }

    const timeout = setTimeout(() => {
      try {
        child.kill()
      } catch {
        // ignore
      }
      finish()
    }, 2500)

    child.once('exit', () => {
      clearTimeout(timeout)
      finish()
    })

    try {
      child.stdin.write('stop\n')
      child.stdin.end()
    } catch {
      try {
        child.kill()
      } catch {
        // ignore
      }
      clearTimeout(timeout)
      finish()
    }
  })
}

export function getSpeechSessionSnapshot(): string {
  return [...latestFinals, latestPartial].filter(Boolean).join(' ').trim()
}

void ready
