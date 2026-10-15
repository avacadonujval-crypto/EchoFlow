import fs from 'node:fs'
import path from 'node:path'
import { trimSilence } from '../electron/micCapture'
import { transcribeAudio } from '../electron/gemini'

async function main() {
  const wav = fs.readFileSync(path.join(process.env.TEMP ?? '', 'tts-direct.wav'))
  const raw = wav.subarray(44)
  const silence = Buffer.alloc(32000 * 2)
  const trimmed = trimSilence(Buffer.concat([silence, raw, silence]))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + trimmed.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(16000, 24)
  header.writeUInt32LE(32000, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(trimmed.length, 40)
  const t0 = Date.now()
  const text = await transcribeAudio(
    Buffer.concat([header, trimmed]).toString('base64'),
    'audio/wav',
  )
  console.log(`trimmed transcription [${Date.now() - t0}ms]:`, JSON.stringify(text))
}

void main()
