import { useEffect, useMemo, useState } from 'react'
import type { ConnectedApp, InstalledApp, SessionResult } from '../../shared/types'

export function AppsPage() {
  const [installed, setInstalled] = useState<InstalledApp[]>([])
  const [connected, setConnected] = useState<ConnectedApp[]>([])
  const [search, setSearch] = useState('')
  const [task, setTask] = useState('')
  const [running, setRunning] = useState(false)
  const [last, setLast] = useState<SessionResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setConnected(await window.echoflow.listConnectedApps())
      setInstalled(await window.echoflow.listInstalledApps())
      setLoading(false)
    })()
    const offResult = window.echoflow.onSessionResult((r) => {
      setLast(r)
      setRunning(false)
    })
    return () => {
      offResult()
    }
  }, [])

  const connectedIds = useMemo(
    () => new Set(connected.map((c) => c.appId)),
    [connected],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? installed.filter((a) => a.name.toLowerCase().includes(q))
      : installed
    return list.slice(0, 60)
  }, [installed, search])

  const runTask = async () => {
    const text = task.trim()
    if (!text || running) return
    setRunning(true)
    setLast(null)
    await window.echoflow.sendTranscript(text)
  }

  return (
    <div className="view">
      <p className="eyebrow">Apps</p>
      <h1 className="page-title">Apps</h1>
      <p className="page-lead">
        Connect any installed app so EchoFlow can work inside it — open it, type
        content, press shortcuts. Run tasks from here or by holding{' '}
        <span className="kbd">Ctrl</span> + <span className="kbd">Alt</span> and speaking.
      </p>

      <div className="panel">
        <h2>Run a task</h2>
        <p className="hint">
          Type it like you would say it: “open notepad and write a poem about rain”,
          “open whatsapp and send a message to Rahul saying hello”.
        </p>
        <div className="composer">
          <input
            type="text"
            value={task}
            placeholder="What should EchoFlow do?"
            aria-label="Task"
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runTask()
            }}
          />
          <button
            type="button"
            className="composer-send"
            disabled={running || !task.trim()}
            onClick={() => void runTask()}
          >
            {running ? 'Running' : 'Run'}
          </button>
        </div>
        {last && (
          <div className="row" style={{ marginTop: 10 }}>
            {last.action && <span className="pill">action: {last.action.action}</span>}
            {last.result && (
              <span className={last.result.success ? 'success' : 'error'}>
                {last.result.message}
              </span>
            )}
            {last.error && <span className="error">{last.error}</span>}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Connected apps ({connected.length})</h2>
        <p className="hint">
          The assistant knows these apps by name and can automate tasks inside them.
        </p>
        {connected.length === 0 ? (
          <p className="muted">No apps connected yet — connect one from the list below.</p>
        ) : (
          <ul className="list">
            {connected.map((a) => (
              <li key={a.appId}>
                <div>{a.name}</div>
                <button
                  type="button"
                  className="btn"
                  onClick={async () =>
                    setConnected(await window.echoflow.disconnectApp(a.appId))
                  }
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>Installed apps</h2>
        <p className="hint">
          Everything in your Start Menu — including newly installed apps (refreshes on
          app restart).
        </p>
        <div className="field">
          <label htmlFor="app-search">Search</label>
          <div className="composer">
            <input
              id="app-search"
              type="text"
              value={search}
              placeholder="Search apps"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {loading ? (
          <p className="muted">Indexing installed apps…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No apps match “{search}”.</p>
        ) : (
          <ul className="list">
            {filtered.map((a) => (
              <li key={a.appId}>
                <div>{a.name}</div>
                {connectedIds.has(a.appId) ? (
                  <span className="success">connected</span>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () =>
                      setConnected(await window.echoflow.connectApp(a))
                    }
                  >
                    Connect
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
