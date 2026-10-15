import { useEffect, useRef } from 'react'
import { arrayBufferToBase64, encodeWavMono16 } from '../audio/wav'

/**
 * The mic stream is pre-warmed at mount and kept open,
 * so recording starts instantly on PTT down (no 1-3s getUserMedia delay that
 * was cutting off the start of speech).
 * On PTT up: webm/opus blob → decode → 16 kHz mono WAV → main process STT.
 */
export function useSpeechBridge(enabled = true): void {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const activeRef = useRef(false)
  const hangoverRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startAtRef = useRef(0)

  useEffect(() => {
    if (!enabled || !window.echoflow) return
    let disposed = false

    const baseAudio = {
      // EC/NS off: raw signal is best for cloud STT and preserves quiet speech
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      channelCount: 1,
    }

    const getStreamFor = (deviceId?: string): Promise<MediaStream> =>
      navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { ...baseAudio, deviceId: { exact: deviceId } } : baseAudio,
      })

    /** True if the stream carries any real signal (a live mic always has a noise floor). */
    const hasSignal = async (stream: MediaStream, ms = 450): Promise<boolean> => {
      const ctx = new AudioContext()
      try {
        await ctx.resume()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        const data = new Float32Array(analyser.fftSize)
        const deadline = Date.now() + ms
        let peak = 0
        while (Date.now() < deadline) {
          analyser.getFloatTimeDomainData(data)
          for (let i = 0; i < data.length; i++) {
            const a = Math.abs(data[i])
            if (a > peak) peak = a
          }
          if (peak > 0.0004) return true
          await new Promise((r) => setTimeout(r, 60))
        }
        return peak > 0.0004
      } finally {
        await ctx.close()
      }
    }

    /**
     * The Windows default mic can be an unplugged jack that yields pure
     * digital silence. Probe candidates and lock onto one with real signal.
     */
    const acquireStream = async (): Promise<MediaStream | null> => {
      const current = streamRef.current
      if (current && current.getAudioTracks().some((t) => t.readyState === 'live')) {
        return current
      }
      current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null

      const savedId = localStorage.getItem('echoflow-mic-id') || undefined
      let candidates: (string | undefined)[] = [savedId, undefined]
      try {
        // Need one granted stream before labels/devices enumerate fully
        const probe = await getStreamFor(undefined)
        const devices = await navigator.mediaDevices.enumerateDevices()
        probe.getTracks().forEach((t) => t.stop())
        const inputs = devices
          .filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default')
          .filter((d) => !/stereo mix|virtual|loopback/i.test(d.label))
        candidates = [
          savedId,
          undefined,
          ...inputs.map((d) => d.deviceId),
        ].filter((v, i, arr) => arr.indexOf(v) === i)
      } catch {
        // fall through with default candidates
      }

      for (const id of candidates) {
        if (disposed) return null
        let stream: MediaStream | null = null
        try {
          stream = await getStreamFor(id)
        } catch {
          continue
        }
        try {
          const label = stream.getAudioTracks()[0]?.label ?? 'unknown'
          const ok = await hasSignal(stream)
          console.log('[capture] probe', label, id ?? '(default)', 'signal:', ok)
          if (ok) {
            if (disposed) {
              stream.getTracks().forEach((t) => t.stop())
              return null
            }
            if (id) localStorage.setItem('echoflow-mic-id', id)
            streamRef.current = stream
            stream.getAudioTracks().forEach((track) => {
              track.onended = () => {
                if (!disposed && streamRef.current === stream) {
                  streamRef.current = null
                  void acquireStream()
                }
              }
            })
            return stream
          }
        } catch {
          // probe failed; try next device
        }
        stream.getTracks().forEach((t) => t.stop())
      }

      console.error('[capture] no microphone with live signal found')
      localStorage.removeItem('echoflow-mic-id')
      return null
    }

    const stopRecorderOnly = () => {
      if (hangoverRef.current) {
        clearTimeout(hangoverRef.current)
        hangoverRef.current = null
      }
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop()
        }
      } catch {
        // ignore
      }
      recorderRef.current = null
      chunksRef.current = []
    }

    const webmToWav16k = async (blob: Blob): Promise<ArrayBuffer> => {
      const raw = await blob.arrayBuffer()
      const ctx = new AudioContext()
      let decoded: AudioBuffer
      try {
        decoded = await ctx.decodeAudioData(raw.slice(0))
      } finally {
        await ctx.close()
      }

      const sampleRate = 16000
      const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate))
      const offline = new OfflineAudioContext(1, frames, sampleRate)
      const source = offline.createBufferSource()
      source.buffer = decoded
      source.connect(offline.destination)
      source.start(0)
      const rendered = await offline.startRendering()
      const samples = rendered.getChannelData(0)

      // Light RMS normalize toward speech level
      let sumSq = 0
      let peak = 0
      for (let i = 0; i < samples.length; i++) {
        const a = Math.abs(samples[i])
        if (a > peak) peak = a
        sumSq += samples[i] * samples[i]
      }
      const rms = Math.sqrt(sumSq / Math.max(1, samples.length))
      let gain = rms > 1e-5 ? Math.min(0.14 / rms, 4.5) : 1
      if (peak * gain > 0.95) gain = 0.95 / Math.max(peak, 1e-5)
      const normalized = new Float32Array(samples.length)
      for (let i = 0; i < samples.length; i++) normalized[i] = samples[i] * gain
      return encodeWavMono16(normalized, sampleRate)
    }

    const startCapture = async () => {
      stopRecorderOnly()
      activeRef.current = true
      chunksRef.current = []
      startAtRef.current = Date.now()

      const stream = await acquireStream()
      if (!stream || !activeRef.current) {
        if (activeRef.current) {
          activeRef.current = false
          void window.echoflow.sendPartial('Microphone unavailable')
          void window.echoflow.sendAudio('', 'audio/wav')
        }
        return
      }

      try {
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : undefined

        const recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 })
          : new MediaRecorder(stream)

        recorderRef.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.start(100)
        void window.echoflow.sendPartial('Listening…')
      } catch (err) {
        console.error('[capture] recorder failed', err)
        activeRef.current = false
        void window.echoflow.sendPartial('Recorder failed')
        void window.echoflow.sendAudio('', 'audio/wav')
      }
    }

    const finalize = async () => {
      activeRef.current = false
      const recorder = recorderRef.current
      const durationMs = Date.now() - startAtRef.current

      const blob: Blob = await new Promise((resolve) => {
        if (!recorder || recorder.state === 'inactive') {
          resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
          return
        }
        recorder.onstop = () => {
          resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
        }
        try {
          recorder.requestData()
        } catch {
          // ignore
        }
        try {
          recorder.stop()
        } catch {
          resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
        }
      })

      // Keep the mic stream alive for the next session (pre-warmed)
      recorderRef.current = null
      chunksRef.current = []

      console.log('[capture] finalize blob:', blob.size, 'bytes, session:', durationMs, 'ms')
      if (blob.size < 400 || durationMs < 250) {
        void window.echoflow.sendAudio('', 'audio/wav')
        return
      }

      try {
        const wav = await webmToWav16k(blob)
        void window.echoflow.sendAudio(arrayBufferToBase64(wav), 'audio/wav')
      } catch (err) {
        console.error('[capture] wav convert failed', err)
        void window.echoflow.sendAudio('', 'audio/wav')
      }
    }

    const stopCapture = () => {
      if (hangoverRef.current) clearTimeout(hangoverRef.current)
      void window.echoflow.sendPartial('Finishing…')
      // Short hangover so trailing words aren't clipped
      hangoverRef.current = setTimeout(() => {
        hangoverRef.current = null
        void finalize()
      }, 350)
    }

    // Pre-warm the microphone so PTT capture starts instantly
    console.log('[capture] bridge mounted, pre-warming mic')
    void acquireStream()

    const unsubStart = window.echoflow.onVoiceStart(() => {
      console.log('[capture] voice:start received')
      void startCapture()
    })
    const unsubStop = window.echoflow.onVoiceStop(() => {
      stopCapture()
    })

    return () => {
      disposed = true
      unsubStart()
      unsubStop()
      activeRef.current = false
      stopRecorderOnly()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [enabled])
}
