import { useEffect, useState } from 'react'

export function OverlayPage() {
  const [listening, setListening] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [question, setQuestion] = useState('')

  useEffect(() => {
    return window.echoflow.onOverlayState((s) => {
      if (s.listening) {
        setQuestion('')
        setLeaving(false)
        setListening(true)
        return
      }
      setListening(false)
      if (s.question) {
        setLeaving(false)
        setQuestion(s.question)
        return
      }
      if (s.dismissing) setLeaving(true)
    })
  }, [])

  const motion = leaving ? 'leaving' : listening ? 'live' : ''

  if (question) {
    return (
      <div className="overlay-root overlay-ask">
        <p className="overlay-question">{question}</p>
        <p className="overlay-hint">Hold Ctrl+Alt to answer, or type it in Chat</p>
      </div>
    )
  }

  return (
    <div className="overlay-root">
      <div className={`listen-mark ${motion}`} aria-label={listening ? 'Listening' : 'EchoFlow'}>
        <span className="listen-bars" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <svg className="listen-mic" viewBox="0 0 24 24" aria-hidden>
          <rect x="9" y="2.5" width="6" height="11" rx="3" fill="#ffffff" />
          <path
            d="M6.5 11.2a5.5 5.5 0 0 0 11 0"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M12 16.7v3" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="listen-bars" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  )
}
