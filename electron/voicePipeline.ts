import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { applySnippets, matchLocalCommand } from './commands/matcher'
import { classifyWithGemini, transcribeAudio } from './gemini'
import { executeAction } from './executor'
import {
  addHistory,
  getAliases,
  getConnectedApps,
  getMacros,
  getMembership,
  getSettings,
  getSnippets,
  spokenWordTotal,
} from './storage'
import { speechOpen } from '../shared/voice'
import { getGeminiApiKey, hasGeminiApiKey } from './secrets'
import { initAppLauncher } from './appLauncher'
import {
  initNativeCapture,
  startNativeCapture,
  stopNativeCapture,
} from './micCapture'
import { dismissOverlay, hideOverlay, sendOverlayState, showOverlay } from './overlay'
import { PTT_LABEL } from './hotkeys'
import { polishTranscript } from './transcriptPolish'
import { isNonLatinScript } from './languages'
import {
  clearPending,
  getChatMessages,
  getPendingClarify,
  pushAssistantMessage,
  pushSystemMessage,
  pushUserMessage,
  setChatNotifiers,
  startClarify,
  clearChat,
  cancelClarify,
} from './chat'
import { mergeWebClarifyReply, prepareWebAction } from './webSessionPlan'
import { actionNeedsChromeAccount } from './chromeProfiles'
import { applySendItToAction } from './sendIt'

/** Customer-facing status. Internal service names stay in the log. */
function publicError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : ''
  console.error('[voice]', raw || err)
  if (
    /gemini|ffmpeg|electron|vite|react|generativelanguage|googleapis|api key|whisper|wispr|murmur|model/i.test(
      raw,
    )
  ) {
    return fallback
  }
  return raw || fallback
}
import type { ParsedAction } from './types'

let listening = false
let hubWindow: BrowserWindow | null = null
let handling = false
let nativeActive = false
let limitNotedAt = 0

let audioWaiter: {
  resolve: (payload: { base64: string; mimeType: string }) => void
  timer: ReturnType<typeof setTimeout>
} | null = null

export function setHubWindow(win: BrowserWindow | null): void {
  hubWindow = win
  setChatNotifiers(
    (messages) => notifyHub('chat:updated', messages),
    (route) => {
      notifyHub('app:navigate', route)
      if (hubWindow && !hubWindow.isDestroyed()) {
        if (hubWindow.isMinimized()) hubWindow.restore()
        hubWindow.show()
        hubWindow.focus()
      }
    },
  )
}

function notifyHub(channel: string, payload?: unknown): void {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send(channel, payload)
  }
}

export function isListening(): boolean {
  return listening
}

function waitForAudio(ms = 14000): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    if (audioWaiter) {
      clearTimeout(audioWaiter.timer)
      audioWaiter.resolve({ base64: '', mimeType: 'audio/wav' })
    }
    const timer = setTimeout(() => {
      audioWaiter = null
      resolve({ base64: '', mimeType: 'audio/wav' })
    }, ms)
    audioWaiter = { resolve, timer }
  })
}

function noteWordLimit(): void {
  const now = Date.now()
  if (now - limitNotedAt < 8000) return
  limitNotedAt = now
  if (!Notification.isSupported()) return
  new Notification({
    title: 'EchoFlow',
    body: 'You have used the words on this plan.',
  }).show()
}

function noteSpeechSetup(): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: 'EchoFlow',
    body: 'Speech is not set up on this install. Reinstall EchoFlow from the website.',
  }).show()
}

function noteNoAudio(): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: 'EchoFlow',
    body: 'No microphone audio captured. Check your mic and try again.',
  }).show()
}

export async function beginListening(): Promise<void> {
  if (listening || handling) return
  if (!speechOpen(spokenWordTotal(), getMembership().plan)) {
    noteWordLimit()
    return
  }
  if (!hasGeminiApiKey()) {
    noteSpeechSetup()
    return
  }
  listening = true

  const settings = getSettings()
  if (settings.showOverlay) showOverlay()

  sendOverlayState({
    listening: true,
    processing: false,
    transcript: '',
    status: `Listening… hold ${PTT_LABEL}`,
  })

  // Primary: ffmpeg capture in the main process (Chromium WASAPI capture is
  // silent with some drivers). Renderer MediaRecorder is the fallback.
  nativeActive = await startNativeCapture()
  if (!nativeActive) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('voice:start')
    }
  }
}

export async function endListening(): Promise<void> {
  if (!listening) return
  listening = false
  dismissOverlay()

  let payload: { base64: string; mimeType: string }
  if (nativeActive) {
    nativeActive = false
    payload = (await stopNativeCapture()) ?? { base64: '', mimeType: 'audio/wav' }
  } else {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('voice:stop')
    }
    payload = await waitForAudio(14000)
  }
  const { base64, mimeType } = payload
  let transcript = ''

  if (!base64) {
    noteNoAudio()
    notifyHub('session:result', { transcript: '', error: 'No microphone audio captured' })
    return
  }

  try {
    // Gemini STT with cleanup baked into the same call (single round-trip)
    const settings = getSettings()
    const speechLanguage = settings.speechLanguage ?? 'auto'
    const sttStart = Date.now()
    transcript = await transcribeAudio(
      base64,
      mimeType || 'audio/wav',
      speechLanguage,
    )
    transcript = polishTranscript(transcript)
    console.log(
      `[voice] stt ${Date.now() - sttStart}ms →`,
      JSON.stringify(transcript.slice(0, 80)),
    )
  } catch (err) {
    const message = publicError(err, 'Transcription failed')
    if (Notification.isSupported()) {
      new Notification({ title: 'EchoFlow', body: message }).show()
    }
    notifyHub('session:result', { transcript: '', error: message })
    return
  }

  await handleTranscript(transcript)
}

async function resolveAction(transcript: string): Promise<ParsedAction> {
  const settings = getSettings()
  const speechLanguage = settings.speechLanguage ?? 'auto'
  const aliases = getAliases()
  const macros = getMacros()
  const expanded = applySnippets(transcript, getSnippets())
  if (expanded) {
    return {
      action: 'dictate',
      responseText: expanded,
      source: 'local',
      rawText: transcript,
    }
  }

  // English-only local rules — skip for Kannada/Hindi/etc. so Gemini handles them
  if (!isNonLatinScript(transcript)) {
    const local = matchLocalCommand(transcript, aliases, macros)
    if (local.action) return local.action
  }

  if (!hasGeminiApiKey()) {
    return {
      action: 'dictate',
      responseText: transcript,
      source: 'dictation',
      rawText: transcript,
    }
  }

  return classifyWithGemini(
    getGeminiApiKey(),
    transcript,
    getConnectedApps().map((a) => a.name),
    speechLanguage,
  )
}

export async function handleTranscript(transcript: string): Promise<void> {
  if (handling) return
  if (!speechOpen(spokenWordTotal(), getMembership().plan)) {
    hideOverlay()
    return
  }
  handling = true
  try {
    const trimmed = transcript.trim()
    if (!trimmed) {
      return
    }

    try {
      let action: ParsedAction
      let loggedToChat = false

      // Continue a pending clarification (email provider / address / body)
      const pending = getPendingClarify()
      if (pending) {
        pushUserMessage(trimmed)
        loggedToChat = true

        // Free-form clarify (no structured slots) — treat reply as a fresh command
        if (pending.missing.length === 0) {
          clearPending()
          const resolveStart = Date.now()
          action = await resolveAction(trimmed)
          console.log(
            `[voice] resolve(after clarify) ${Date.now() - resolveStart}ms →`,
            action.action,
            action.target ?? action.query ?? '',
          )
        } else {
          const merged = mergeWebClarifyReply(
            pending.draft,
            pending.missing,
            trimmed,
          )
          const prepared = prepareWebAction(merged)
          if (prepared.missing.length && prepared.question) {
            startClarify(prepared.ready, prepared.missing, prepared.question)
            notifyHub('session:result', {
              transcript: trimmed,
              action: {
                action: 'clarify',
                responseText: prepared.question,
                source: 'local',
                rawText: trimmed,
              },
              result: { success: true, message: prepared.question },
            })
            if (Notification.isSupported()) {
              new Notification({
                title: 'EchoFlow needs a detail',
                body: prepared.question.slice(0, 180),
              }).show()
            }
            return
          }
          action = prepared.ready
          clearPending()
        }
      } else {
        const resolveStart = Date.now()
        action = await resolveAction(trimmed)
        console.log(
          `[voice] resolve ${Date.now() - resolveStart}ms →`,
          action.action,
          action.target ?? action.query ?? '',
          `(${action.source})`,
        )
      }

      // Validate email / booking / signed-in web tasks — ask in Chat when needed
      if (action.action === 'send_email' || actionNeedsChromeAccount(action)) {
        if (!loggedToChat) {
          pushUserMessage(trimmed)
          loggedToChat = true
        }
        const prepared = prepareWebAction(action)
        if (prepared.missing.length && prepared.question) {
          startClarify(prepared.ready, prepared.missing, prepared.question)
          notifyHub('session:result', {
            transcript: trimmed,
            action: {
              action: 'clarify',
              responseText: prepared.question,
              source: action.source,
              rawText: trimmed,
            },
            result: { success: true, message: prepared.question.split('\n')[0] },
          })
          if (Notification.isSupported()) {
            new Notification({
              title: 'EchoFlow needs a detail',
              body: prepared.question.slice(0, 180),
            }).show()
          }
          return
        }
        action = prepared.ready
      }

      // Planner asked a free-form clarifying question
      if (action.action === 'clarify') {
        if (!loggedToChat) {
          pushUserMessage(trimmed)
          loggedToChat = true
        }
        const q = action.responseText || 'Could you clarify that?'
        startClarify(
          {
            action: 'unknown',
            source: action.source,
            rawText: trimmed,
          },
          [],
          q,
        )
        notifyHub('session:result', {
          transcript: trimmed,
          action,
          result: { success: true, message: q },
        })
        if (Notification.isSupported()) {
          new Notification({
            title: 'EchoFlow needs a detail',
            body: q.slice(0, 180),
          }).show()
        }
        return
      }

      action = applySendItToAction(action, trimmed)

      const settings = getSettings()
      const result = await executeAction(action, { autoPaste: settings.autoPaste })
      if (loggedToChat || action.action === 'reply' || action.action === 'send_email') {
        if (!loggedToChat) pushUserMessage(trimmed)
        pushAssistantMessage(result.message)
      }

      addHistory({
        id: randomUUID(),
        transcript: trimmed,
        action: action.action,
        target: action.target ?? action.query,
        source: action.source,
        success: result.success,
        timestamp: Date.now(),
      })

      notifyHub('history:updated')
      notifyHub('session:result', { transcript: trimmed, action, result })

      if (action.action === 'reply' || action.action === 'unknown') {
        if (Notification.isSupported()) {
          new Notification({
            title: 'EchoFlow',
            body: result.message.slice(0, 180),
          }).show()
        }
      }
    } catch (err) {
      const message = publicError(err, 'Something went wrong')
      pushSystemMessage(message)
      notifyHub('session:result', { transcript: trimmed, error: message })
      if (Notification.isSupported()) {
        new Notification({ title: 'EchoFlow', body: message }).show()
      }
    }
  } finally {
    handling = false
  }
}

export function registerVoiceIpc(): void {
  // Warm up ffmpeg/device discovery so PTT starts instantly
  void initNativeCapture()
  // Index installed apps so "open <anything>" resolves instantly
  void initAppLauncher()

  ipcMain.handle(
    'voice:audio',
    (_e, payload: { base64?: string; mimeType?: string }) => {
      const base64 = String(payload?.base64 ?? '')
      const mimeType = String(payload?.mimeType ?? 'audio/wav')
      console.log('[voice] audio received:', base64.length, 'b64 chars', mimeType)

      // Keep last recording on disk so capture quality can be diagnosed
      if (base64) {
        try {
          fs.writeFileSync(
            path.join(app.getPath('userData'), 'last-capture.wav'),
            Buffer.from(base64, 'base64'),
          )
        } catch {
          // ignore
        }
      }

      if (audioWaiter) {
        clearTimeout(audioWaiter.timer)
        const { resolve } = audioWaiter
        audioWaiter = null
        resolve({ base64, mimeType })
      }
    },
  )

  ipcMain.handle('voice:transcript', async (_e, transcript: string) => {
    const t = String(transcript ?? '').trim()
    if (t && !listening && !handling) await handleTranscript(t)
  })

  ipcMain.handle('voice:partial', (_e, partial: string) => {
    if (!listening) return
    sendOverlayState({
      listening: true,
      processing: false,
      transcript: String(partial ?? ''),
      status: 'Listening…',
    })
  })

  ipcMain.handle('voice:manual-start', async () => {
    await beginListening()
  })

  ipcMain.handle('voice:manual-stop', async () => {
    await endListening()
  })

  ipcMain.handle('chat:list', () => getChatMessages())
  ipcMain.handle('chat:clear', () => clearChat())
  ipcMain.handle('chat:cancel-clarify', () => {
    cancelClarify()
    pushSystemMessage('Cancelled the pending question.')
  })
}
