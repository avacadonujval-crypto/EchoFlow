import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HistoryEntry, Membership, SessionResult, VoiceProfile } from '../../shared/types'
import { intentionLine, milestoneLine, planName, wordAllowance, wordsRemaining } from '../../shared/voice'

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    dictate: 'Dictation',
    open_app: 'Opened an app',
    open_url: 'Opened a page',
    web_search: 'Search',
    youtube_search: 'YouTube',
    send_message: 'Message',
    send_email: 'Email',
    system: 'System',
    reply: 'Reply',
    macro: 'Workflow',
    keys: 'Shortcut',
    install_app: 'Install',
    uninstall_app: 'Remove app',
    clarify: 'Asked a question',
    unknown: 'Noted',
  }
  return labels[action] ?? 'Noted'
}

export function HomePage() {
  const [listening, setListening] = useState(false)
  const [last, setLast] = useState<SessionResult | null>(null)
  const [partial, setPartial] = useState('')
  const [voice, setVoice] = useState<VoiceProfile | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [totalWords, setTotalWords] = useState(0)

  const refresh = async () => {
    const [studio, nextMembership] = await Promise.all([
      window.echoflow.getVoiceStudio(),
      window.echoflow.getMembership(),
    ])
    setVoice(studio.profiles.find((profile) => profile.id === studio.activeId) ?? studio.profiles[0] ?? null)
    setTotalWords(studio.profiles.reduce((sum, profile) => sum + profile.words, 0))
    setMembership(nextMembership)
  }

  useEffect(() => {
    void refresh()
    const offResult = window.echoflow.onSessionResult((r) => {
      setLast(r)
      setListening(false)
      void refresh()
    })
    const offHistory = window.echoflow.onHistoryUpdated(() => {
      void refresh()
    })
    const offStart = window.echoflow.onVoiceStart(() => {
      setListening(true)
      setPartial('')
    })
    const offStop = window.echoflow.onVoiceStop(() => {
      setListening(false)
    })
    const offOverlay = window.echoflow.onOverlayState((s) => {
      if (s.transcript) setPartial(s.transcript)
    })
    return () => {
      offResult()
      offHistory()
      offStart()
      offStop()
      offOverlay()
    }
  }, [])

  const remaining = membership ? wordsRemaining(totalWords, membership.plan) : null
  const allowance = membership ? wordAllowance(membership.plan) : 2_000
  const paused = allowance !== null && remaining === 0

  return (
    <section className="view view-words">
      <p className="eyebrow">Words</p>
      <p className="word-figure">{voice ? voice.words.toLocaleString() : '0'}</p>
      <p className="words-today">{voice ? `${voice.wordsToday.toLocaleString()} today` : '0 today'}</p>
      <p className="page-lead view-lead">
        {voice ? intentionLine(voice.wordsToday, voice.dailyGoal) : 'One sentence begins the count.'}
      </p>
      <p className="hint view-note">
        {allowance === null
          ? `Unlimited on ${planName('maison')}.`
          : remaining === 0
            ? <>You have used your {allowance.toLocaleString()} words, so speaking is paused. <Link to="/membership">See membership</Link></>
            : remaining !== null
              ? `${remaining.toLocaleString()} of ${allowance.toLocaleString()} words left on this plan.`
              : voice
                ? milestoneLine(voice.words)
                : 'Ready when you are'}
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={paused && !listening}
        onClick={() =>
          listening ? void window.echoflow.stopListening() : void window.echoflow.startListening()
        }
      >
        {listening ? 'Stop' : 'Speak'}
      </button>
      <p className="live-line">
        {paused
          ? 'Speaking is paused until you change plans.'
          : partial || (listening ? 'Speak now.' : last?.transcript || 'Hold Ctrl and Alt, then speak.')}
      </p>
      {last?.error && <p className="error">{last.error}</p>}
      {last?.result && <p className="hint">{last.result.message}</p>}
    </section>
  )
}

export function TranscriptPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    const load = () => void window.echoflow.listHistory().then(setHistory)
    load()
    const off = window.echoflow.onHistoryUpdated(load)
    return () => off()
  }, [])

  return (
    <section className="view">
      <p className="eyebrow">Transcript</p>
      <h2 className="page-title">What you said</h2>
      <p className="page-lead">Kept on this computer.</p>
      {history.length === 0 ? (
        <p className="muted">Nothing yet. Hold Ctrl and Alt, then speak.</p>
      ) : (
        <ul className="quotes">
          {history.slice(0, 24).map((h) => (
            <li key={h.id}>
              <p className="quote">{h.transcript}</p>
              <p className="muted">
                {actionLabel(h.action)}
                {h.target ? ` · ${h.target}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
