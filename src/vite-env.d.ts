import type { EchoFlowApi, HistoryEntry, SessionResult } from '../shared/types'

declare global {
  interface Window {
    echoflow: EchoFlowApi
    webkitSpeechRecognition: new () => SpeechRecognition
    SpeechRecognition: new () => SpeechRecognition
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start: () => void
    stop: () => void
    abort: () => void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
  }

  interface SpeechRecognitionEvent {
    resultIndex: number
    results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionErrorEvent {
    error: string
  }
}

export type { HistoryEntry, SessionResult }
