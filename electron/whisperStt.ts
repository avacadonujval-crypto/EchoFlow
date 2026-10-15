import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { app } from 'electron'
import { decodeWavPcm16Mono, normalizeSpeech } from './wavDecode'

type Transcriber = (
  audio: Float32Array | string,
  options?: Record<string, unknown>,
) => Promise<{ text?: string } | string>

let transcriberPromise: Promise<Transcriber> | null = null

async function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers')
      env.allowLocalModels = false
      env.useBrowserCache = false
      try {
        env.cacheDir = path.join(app.getPath('userData'), 'whisper-cache')
      } catch {
        // tests / early boot
      }

      const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
        quantized: true,
      })
      return pipe as unknown as Transcriber
    })()
  }
  return transcriberPromise
}

function resampleLinear(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate) return input
  const ratio = inRate / outRate
  const outLen = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio
    const i0 = Math.floor(src)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const t = src - i0
    out[i] = input[i0] * (1 - t) + input[i1] * t
  }
  return out
}

function extractText(result: { text?: string } | string): string {
  if (typeof result === 'string') return result.trim()
  return (result.text ?? '').trim()
}

/**
 * Local Whisper STT — primary path for accurate English dictation.
 */
export async function transcribeWithWhisper(wavBase64: string): Promise<string> {
  const buf = Buffer.from(wavBase64, 'base64')
  const { samples, sampleRate } = decodeWavPcm16Mono(buf)
  const normalized = normalizeSpeech(samples)
  const pcm16k = resampleLinear(normalized, sampleRate, 16000)

  // Duration sanity
  const seconds = pcm16k.length / 16000
  if (seconds < 0.15) return ''

  const transcriber = await getTranscriber()

  // Preferred: raw Float32 PCM @ 16 kHz
  try {
    const result = await transcriber(pcm16k, {
      language: 'en',
      task: 'transcribe',
      chunk_length_s: 30,
      return_timestamps: false,
    })
    const text = extractText(result)
    if (text) return text
  } catch (err) {
    console.error('[whisper] float path failed', err)
  }

  // Fallback: write temp wav and let transformers decode the file
  const tmp = path.join(os.tmpdir(), `echoflow-whisper-${Date.now()}.wav`)
  try {
    fs.writeFileSync(tmp, buf)
    const result = await transcriber(tmp, {
      language: 'en',
      task: 'transcribe',
      chunk_length_s: 30,
      return_timestamps: false,
    })
    return extractText(result)
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      // ignore
    }
  }
}

export async function warmupWhisper(): Promise<void> {
  try {
    await getTranscriber()
  } catch (err) {
    console.error('[whisper] warmup failed', err)
  }
}
