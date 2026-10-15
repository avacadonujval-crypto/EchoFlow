import { useState } from 'react'

interface Props {
  onComplete: () => void
}

const EXAMPLES = [
  { label: 'Dictate', sample: 'Hold Ctrl + Alt and say anything — it types where your cursor is.' },
  { label: 'Open + search', sample: 'Open YouTube and search for the best video which teaches us programming' },
  { label: 'Launch app', sample: 'Open Chrome' },
  { label: 'System', sample: 'Take a screenshot' },
]

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [micOk, setMicOk] = useState<boolean | null>(null)
  const [name, setName] = useState('')

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicOk(true)
    } catch {
      setMicOk(false)
    }
  }

  const finish = async () => {
    await window.echoflow.updateSettings({
      onboardingComplete: true,
      displayName: name.trim().slice(0, 32),
    })
    onComplete()
  }

  return (
    <div className="onboarding">
      <div className="onboard-card">
        <div className="steps">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`step-dot ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <p className="eyebrow">Your name</p>
            <input
              className="onboard-name"
              value={name}
              autoFocus
              placeholder="Your name"
              aria-label="Your name"
              onChange={(e) => setName(e.target.value)}
            />
            <p className="page-lead">Hold Ctrl and Alt, then speak. EchoFlow types it or does it.</p>
            <div className="onboard-actions">
              <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
                Get started
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Microphone</h1>
            <p className="page-lead">
              EchoFlow uses your mic only while you hold the shortcut. Audio is used for that
              session and is not kept afterward.
            </p>
            <div className="row" style={{ marginBottom: 16 }}>
              <button type="button" className="btn btn-primary" onClick={() => void requestMic()}>
                Allow microphone
              </button>
              {micOk === true && <span className="success">Ready</span>}
              {micOk === false && <span className="error">Permission denied</span>}
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={micOk !== true}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>Try these</h1>
            <p className="page-lead">
              Hold <span className="kbd">Ctrl</span> + <span className="kbd">Alt</span>, speak, then
              release. EchoFlow runs in the tray so it is always ready.
            </p>
            <div className="example-grid">
              {EXAMPLES.map((ex) => (
                <div key={ex.label} className="example">
                  <strong>{ex.label}</strong>
                  <div>{ex.sample}</div>
                </div>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void finish()}>
                Enter EchoFlow
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
