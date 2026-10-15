/**
 * Main-process microphone capture via ffmpeg (DirectShow).
 * Chromium's WASAPI capture yields pure silence with some Realtek drivers,
 * so this is the primary capture path; the renderer MediaRecorder bridge
 * stays as fallback when ffmpeg is unavailable.
 *
 * ffmpeg streams raw PCM continuously into a rolling buffer, so push-to-talk
 * has zero startup latency and includes a short pre-roll (no clipped words).
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { app } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SAMPLE_RATE = 16000
const BYTES_PER_SEC = SAMPLE_RATE * 2 // s16le mono
const ROLLING_CAP = BYTES_PER_SEC * 90 // keep last 90s
const PRE_ROLL = Math.floor(BYTES_PER_SEC * 0.45) // 450ms before key-down — catches first syllable

let ffmpegPath: string | null = null
let deviceName: string | null = null
let initPromise: Promise<void> | null = null

let proc: ChildProcess | null = null
let chunks: Buffer[] = []
let basePos = 0 // absolute stream position of chunks[0]
let totalPos = 0 // absolute stream position of the end
let lastDataAt = 0
let markerPos: number | null = null
let quitting = false

function findFfmpegInWinget(): string | null {
  try {
    const packagesDir = path.join(
      os.homedir(),
      'AppData',
      'Local',
      'Microsoft',
      'WinGet',
      'Packages',
    )
    if (!fs.existsSync(packagesDir)) return null
    for (const pkg of fs.readdirSync(packagesDir)) {
      if (!/ffmpeg/i.test(pkg)) continue
      const pkgDir = path.join(packagesDir, pkg)
      for (const sub of fs.readdirSync(pkgDir)) {
        const candidate = path.join(pkgDir, sub, 'bin', 'ffmpeg.exe')
        if (fs.existsSync(candidate)) return candidate
      }
    }
  } catch {
    // ignore
  }
  return null
}

function findFfmpegOnPath(): Promise<string | null> {
  return new Promise((resolve) => {
    const p = spawn('where.exe', ['ffmpeg'], { windowsHide: true })
    let out = ''
    p.stdout?.on('data', (d: Buffer) => (out += d.toString()))
    p.on('close', (code) => {
      const first = out.split(/\r?\n/).find((l) => l.trim().endsWith('.exe'))
      resolve(code === 0 && first ? first.trim() : null)
    })
    p.on('error', () => resolve(null))
  })
}

function listAudioDevices(ffmpeg: string): Promise<string[]> {
  return new Promise((resolve) => {
    const p = spawn(
      ffmpeg,
      ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
      { windowsHide: true },
    )
    let err = ''
    p.stderr?.on('data', (d: Buffer) => (err += d.toString()))
    const finish = () => {
      const devices: string[] = []
      for (const line of err.split(/\r?\n/)) {
        const m = line.match(/"([^"]+)"\s*\(audio\)/)
        if (m) devices.push(m[1])
      }
      resolve(devices)
    }
    p.on('close', finish)
    p.on('error', () => resolve([]))
    setTimeout(() => {
      try {
        p.kill()
      } catch {
        // ignore
      }
    }, 10000)
  })
}

function pushChunk(d: Buffer): void {
  chunks.push(d)
  totalPos += d.length
  lastDataAt = Date.now()
  while (totalPos - basePos > ROLLING_CAP && chunks.length > 1) {
    basePos += chunks[0].length
    chunks.shift()
  }
}

function startStream(): void {
  if (!ffmpegPath || !deviceName || proc || quitting) return

  chunks = []
  basePos = totalPos // keep absolute positions monotonic across restarts

  const p = spawn(
    ffmpegPath,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'dshow',
      '-audio_buffer_size',
      '30',
      '-i',
      `audio=${deviceName}`,
      '-ar',
      String(SAMPLE_RATE),
      '-ac',
      '1',
      '-f',
      's16le',
      'pipe:1',
    ],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  )
  proc = p

  p.stdout?.on('data', pushChunk)
  p.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString().trim()
    if (msg) console.error('[mic] ffmpeg:', msg)
  })
  p.on('error', (err) => {
    console.error('[mic] ffmpeg error', err)
  })
  p.on('close', (code) => {
    if (proc === p) proc = null
    if (!quitting) {
      console.log('[mic] ffmpeg exited (code', code, ') — restarting in 2s')
      setTimeout(() => startStream(), 2000)
    }
  })

  console.log('[mic] continuous capture started:', deviceName)
}

export function initNativeCapture(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      ffmpegPath = (await findFfmpegOnPath()) ?? findFfmpegInWinget()
      if (!ffmpegPath) {
        console.log('[mic] ffmpeg not found — falling back to renderer capture')
        return
      }
      const devices = await listAudioDevices(ffmpegPath)
      deviceName =
        devices.find((d) => /microphone/i.test(d) && !/stereo mix|virtual/i.test(d)) ??
        devices.find((d) => !/stereo mix|virtual/i.test(d)) ??
        devices[0] ??
        null
      console.log('[mic] ffmpeg:', ffmpegPath, '| device:', deviceName)
      startStream()
    })()
  }
  return initPromise
}

function streamHealthy(): boolean {
  return Boolean(proc) && Date.now() - lastDataAt < 3000
}

export async function startNativeCapture(): Promise<boolean> {
  await initNativeCapture()
  if (!streamHealthy()) {
    markerPos = null
    return false
  }
  let start = totalPos - PRE_ROLL
  if (start < basePos) start = basePos
  markerPos = start - (start % 2) // keep sample alignment
  return true
}

function encodeWav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(BYTES_PER_SEC, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/**
 * Trim leading/trailing silence (keeps 200ms padding). Less audio to upload
 * means faster transcription and fewer noise-hallucinations.
 */
export function trimSilence(pcm: Buffer): Buffer {
  const FRAME = Math.floor(BYTES_PER_SEC * 0.02) & ~1 // 20ms, sample-aligned
  const PAD = Math.floor(BYTES_PER_SEC * 0.2) & ~1 // keep 200ms around speech
  const frames = Math.floor(pcm.length / FRAME)
  if (frames < 10) return pcm

  const frameRms = (f: number): number => {
    let sum = 0
    const start = f * FRAME
    for (let i = start; i + 1 < start + FRAME; i += 2) {
      const s = pcm.readInt16LE(i)
      sum += s * s
    }
    return Math.sqrt(sum / (FRAME / 2))
  }

  // Adaptive threshold: noise floor (20th percentile frame) × 2.5
  const levels: number[] = []
  for (let f = 0; f < frames; f++) levels.push(frameRms(f))
  const sorted = [...levels].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * 0.2)]
  const threshold = Math.max(75, floor * 2.2)

  let first = -1
  let last = -1
  for (let f = 0; f < frames; f++) {
    if (levels[f] > threshold) {
      if (first === -1) first = f
      last = f
    }
  }
  if (first === -1) return pcm // no speech-like frames; upstream silence guard decides

  const start = Math.max(0, first * FRAME - PAD)
  const end = Math.min(pcm.length, (last + 1) * FRAME + PAD)
  return pcm.subarray(start, end)
}

/** Boost quiet recordings toward speech level (helps whispers / distant mics). */
function normalizePcm(pcm: Buffer): Buffer {
  const n = Math.floor(pcm.length / 2)
  if (n === 0) return pcm
  let sumSq = 0
  let peak = 0
  for (let i = 0; i < n; i++) {
    const s = pcm.readInt16LE(i * 2) / 32768
    sumSq += s * s
    const a = Math.abs(s)
    if (a > peak) peak = a
  }
  const rms = Math.sqrt(sumSq / n)
  if (rms < 1e-6) return pcm
  // Target higher RMS for whispers; allow more gain than before
  let gain = Math.min(0.12 / rms, 45)
  if (peak * gain > 0.97) gain = 0.97 / peak
  if (gain <= 1.02) return pcm
  const out = Buffer.alloc(pcm.length)
  for (let i = 0; i < n; i++) {
    let sample = pcm.readInt16LE(i * 2) * gain
    // Gentle soft-clip compression on loud peaks
    const norm = sample / 32768
    const compressed =
      Math.abs(norm) > 0.85
        ? Math.sign(norm) * (0.85 + (Math.abs(norm) - 0.85) * 0.35)
        : norm
    let v = Math.round(compressed * 32768)
    if (v > 32767) v = 32767
    if (v < -32768) v = -32768
    out.writeInt16LE(v, i * 2)
  }
  return out
}

export async function stopNativeCapture(): Promise<{ base64: string; mimeType: string } | null> {
  const from = markerPos
  markerPos = null
  if (from === null) return null

  // Tail buffer so the last word / "send it" isn't clipped
  await new Promise((r) => setTimeout(r, 400))

  const all = Buffer.concat(chunks)
  const offset = Math.max(0, from - basePos)
  const raw = all.subarray(offset)
  if (raw.length < BYTES_PER_SEC * 0.28) return null

  // Pure digital silence = mic muted at the OS level (e.g. Fn mic-mute key).
  // Don't send it to STT — the model would hallucinate text.
  let rawPeak = 0
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const a = Math.abs(raw.readInt16LE(i))
    if (a > rawPeak) rawPeak = a
  }
  if (rawPeak < 40) {
    console.log('[mic] capture is digital silence — microphone likely muted in Windows')
    return null
  }

  const pcm = normalizePcm(trimSilence(raw))

  const wav = encodeWav(pcm)

  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'last-capture.wav'), wav)
  } catch {
    // ignore
  }

  console.log('[mic] captured', (pcm.length / BYTES_PER_SEC).toFixed(2), 'seconds')
  return { base64: wav.toString('base64'), mimeType: 'audio/wav' }
}

export function shutdownNativeCapture(): void {
  quitting = true
  try {
    proc?.stdin?.write('q')
    proc?.kill()
  } catch {
    // ignore
  }
  proc = null
}
