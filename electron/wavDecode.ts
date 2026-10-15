/**
 * Decode 16-bit mono PCM WAV → Float32Array in [-1, 1].
 */
export function decodeWavPcm16Mono(buffer: Buffer): { samples: Float32Array; sampleRate: number } {
  if (buffer.length < 44) throw new Error('WAV too short')
  const riff = buffer.toString('ascii', 0, 4)
  if (riff !== 'RIFF') throw new Error('Not RIFF')

  let offset = 12
  let sampleRate = 16000
  let bitsPerSample = 16
  let channels = 1
  let dataOffset = -1
  let dataSize = 0

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const next = offset + 8 + size
    if (id === 'fmt ') {
      channels = buffer.readUInt16LE(offset + 10)
      sampleRate = buffer.readUInt32LE(offset + 12)
      bitsPerSample = buffer.readUInt16LE(offset + 22)
    } else if (id === 'data') {
      dataOffset = offset + 8
      dataSize = size
      break
    }
    offset = next + (size % 2) // word align
  }

  if (dataOffset < 0) throw new Error('No data chunk')
  if (bitsPerSample !== 16) throw new Error('Only 16-bit PCM supported')

  const sampleCount = Math.floor(dataSize / 2 / channels)
  const samples = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    // take first channel if multi
    const s = buffer.readInt16LE(dataOffset + i * channels * 2)
    samples[i] = s / (s < 0 ? 0x8000 : 0x7fff)
  }
  return { samples, sampleRate }
}

/** Peak/RMS normalize toward a speech-friendly level without hard clipping. */
export function normalizeSpeech(samples: Float32Array, targetRms = 0.12): Float32Array {
  let sumSq = 0
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
    sumSq += samples[i] * samples[i]
  }
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length))
  if (rms < 1e-5) return samples

  let gain = targetRms / rms
  // Cap so we don't explode noise floor; also respect peak headroom
  gain = Math.min(gain, 6)
  if (peak * gain > 0.95) gain = 0.95 / peak

  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}
