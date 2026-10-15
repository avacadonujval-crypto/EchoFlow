/**
 * Test local Whisper on a synthesized phrase.
 * First run downloads the model (~70MB) into user cache.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { encodeWavMono16 } from '../src/audio/wav'
import { polishTranscript } from '../electron/transcriptPolish'
import { matchLocalCommand } from '../electron/commands/matcher'
import { executeAction } from '../electron/executor'

// Use Gemini path as control if whisper import fails in isolation
import { transcribeWithWhisper } from '../electron/whisperStt'

const execFileAsync = promisify(execFile)

async function synthesizeWav(text: string, outPath: string): Promise<void> {
  const ps = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1
$synth.Volume = 100
$synth.SetOutputToWaveFile(${JSON.stringify(outPath)})
$synth.Speak(${JSON.stringify(text)})
$synth.Dispose()
`
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  })
}

async function main() {
  const phrase = 'open YouTube and search for learn programming'
  const wavPath = path.join(os.tmpdir(), `echoflow-whisper-${Date.now()}.wav`)
  console.log('Synthesizing:', phrase)
  await synthesizeWav(phrase, wavPath)

  // Re-encode to 16k mono via our helpers if needed — System.Speech wav is usually 22k/44k
  // Whisper decoder handles sample rate; we pass base64 of file as-is after ensuring PCM
  const buf = fs.readFileSync(wavPath)
  const base64 = buf.toString('base64')
  console.log('WAV bytes', buf.length)

  console.log('Whisper transcribing (may download model on first run)…')
  const raw = await transcribeWithWhisper(base64)
  const transcript = polishTranscript(raw)
  console.log('Raw:', raw)
  console.log('Polished:', transcript)

  const { action } = matchLocalCommand(transcript, [], [])
  console.log('Action:', action)
  if (!action) process.exit(1)

  const result = await executeAction(action, { autoPaste: false })
  console.log('Execute:', result)

  try {
    fs.unlinkSync(wavPath)
  } catch {
    // ignore
  }
  void encodeWavMono16
  if (!result.success) process.exit(1)
  console.log('PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
