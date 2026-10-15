export function PrivacyPage() {
  return (
    <div className="view">
      <h1 className="page-title">Privacy</h1>
      <p className="page-lead">
        EchoFlow is designed so your voice stays on your machine unless you opt into AI fallback.
      </p>

      <div className="panel">
        <h2>What we process</h2>
        <ul className="stack muted" style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>Microphone audio</strong> — captured only while
            you hold the push-to-talk shortcut or tap Speak. It is turned into text for the command
            you just spoke.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Transcript text</strong> — matched on this PC
            first. When that is not enough, the text (never the audio) may be sent to EchoFlow’s
            language service to understand the command.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Command history & aliases</strong> — stored
            locally on this PC. Never synced to an EchoFlow server (there is none).
          </li>
        </ul>
      </div>

      <div className="panel">
        <h2>What we do not do</h2>
        <ul className="stack muted" style={{ paddingLeft: 18, margin: 0 }}>
          <li>No always-on background listening in v1</li>
          <li>No screen content reading</li>
          <li>No connection credentials shown in the app</li>
          <li>No analytics or telemetry servers under our control</li>
        </ul>
      </div>

      <div className="panel">
        <h2>Hosted policy</h2>
        <p className="hint">
          The same policy is published with the EchoFlow website for customers and store listings.
        </p>
      </div>
    </div>
  )
}
