/**
 * Test Gemini STT + Wispr-style clean on synthesized speech.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { transcribeAudio, cleanDictationText } from '../electron/gemini'
import { polishTranscript } from '../electron/transcriptPolish'
import { matchLocalCommand } from '../electron/commands/matcher'
import { executeAction } from '../electron/executor'

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
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true })
}

async function main() {
  const phrase = 'um open YouTube and search for the best video which teaches us programming'
  const wavPath = path.join(os.tmpdir(), `echoflow-gemini-stt-${Date.now()}.wav`)
  console.log('Synthesizing:', phrase)
  await synthesizeWav(phrase, wavPath)
  const base64 = fs.readFileSync(wavPath).toString('base64')
  console.log('WAV bytes', fs.statSync(wavPath).size)

  console.log('Gemini STT…')
  let text = await transcribeAudio(base64, 'audio/wav')
  text = polishTranscript(text)
  console.log('Raw STT:', text)

  console.log('Gemini clean…')
  text = polishTranscript(await cleanDictationText(text))
  console.log('Cleaned:', text)

  const { action } = matchLocalCommand(text, [], [])
  console.log('Action:', action)
  if (!action) process.exit(1)

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
