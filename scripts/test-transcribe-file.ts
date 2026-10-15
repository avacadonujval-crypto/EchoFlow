import fs from 'node:fs'
import path from 'node:path'
import { transcribeAudio } from '../electron/gemini'

async function main() {
  const wavPath = path.join(
    process.env.APPDATA ?? '',
    'echoflow',
    'last-capture.wav',
  )
  const wav = fs.readFileSync(wavPath)
  console.log('wav bytes:', wav.length)
  try {
    const text = await transcribeAudio(wav.toString('base64'), 'audio/wav')
    console.log('TRANSCRIPT:', JSON.stringify(text))
  } catch (err) {
    console.error('TRANSCRIBE FAILED:', err)
  }
}

void main()
