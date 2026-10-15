/**
 * End-to-end: synthesize speech → Gemini transcribe → match → execute.
 * Run: npx tsx scripts/test-whisper-pipeline.ts
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { transcribeAudio } from '../electron/gemini'
import { matchLocalCommand } from '../electron/commands/matcher'
import { executeAction } from '../electron/executor'

const execFileAsync = promisify(execFile)

async function synthesizeWav(text: string, outPath: string): Promise<void> {
  const ps = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -2
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
  const phrase = 'open YouTube and search for the best video which teaches us programming'
  const wavPath = path.join(os.tmpdir(), `echoflow-test-${Date.now()}.wav`)
  console.log('Synthesizing:', phrase)
  await synthesizeWav(phrase, wavPath)
  const buf = fs.readFileSync(wavPath)
  const base64 = buf.toString('base64')
  console.log('WAV bytes:', buf.length)

  console.log('Transcribing with Gemini…')
  const transcript = await transcribeAudio(base64, 'audio/wav')
  console.log('Transcript:', JSON.stringify(transcript))

  const { action } = matchLocalCommand(transcript, [], [])
  console.log('Matched:', action)

  if (!action) {
    console.error('FAIL: no action matched')
    process.exit(1)
  }

  const result = await executeAction(action, { autoPaste: false })
  console.log('Execute:', result)

  try {
    fs.unlinkSync(wavPath)
  } catch {
    // ignore
  }

  if (!result.success) process.exit(1)
  console.log('PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
